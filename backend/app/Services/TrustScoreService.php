<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ErranderStats;
use App\Models\Rating;
use App\Models\User;

class TrustScoreService
{
    /**
     * Recalculate trust score after a new rating or delivery update.
     */
    public function recalculate(User $errander): ErranderStats
    {
        $stats = ErranderStats::firstOrCreate(['user_id' => $errander->id]);

        $totalAccepted = $stats->total_bids_accepted ?: 1;
        $totalCompleted = $stats->completed_orders ?: 1;
        $avgRating = Rating::where('reviewee_id', $errander->id)
            ->visible()->avg('rating') ?: 0;

        $completionScore = ($stats->completed_orders / $totalAccepted) * 5;
        $ratingScore = (float) $avgRating;
        $onTimeScore = ($stats->on_time_deliveries / $totalCompleted) * 5;
        $disputeScore = max(0, (1 - ($stats->disputes_lost / $totalCompleted)) * 5);

        $trustScore = round(
            ($completionScore * 0.30) + ($ratingScore * 0.25) + ($onTimeScore * 0.25) + ($disputeScore * 0.20),
            2
        );

        $stats->update([
            'completion_rate' => round($completionScore, 2),
            'average_rating' => round($ratingScore, 2),
            'on_time_percentage' => round(($stats->on_time_deliveries / $totalCompleted) * 100, 2),
            'trust_score' => min(5.0, max(0.0, $trustScore)),
        ]);

        return $stats;
    }

    /**
     * Get stats for public display.
     */
    public function getPublicStats(User $errander): array
    {
        $stats = ErranderStats::firstOrCreate(['user_id' => $errander->id]);

        return [
            'trust_score' => $stats->trust_score,
            'tier' => $this->scoreTier($stats->trust_score),
            'completed_orders' => $stats->completed_orders,
            'average_rating' => $stats->average_rating,
            'completion_rate' => $stats->completion_rate,
            'on_time_percentage' => $stats->on_time_percentage,
        ];
    }

    private function scoreTier(float $score): string
    {
        return match (true) {
            $score >= 4.5 => 'Platinum',
            $score >= 4.0 => 'Gold',
            $score >= 3.0 => 'Silver',
            $score >= 2.0 => 'Bronze',
            default => 'At Risk',
        };
    }
}
