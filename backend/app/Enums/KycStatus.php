<?php

declare(strict_types=1);

namespace App\Enums;

enum KycStatus: string
{
    case Draft = 'draft';
    case PendingReview = 'pending_review';
    case UnderReview = 'under_review';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case RequiresResubmission = 'requires_resubmission';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::PendingReview => 'Pending Review',
            self::UnderReview => 'Under Review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::RequiresResubmission => 'Requires Resubmission',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Draft => '#94A3B8',
            self::PendingReview => '#F97316',
            self::UnderReview => '#2563EB',
            self::Approved => '#10B981',
            self::Rejected => '#EF4444',
            self::RequiresResubmission => '#F97316',
        };
    }
}
