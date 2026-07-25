<?php

declare(strict_types=1);

namespace App\Enums;

enum BidStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';
    case PaymentMade = 'payment_made';
    case InProgress = 'in_progress';
    case Completed = 'completed';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Rejected, self::Withdrawn, self::Completed], true);
    }

    public function isActive(): bool
    {
        return in_array($this, [self::Accepted, self::PaymentMade, self::InProgress], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Accepted => 'Accepted',
            self::Rejected => 'Rejected',
            self::Withdrawn => 'Withdrawn',
            self::PaymentMade => 'Payment Made',
            self::InProgress => 'In Progress',
            self::Completed => 'Completed',
        };
    }
}
