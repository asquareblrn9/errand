<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Request lifecycle states.
 */
enum RequestStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Assigned = 'assigned';
    case InProgress = 'in_progress';
    case Delivered = 'delivered';
    case Completed = 'completed';
    case Disputed = 'disputed';
    case Refunded = 'refunded';
    case Cancelled = 'cancelled';
    case Expired = 'expired';

    /**
     * Allowed transitions from this status.
     *
     * @return array<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Open],
            self::Open => [self::Assigned, self::Cancelled, self::Expired],
            self::Assigned => [self::InProgress],
            self::InProgress => [self::Delivered],
            self::Delivered => [self::Completed, self::Disputed],
            self::Disputed => [self::Completed, self::Refunded],
            default => [],
        };
    }

    /**
     * Whether the status is an "active" state (visible in feeds).
     */
    public function isActive(): bool
    {
        return in_array($this, [self::Open, self::Assigned, self::InProgress], true);
    }

    /**
     * Whether the status is a terminal state.
     */
    public function isTerminal(): bool
    {
        return in_array($this, [
            self::Completed, self::Refunded, self::Cancelled, self::Expired,
        ], true);
    }

    /**
     * Whether the request can be edited in this status.
     */
    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::Open], true);
    }
}
