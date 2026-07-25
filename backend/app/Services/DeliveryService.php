<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\AuditLog;
use App\Models\Bid;
use App\Models\Delivery;
use App\Models\DeliveryExtension;
use App\Models\DeliveryUpdate;
use App\Models\PlatformSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DeliveryService
{
    /** Start delivery after successful payment. */
    public function startDelivery(Bid $bid): Delivery
    {
        return DB::transaction(function () use ($bid) {
            // Use requester-specified SLA if set, otherwise fall back to platform default
            $request = $bid->request;
            $slaMinutes = $request?->sla_minutes
                ? (int) $request->sla_minutes
                : (int) PlatformSetting::get('delivery_default_sla_minutes', 120);
            $lateFeePerHour = (float) PlatformSetting::get('delivery_late_fee_per_hour', 100);
            $lateFeeMax = (float) PlatformSetting::get('delivery_late_fee_max', 2000);
            $gracePeriod = (int) PlatformSetting::get('delivery_grace_period_minutes', 10);

            $delivery = Delivery::updateOrCreate(
                ['bid_id' => $bid->id],
                [
                    'request_id' => $bid->request_id,
                    'errander_id' => $bid->errander_id,
                    'started_at' => now(),
                    'deadline_at' => now()->addMinutes($slaMinutes),
                    'sla_minutes' => $slaMinutes,
                    'late_fee_per_hour' => $lateFeePerHour,
                    'late_fee_max' => $lateFeeMax,
                    'grace_period_minutes' => $gracePeriod,
                    'late_fee_accrued' => 0,
                    'dispute_window_hours' => $bid->request?->category?->dispute_window_hours ?? 24,
                ]
            );

            // Ensure request is in_progress (payment flow already transitions it,
            // but handle edge case where it wasn't)
            $request = $bid->request;
            if ($request->status === RequestStatus::Assigned) {
                $request->update(['status' => RequestStatus::InProgress]);
            }

            // Create first update
            DeliveryUpdate::create([
                'delivery_id' => $delivery->id,
                'request_id' => $bid->request_id,
                'user_id' => $bid->errander_id,
                'type' => 'started',
                'message' => 'Order started — errander is preparing.',
            ]);

            AuditLog::log('delivery.started', $bid->errander, $delivery);

            // Notify requester that work has started
            $requester = $request->requester;
            if ($requester) {
                AuditLog::log('delivery.started', $requester, $delivery);

                app(FcmService::class)->notifyUser(
                    userId: $requester->id,
                    title: 'Work Started 🚀',
                    body: "The errander has started working on \"{$request->title}\".",
                    data: ['type' => 'work_started', 'delivery_id' => $delivery->id, 'request_id' => $bid->request_id],
                );

                \Illuminate\Support\Facades\Mail::to($requester)->queue(
                    new \App\Mail\WorkStartedMail(
                        user: $requester,
                        requestTitle: $request->title,
                    )
                );
            }

            return $delivery;
        });
    }

    /** Post a delivery progress update. */
    public function postUpdate(Delivery $delivery, User $user, string $type, string $message, ?float $lat = null, ?float $lng = null, ?string $photoUrl = null): DeliveryUpdate
    {
        $update = DeliveryUpdate::create([
            'delivery_id' => $delivery->id,
            'request_id' => $delivery->request_id,
            'user_id' => $user->id,
            'type' => $type,
            'message' => $message,
            'latitude' => $lat,
            'longitude' => $lng,
            'photo_url' => $photoUrl,
        ]);

        // If completed, mark delivery as completed
        if ($type === 'completed') {
            $this->completeDelivery($delivery);
        }

        return $update;
    }

    /** Mark delivery as completed and calculate late fees. */
    public function completeDelivery(Delivery $delivery): void
    {
        DB::transaction(function () use ($delivery) {
            $now = now();
            $lateFee = $this->calculateLateFee($delivery, $now);

            $delivery->update([
                'completed_at' => $now,
                'late_fee_accrued' => $lateFee,
            ]);

            AuditLog::log('delivery.completed', $delivery->errander, $delivery, null, null, [
                'late_fee' => $lateFee,
            ]);
        });
    }

    /** Calculate late fee based on deadline and grace period. */
    public function calculateLateFee(Delivery $delivery, \DateTimeInterface $now = null): float
    {
        $now = $now ?? now();
        $deadline = $delivery->deadline_at;

        if (!$deadline || $now <= $deadline) return 0;

        $graceMinutes = $delivery->grace_period_minutes;
        $graceDeadline = (clone $deadline)->addMinutes($graceMinutes);

        if ($now <= $graceDeadline) return 0;

        $minutesLate = $graceDeadline->diffInMinutes($now);
        $hoursLate = ceil($minutesLate / 60);
        $feePerHour = $delivery->late_fee_per_hour;
        $maxFee = $delivery->late_fee_max;

        return min($hoursLate * $feePerHour, $maxFee);
    }

    /** Get the delivery timeline. */
    public function getTimeline(Delivery $delivery): array
    {
        $updates = $delivery->updates()
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn (DeliveryUpdate $u) => [
                'id' => $u->id,
                'type' => $u->type,
                'message' => $u->message,
                'user_id' => $u->user_id,
                'latitude' => $u->latitude,
                'longitude' => $u->longitude,
                'photo_url' => $u->photo_url,
                'created_at' => $u->created_at->toISOString(),
            ]);

        $now = now();
        $deadline = $delivery->deadline_at;

        return [
            'delivery_id' => $delivery->id,
            'started_at' => $delivery->started_at?->toISOString(),
            'deadline_at' => $deadline?->toISOString(),
            'completed_at' => $delivery->completed_at?->toISOString(),
            'is_late' => $deadline && $now > $deadline,
            'minutes_remaining' => $deadline ? max(0, (int) $now->diffInMinutes($deadline, false)) : 0,
            'late_fee_accrued' => $delivery->late_fee_accrued,
            'updates' => $updates,
        ];
    }

    // ── Time Extensions ──────────────────────────────────────

    /** Request a time extension (errander). */
    public function requestExtension(Delivery $delivery, User $errander, int $additionalMinutes, string $reason): DeliveryExtension
    {
        if ($delivery->errander_id !== $errander->id) {
            throw new \InvalidArgumentException('Only the assigned errander can request an extension.');
        }

        return DB::transaction(function () use ($delivery, $errander, $additionalMinutes, $reason) {
            $ext = DeliveryExtension::create([
                'delivery_id' => $delivery->id,
                'request_id' => $delivery->request_id,
                'requested_by' => $errander->id,
                'additional_minutes' => $additionalMinutes,
                'reason' => $reason,
                'status' => 'pending',
            ]);

            AuditLog::log(
                action: 'delivery.extension_requested',
                actor: $errander,
                model: $delivery,
                metadata: ['extension_id' => $ext->id, 'additional_minutes' => $additionalMinutes, 'reason' => $reason],
            );

            // Notify requester
            $requester = $delivery->request?->requester;
            if ($requester) {
                AuditLog::log(
                    action: 'delivery.extension_requested',
                    actor: $requester,
                    model: $delivery,
                    metadata: ['extension_id' => $ext->id, 'additional_minutes' => $additionalMinutes, 'reason' => $reason],
                );

                app(FcmService::class)->notifyUser(
                    userId: $requester->id,
                    title: 'Time Extension Requested ⏰',
                    body: "{$errander->name} requests {$additionalMinutes} more minutes: {$reason}",
                    data: ['type' => 'extension_requested', 'extension_id' => $ext->id, 'delivery_id' => $delivery->id],
                );

                \Illuminate\Support\Facades\Mail::to($requester)->queue(
                    new \App\Mail\ExtensionRequestedMail(
                        user: $requester,
                        erranderName: $errander->name,
                        additionalMinutes: $additionalMinutes,
                        reason: $reason,
                        extensionId: $ext->id,
                    )
                );
            }

            return $ext;
        });
    }

    /** Approve or reject a time extension (requester only). */
    public function decideExtension(string $extensionId, User $decider, bool $approved): DeliveryExtension
    {
        $ext = DeliveryExtension::findOrFail($extensionId);

        // Only the requester who owns the request can decide
        $request = $ext->delivery?->request;
        if (! $request || $request->user_id !== $decider->id) {
            throw new \InvalidArgumentException('Only the requester can approve or reject extensions.');
        }

        if ($ext->status !== 'pending') {
            throw new \InvalidArgumentException('This extension has already been decided.');
        }

        return DB::transaction(function () use ($ext, $decider, $approved) {
            $ext->update([
                'status' => $approved ? 'approved' : 'rejected',
                'decided_by' => $decider->id,
                'decided_at' => now(),
            ]);

            if ($approved) {
                $delivery = $ext->delivery;
                $delivery->update([
                    'deadline_at' => $delivery->deadline_at->addMinutes($ext->additional_minutes),
                ]);
            }

            $action = $approved ? 'delivery.extension_approved' : 'delivery.extension_rejected';

            AuditLog::log(
                action: $action,
                actor: $decider,
                model: $ext,
                metadata: ['delivery_id' => $ext->delivery_id, 'additional_minutes' => $ext->additional_minutes],
            );

            // Notify errander of the decision
            $errander = $ext->delivery?->errander;
            if ($errander) {
                AuditLog::log(
                    action: $action,
                    actor: $errander,
                    model: $ext,
                    metadata: ['delivery_id' => $ext->delivery_id, 'additional_minutes' => $ext->additional_minutes],
                );

                $title = $approved ? 'Extension Approved ✅' : 'Extension Rejected ❌';
                $body = $approved
                    ? "Your request for {$ext->additional_minutes} more minutes was approved."
                    : "Your request for {$ext->additional_minutes} more minutes was rejected.";

                app(FcmService::class)->notifyUser(
                    userId: $errander->id,
                    title: $title,
                    body: $body,
                    data: ['type' => $approved ? 'extension_approved' : 'extension_rejected', 'extension_id' => $ext->id, 'delivery_id' => $ext->delivery_id],
                );

                \Illuminate\Support\Facades\Mail::to($errander)->queue(
                    new \App\Mail\ExtensionDecidedMail(
                        user: $errander,
                        approved: $approved,
                        additionalMinutes: $ext->additional_minutes,
                    )
                );
            }

            return $ext;
        });
    }

    /** Check if late threshold is exceeded (requester can cancel). */
    public function isLateThresholdExceeded(Delivery $delivery): bool
    {
        if (!$delivery->deadline_at || !$delivery->started_at) return false;

        $thresholdPct = (int) PlatformSetting::get('delivery_late_threshold_pct', 40);
        $totalMinutes = $delivery->started_at->diffInMinutes($delivery->deadline_at);
        $elapsedMinutes = $delivery->started_at->diffInMinutes(now());

        if ($totalMinutes <= 0) return false;
        return ($elapsedMinutes / $totalMinutes) * 100 >= $thresholdPct;
    }

    /** Cancel a delivery due to late threshold exceeded (requester action). */
    public function cancelDelivery(Delivery $delivery, User $requester, string $reason): void
    {
        DB::transaction(function () use ($delivery, $requester, $reason) {
            $bid = $delivery->bid;
            $errander = $delivery->errander;
            $request = $delivery->request;
            $payment = \App\Models\Payment::where('bid_id', $bid->id)
                ->where('status', 'successful')
                ->first();

            // Mark delivery as cancelled
            $delivery->update([
                'completed_at' => now(),
                'notes' => ($delivery->notes ? $delivery->notes . "\n" : '') . "Cancelled by requester: {$reason}",
            ]);

            // Update bid status to rejected
            if ($bid->status === \App\Enums\BidStatus::InProgress) {
                $bid->update(['status' => \App\Enums\BidStatus::Rejected]);
            }

            // Update request status to cancelled
            $request->update([
                'status' => \App\Enums\RequestStatus::Cancelled,
                'cancelled_at' => now(),
                'cancellation_reason' => $reason,
            ]);

            // Refund: unlock escrow back to requester's wallet
            if ($payment) {
                $wallet = app(WalletService::class)->getOrCreateWallet($requester);
                app(WalletService::class)->unlock($wallet, $payment->amount, 'REFUND-' . $delivery->id);
                $wallet->update(['balance' => $wallet->balance + $payment->amount]);

                $payment->update(['status' => 'refunded']);
            }

            // Mark escrow as released/refunded
            \App\Models\EscrowTransaction::where('bid_id', $bid->id)
                ->where('status', 'held')
                ->update([
                    'status' => 'released',
                    'released_at' => now(),
                    'release_trigger' => 'cancelled',
                ]);

            // Audit log for requester
            AuditLog::log(
                action: 'delivery.cancelled',
                actor: $requester,
                model: $delivery,
                metadata: ['reason' => $reason, 'bid_id' => $bid->id],
            );

            // Notify errander
            if ($errander) {
                AuditLog::log(
                    action: 'delivery.cancelled',
                    actor: $errander,
                    model: $delivery,
                    metadata: ['reason' => $reason, 'bid_id' => $bid->id],
                );

                app(FcmService::class)->notifyUser(
                    userId: $errander->id,
                    title: 'Errand Cancelled ❌',
                    body: "The requester cancelled the errand. Reason: {$reason}",
                    data: ['type' => 'delivery_cancelled', 'delivery_id' => $delivery->id],
                );

                \Illuminate\Support\Facades\Mail::to($errander)->queue(
                    new \App\Mail\DeliveryCancelledMail(
                        user: $errander,
                        reason: $reason,
                    )
                );
            }

            // Notify requester confirmation
            if ($request->requester) {
                app(FcmService::class)->notifyUser(
                    userId: $request->requester->id,
                    title: 'Errand Cancelled',
                    body: "The errand has been cancelled. A refund of ₦{$payment?->amount} has been initiated.",
                    data: ['type' => 'delivery_cancelled', 'delivery_id' => $delivery->id],
                );

                \Illuminate\Support\Facades\Mail::to($request->requester)->queue(
                    new \App\Mail\DeliveryCancelledMail(
                        user: $request->requester,
                        reason: $reason,
                    )
                );
            }
        });
    }
}
