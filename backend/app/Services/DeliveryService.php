<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\AuditLog;
use App\Models\Bid;
use App\Models\Delivery;
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
            $slaMinutes = (int) PlatformSetting::get('delivery_default_sla_minutes', 120);
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
                ]
            );

            // Transition request to in_progress
            $request = $bid->request;
            if ($request->status === RequestStatus::Assigned) {
                $request->transitionTo(RequestStatus::InProgress);
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
}
