<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\DisputeStatus;
use App\Enums\RequestStatus;
use App\Events\DisputeOpened;
use App\Events\DisputeResolved;
use App\Models\Delivery;
use App\Models\Dispute;
use App\Models\DisputeEvidence;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DisputeService
{
    /**
     * Open a dispute on a confirmed delivery.
     *
     * escrow_hold → dispute_window (via state machine)
     */
    public function open(Delivery $delivery, User $requester, array $data): Dispute
    {
        if (! $delivery->confirmed) {
            throw new \InvalidArgumentException('Cannot dispute an unconfirmed delivery.');
        }

        if (! $delivery->isDisputeWindowOpen()) {
            throw new \InvalidArgumentException('The dispute window has closed.');
        }

        $existing = Dispute::where('delivery_id', $delivery->id)
            ->whereNotIn('status', ['completed'])
            ->first();
        if ($existing) {
            throw new \InvalidArgumentException('A dispute is already open for this delivery.');
        }

        $dispute = DB::transaction(function () use ($delivery, $requester, $data): Dispute {
            $dispute = Dispute::create([
                'delivery_id' => $delivery->id,
                'bid_id' => $delivery->bid_id,
                'request_id' => $delivery->request_id,
                'raised_by' => $requester->id,
                'errander_id' => $delivery->errander_id,
                'reason' => $data['reason'],
                'description' => $data['description'],
                'status' => DisputeStatus::DisputeOpened->value,
            ]);

            // Transition request: escrow_hold → dispute_window
            $request = $delivery->request;
            if ($request && $request->status === RequestStatus::EscrowHold) {
                app(ErrandStateMachine::class)->transition(
                    $request,
                    RequestStatus::DisputeWindow,
                    ['dispute' => $dispute, 'actor' => $requester],
                );
            }

            event(new DisputeOpened($dispute));

            return $dispute;
        });

        return $dispute->load('raiser', 'errander');
    }

    /**
     * Errander responds to a dispute — moves to under_review.
     */
    public function respond(Dispute $dispute, string $response, array $evidenceFiles = []): Dispute
    {
        if ($dispute->status !== DisputeStatus::DisputeOpened->value) {
            throw new \InvalidArgumentException('Dispute is not open for responses.');
        }

        $dispute->update([
            'errander_response' => $response,
            'status' => DisputeStatus::UnderReview->value,
        ]);

        foreach ($evidenceFiles as $file) {
            DisputeEvidence::create([
                'dispute_id' => $dispute->id,
                'uploaded_by' => $dispute->errander_id,
                'type' => 'photo',
                'path' => '/tmp/placeholder',
                'url' => '/tmp/placeholder',
            ]);
        }

        Log::info('Dispute response submitted', ['dispute_id' => $dispute->id]);

        return $dispute->fresh('evidence');
    }

    /**
     * Admin reviews — advances to admin_decision.
     */
    public function review(Dispute $dispute, User $admin): Dispute
    {
        if ($dispute->status !== DisputeStatus::UnderReview->value) {
            throw new \InvalidArgumentException('Dispute must be under review.');
        }

        $dispute->update(['status' => DisputeStatus::AdminDecision->value]);

        \App\Models\AuditLog::log('dispute.admin_review', $admin, $dispute);
        Log::info('Dispute under admin review', [
            'dispute_id' => $dispute->id,
            'admin_id' => $admin->id,
        ]);

        return $dispute;
    }

    /**
     * Admin requests additional evidence — sends dispute back to under_review.
     */
    public function requestEvidence(Dispute $dispute, User $admin, string $note): Dispute
    {
        if ($dispute->status !== DisputeStatus::AdminDecision->value) {
            throw new \InvalidArgumentException('Can only request evidence at admin_decision stage.');
        }

        $dispute->update([
            'status' => DisputeStatus::RequestEvidence->value,
            'resolution_note' => ($dispute->resolution_note ? $dispute->resolution_note . "\n" : '') . "Evidence requested: {$note}",
            'resolved_by' => $admin->id,
        ]);

        // Notify both parties to submit more evidence
        $this->notifyParties($dispute, 'evidence_requested', 'Additional Evidence Required', "Admin requests more evidence: {$note}");

        \App\Models\AuditLog::log('dispute.evidence_requested', $admin, $dispute, null, null, ['note' => $note]);
        Log::info('Dispute evidence requested', ['dispute_id' => $dispute->id, 'admin_id' => $admin->id]);

        return $dispute;
    }

    /**
     * Admin resolves a dispute with one of four outcomes:
     *   full_refund (100% requester), partial_refund (configurable split), funds_released (100% errander)
     *
     * @param  int  $erranderSplitPercent  Percentage (0-100) going to errander. Only used for partial_refund. Default 50.
     */
    public function resolve(Dispute $dispute, User $admin, DisputeStatus $outcome, string $note, int $erranderSplitPercent = 50): Dispute
    {
        if ($dispute->status !== DisputeStatus::AdminDecision->value) {
            throw new \InvalidArgumentException('Dispute must be in admin_decision state.');
        }

        $allowed = DisputeStatus::AdminDecision->allowedTransitions();
        if (! in_array($outcome, $allowed, true)) {
            throw new \InvalidArgumentException(
                'Invalid outcome. Allowed: ' . implode(', ', array_map(fn ($s) => $s->value, $allowed))
            );
        }

        if (! $admin->role?->isStaff()) {
            throw new \InvalidArgumentException('Only administrators can resolve disputes.');
        }

        $dispute = DB::transaction(function () use ($dispute, $admin, $outcome, $note, $erranderSplitPercent): Dispute {
            $dispute->update([
                'status' => $outcome->value,
                'resolution_note' => $note,
                'resolved_by' => $admin->id,
                'resolved_at' => now(),
            ]);

            $stateMachine = app(ErrandStateMachine::class);
            $request = $dispute->request;

            if ($outcome->isRefund()) {
                $stateMachine->transition($request, RequestStatus::Refunded, ['actor' => $admin]);
                $this->processRefund($dispute, $outcome, $erranderSplitPercent);
            } else {
                $stateMachine->transition($request, RequestStatus::FundsReleased, ['actor' => $admin]);
                $stateMachine->transition($request, RequestStatus::Completed);
                $this->processFullPayout($dispute);
            }

            // Full traceability: audit log + notifications + emails
            $this->recordDecision($dispute, $admin, $outcome, $note);

            event(new DisputeResolved($dispute));

            return $dispute;
        });

        return $dispute;
    }

    // ── Private Helpers ──────────────────────────────────────

    private function processRefund(Dispute $dispute, DisputeStatus $outcome, int $erranderSplitPercent): void
    {
        $payment = \App\Models\Payment::where('bid_id', $dispute->bid_id)
            ->where('status', 'successful')
            ->first();
        if (! $payment) return;

        $ratio = $outcome === DisputeStatus::FullRefund ? 0.0 : $erranderSplitPercent / 100;
        $erranderAmount = round($payment->amount * $ratio, 2);
        $refundAmount = $payment->amount - $erranderAmount;

        $walletService = app(WalletService::class);

        // Refund to requester
        $requester = $dispute->raiser;
        if ($requester && $refundAmount > 0) {
            $wallet = $walletService->getOrCreateWallet($requester);
            $walletService->unlock($wallet, $refundAmount, 'REFUND-DP-' . $dispute->id);
            $wallet->update(['balance' => $wallet->balance + $refundAmount]);
        }

        // Payout remainder to errander
        $errander = $dispute->errander;
        if ($errander && $erranderAmount > 0) {
            $wallet = $walletService->getOrCreateWallet($errander);
            $walletService->creditPayout($wallet, $erranderAmount, 'PAYOUT-DP-' . $dispute->id);
        }

        $payment->update(['status' => 'refunded']);

        \App\Models\EscrowTransaction::where('bid_id', $dispute->bid_id)
            ->where('status', 'held')
            ->update([
                'status' => 'released',
                'released_at' => now(),
                'release_trigger' => $outcome->value,
            ]);
    }

    private function processFullPayout(Dispute $dispute): void
    {
        $payment = \App\Models\Payment::where('bid_id', $dispute->bid_id)
            ->where('status', 'successful')
            ->first();
        if (! $payment) return;

        // Platform fee on errander earnings
        $feePct = (float) \App\Models\PlatformSetting::get('platform_fee_pct', 10);
        $amount = (float) $payment->amount;
        $platformFee = round($amount * ($feePct / 100), 2);
        $erranderPayout = $amount - $platformFee;

        $errander = $dispute->errander;
        if ($errander && $erranderPayout > 0) {
            $walletService = app(WalletService::class);
            $wallet = $walletService->getOrCreateWallet($errander);
            $walletService->creditPayout($wallet, $erranderPayout, 'PAYOUT-DP-' . $dispute->id);
        }

        \App\Models\EscrowTransaction::where('bid_id', $dispute->bid_id)
            ->where('status', 'held')
            ->update([
                'status' => 'released',
                'released_at' => now(),
                'release_trigger' => 'funds_released',
            ]);
    }

    /** Full traceability: audit log + notifications + emails for every decision. */
    private function recordDecision(Dispute $dispute, User $admin, DisputeStatus $outcome, string $note): void
    {
        $title = $dispute->reason;
        $outcomeLabel = $outcome->label();

        // Audit log for admin action
        \App\Models\AuditLog::log(
            action: 'dispute.resolved',
            actor: $admin,
            model: $dispute,
            metadata: [
                'outcome' => $outcome->value,
                'note' => $note,
                'dispute_reason' => $title,
            ]
        );

        // Notify requester
        $requester = $dispute->raiser;
        if ($requester) {
            \App\Models\AuditLog::log('dispute.resolved', $requester, $dispute);

            app(FcmService::class)->notifyUser(
                userId: $requester->id,
                title: "Dispute Resolved: {$outcomeLabel}",
                body: "Outcome for \"{$title}\": {$outcomeLabel}. {$note}",
                data: ['type' => 'dispute_resolved', 'dispute_id' => $dispute->id],
            );

            \Illuminate\Support\Facades\Mail::to($requester)->queue(
                new \App\Mail\DisputeResolvedMail(
                    user: $requester,
                    outcome: $outcomeLabel,
                    reason: $title,
                    note: $note,
                )
            );
        }

        // Notify errander
        $errander = $dispute->errander;
        if ($errander) {
            \App\Models\AuditLog::log('dispute.resolved', $errander, $dispute);

            app(FcmService::class)->notifyUser(
                userId: $errander->id,
                title: "Dispute Resolved: {$outcomeLabel}",
                body: "Outcome for \"{$title}\": {$outcomeLabel}. {$note}",
                data: ['type' => 'dispute_resolved', 'dispute_id' => $dispute->id],
            );

            \Illuminate\Support\Facades\Mail::to($errander)->queue(
                new \App\Mail\DisputeResolvedMail(
                    user: $errander,
                    outcome: $outcomeLabel,
                    reason: $title,
                    note: $note,
                )
            );
        }

        Log::info('Dispute resolved with full traceability', [
            'dispute_id' => $dispute->id,
            'outcome' => $outcome->value,
            'split_percent' => $outcome === DisputeStatus::PartialRefund ? 'variable' : ($outcome === DisputeStatus::FullRefund ? '0' : '100'),
            'resolved_by' => $admin->id,
        ]);
    }

    /** Notify both parties for non-resolution events (evidence request, etc.). */
    private function notifyParties(Dispute $dispute, string $type, string $title, string $body): void
    {
        foreach ([$dispute->raiser, $dispute->errander] as $user) {
            if (! $user) continue;

            \App\Models\AuditLog::log("dispute.{$type}", $user, $dispute);

            app(FcmService::class)->notifyUser(
                userId: $user->id,
                title: $title,
                body: $body,
                data: ['type' => "dispute_{$type}", 'dispute_id' => $dispute->id],
            );
        }
    }
}
