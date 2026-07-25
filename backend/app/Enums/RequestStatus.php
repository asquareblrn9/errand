<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Strict errand lifecycle state machine.
 *
 * Valid transitions (each guarded by ErrandStateMachine):
 *
 *   draft           → open
 *   open            → assigned, cancelled, expired
 *   assigned        → in_progress, cancelled
 *   in_progress     → delivered, cancelled
 *   delivered       → confirmed
 *   confirmed       → escrow_hold
 *   escrow_hold     → dispute_window, funds_released
 *   dispute_window  → funds_released, completed
 *   funds_released  → completed
 *   completed       → (terminal)
 *   cancelled       → (terminal)
 *   expired         → (terminal)
 *   refunded        → (terminal)
 *   disputed        → completed, refunded
 */
enum RequestStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Assigned = 'assigned';
    case InProgress = 'in_progress';
    case Delivered = 'delivered';
    case Confirmed = 'confirmed';
    case EscrowHold = 'escrow_hold';
    case DisputeWindow = 'dispute_window';
    case FundsReleased = 'funds_released';
    case Completed = 'completed';
    case Disputed = 'disputed';
    case Refunded = 'refunded';
    case Cancelled = 'cancelled';
    case Expired = 'expired';

    /**
     * Allowed next states from this state.
     *
     * @return array<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft          => [self::Open],
            self::Open           => [self::Assigned, self::Cancelled, self::Expired],
            self::Assigned       => [self::InProgress, self::Cancelled],
            self::InProgress     => [self::Delivered, self::Cancelled],
            self::Delivered      => [self::Confirmed],
            self::Confirmed      => [self::EscrowHold],
            self::EscrowHold     => [self::DisputeWindow, self::FundsReleased],
            self::DisputeWindow  => [self::FundsReleased, self::Completed],
            self::FundsReleased  => [self::Completed],
            self::Disputed       => [self::Completed, self::Refunded],
            self::Completed,
            self::Refunded,
            self::Cancelled,
            self::Expired        => [],
        };
    }

    /**
     * Whether the status is an "active" state (visible in feeds).
     */
    public function isActive(): bool
    {
        return in_array($this, [
            self::Open, self::Assigned, self::InProgress,
        ], true);
    }

    /**
     * Whether the status is a terminal (no further transitions) state.
     */
    public function isTerminal(): bool
    {
        return in_array($this, [
            self::Completed, self::Refunded, self::Cancelled,
            self::Expired, self::FundsReleased,
        ], true);
    }

    /**
     * Whether the request can be edited in this status.
     */
    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::Open], true);
    }

    /**
     * Whether payment/escrow funds are locked.
     */
    public function isFundsLocked(): bool
    {
        return in_array($this, [
            self::EscrowHold, self::DisputeWindow,
        ], true);
    }

    /**
     * Human-readable label.
     */
    public function label(): string
    {
        return match ($this) {
            self::Draft          => 'Draft',
            self::Open           => 'Bidding',
            self::Assigned       => 'Bid Accepted',
            self::InProgress     => 'In Progress',
            self::Delivered      => 'Delivered',
            self::Confirmed      => 'Requester Confirmed',
            self::EscrowHold     => 'Escrow Hold',
            self::DisputeWindow  => 'Dispute Window',
            self::FundsReleased  => 'Funds Released',
            self::Completed      => 'Completed',
            self::Disputed       => 'Disputed',
            self::Refunded       => 'Refunded',
            self::Cancelled      => 'Cancelled',
            self::Expired        => 'Expired',
        };
    }
}
