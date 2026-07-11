<?php

declare(strict_types=1);

namespace App\Enums;

enum BidStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Accepted, self::Rejected, self::Withdrawn], true);
    }
}
