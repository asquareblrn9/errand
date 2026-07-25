<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Models\Request;

/**
 * Strict state machine for the errand lifecycle.
 *
 * Every state transition must go through this service. Direct status
 * updates bypassing this class are considered invalid.
 */
class ErrandStateMachine
{
    /**
     * Transition a request to a new status, with context-dependent validation.
     *
     * @param  array{bids?: \App\Models\Bid, payment?: \App\Models\Payment, delivery?: \App\Models\Delivery, actor?: \App\Models\User, reason?: string}  $context
     *
     * @throws \InvalidArgumentException When the transition is invalid.
     */
    public function transition(Request $request, RequestStatus $to, array $context = []): void
    {
        $from = $request->status;

        $allowed = $from->allowedTransitions();

        if (! in_array($to, $allowed, true)) {
            throw new \InvalidArgumentException(
                "Invalid transition: {$from->value} → {$to->value}. " .
                'Allowed: ' . implode(', ', array_map(fn ($s) => $s->value, $allowed))
            );
        }

        // ── Context-specific guards ──────────────────────────

        match (true) {
            // open → assigned: must have an accepted bid
            $from === RequestStatus::Open && $to === RequestStatus::Assigned => $this->guardBidAccepted($context),

            // assigned → in_progress: payment must be confirmed
            $from === RequestStatus::Assigned && $to === RequestStatus::InProgress => $this->guardPaymentConfirmed($context),

            // assigned → cancelled: only before payment
            $from === RequestStatus::Assigned && $to === RequestStatus::Cancelled => $this->guardNoPayment($context),

            // in_progress → delivered: must be assigned errander
            $from === RequestStatus::InProgress && $to === RequestStatus::Delivered => $this->guardErranderOnly($context),

            // in_progress → cancelled: late threshold exceeded, requester only
            $from === RequestStatus::InProgress && $to === RequestStatus::Cancelled => $this->guardLateThreshold($context),

            // delivered → confirmed: valid OTP provided
            $from === RequestStatus::Delivered && $to === RequestStatus::Confirmed => $this->guardOtpConfirmed($context),

            // confirmed → escrow_hold: auto after confirmation
            $from === RequestStatus::Confirmed && $to === RequestStatus::EscrowHold => null,

            // escrow_hold → dispute_window: dispute opened by requester
            $from === RequestStatus::EscrowHold && $to === RequestStatus::DisputeWindow => $this->guardDisputeOpened($context),

            // escrow_hold → funds_released: dispute window expired (auto)
            $from === RequestStatus::EscrowHold && $to === RequestStatus::FundsReleased => null,

            // dispute_window → funds_released or completed: admin only
            ($from === RequestStatus::DisputeWindow && ($to === RequestStatus::FundsReleased || $to === RequestStatus::Completed)) => $this->guardAdminOnly($context),

            // funds_released → completed: auto after payout
            $from === RequestStatus::FundsReleased && $to === RequestStatus::Completed => null,

            default => null,
        };

        // ── Execute transition ───────────────────────────────

        $request->update(['status' => $to->value]);

        // ── Bid side-effects ─────────────────────────────────

        if ($to === RequestStatus::InProgress && isset($context['bid'])) {
            $bid = $context['bid'];
            if ($bid->status === BidStatus::Accepted) {
                $bid->update(['status' => BidStatus::PaymentMade]);
            }
        }
    }

    /**
     * Transition a bid through its own state machine.
     */
    public function transitionBid(\App\Models\Bid $bid, BidStatus $to): void
    {
        $from = $bid->status;

        $allowed = $bid::ALLOWED_TRANSITIONS[$from->value] ?? [];

        if (! in_array($to->value, $allowed, true)) {
            throw new \InvalidArgumentException(
                "Invalid bid transition: {$from->value} → {$to->value}"
            );
        }

        $bid->update(['status' => $to]);
    }

    // ── Guards ───────────────────────────────────────────────

    private function guardBidAccepted(array $context): void
    {
        $bid = $context['bid'] ?? null;
        if (! $bid || $bid->status !== BidStatus::Accepted) {
            throw new \InvalidArgumentException('A bid must be accepted before assigning the request.');
        }
    }

    private function guardPaymentConfirmed(array $context): void
    {
        $payment = $context['payment'] ?? null;
        if (! $payment || $payment->status !== 'successful') {
            throw new \InvalidArgumentException('Payment must be confirmed before proceeding.');
        }
    }

    private function guardNoPayment(array $context): void
    {
        $payment = \App\Models\Payment::where('bid_id', $context['bid']?->id ?? '')
            ->where('status', 'successful')
            ->exists();
        if ($payment) {
            throw new \InvalidArgumentException('Cannot cancel after payment has been made. Use the late cancellation flow instead.');
        }
    }

    private function guardErranderOnly(array $context): void
    {
        $delivery = $context['delivery'] ?? null;
        $actor = $context['actor'] ?? null;
        if (! $actor || ! $delivery || $actor->id !== $delivery->errander_id) {
            throw new \InvalidArgumentException('Only the assigned errander can mark delivery as complete.');
        }
    }

    private function guardLateThreshold(array $context): void
    {
        $delivery = $context['delivery'] ?? null;
        $actor = $context['actor'] ?? null;
        $request = $context['request_model'] ?? null;

        if (! $actor || ! $request || $actor->id !== $request->user_id) {
            throw new \InvalidArgumentException('Only the requester can cancel.');
        }

        if ($delivery && ! app(DeliveryService::class)->isLateThresholdExceeded($delivery)) {
            throw new \InvalidArgumentException('The late threshold has not been reached.');
        }
    }

    private function guardOtpConfirmed(array $context): void
    {
        $delivery = $context['delivery'] ?? null;
        if (! $delivery || ! $delivery->confirmed) {
            throw new \InvalidArgumentException('Delivery must be confirmed via OTP.');
        }
    }

    private function guardDisputeOpened(array $context): void
    {
        $dispute = $context['dispute'] ?? null;
        if (! $dispute) {
            throw new \InvalidArgumentException('A dispute must be opened to enter dispute window.');
        }
    }

    private function guardAdminOnly(array $context): void
    {
        $actor = $context['actor'] ?? null;
        if (! $actor || ! $actor->role?->isStaff()) {
            throw new \InvalidArgumentException('Only administrators can resolve disputes.');
        }
    }
}
