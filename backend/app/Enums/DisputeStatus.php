<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Strict dispute lifecycle state machine.
 *
 *   delivered    → dispute_opened
 *   dispute_opened → under_review
 *   under_review → admin_decision
 *   admin_decision → full_refund, partial_refund, funds_released
 *   full_refund, partial_refund, funds_released → completed
 */
enum DisputeStatus: string
{
    case DisputeOpened = 'dispute_opened';
    case UnderReview = 'under_review';
    case AdminDecision = 'admin_decision';
    case RequestEvidence = 'request_evidence';
    case FullRefund = 'full_refund';
    case PartialRefund = 'partial_refund';
    case FundsReleased = 'funds_released';
    case Completed = 'completed';

    public function allowedTransitions(): array
    {
        return match ($this) {
            self::DisputeOpened   => [self::UnderReview],
            self::UnderReview     => [self::AdminDecision],
            self::AdminDecision   => [self::FullRefund, self::PartialRefund, self::FundsReleased, self::RequestEvidence],
            self::RequestEvidence => [self::UnderReview],
            self::FullRefund,
            self::PartialRefund,
            self::FundsReleased   => [self::Completed],
            self::Completed       => [],
        };
    }

    public function isTerminal(): bool
    {
        return $this === self::Completed;
    }

    public function isRefund(): bool
    {
        return in_array($this, [self::FullRefund, self::PartialRefund], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::DisputeOpened  => 'Dispute Opened',
            self::UnderReview    => 'Under Review',
            self::AdminDecision  => 'Admin Decision',
            self::RequestEvidence => 'Request Evidence',
            self::FullRefund     => 'Full Refund',
            self::PartialRefund  => 'Partial Refund',
            self::FundsReleased  => 'Funds Released',
            self::Completed      => 'Completed',
        };
    }
}
