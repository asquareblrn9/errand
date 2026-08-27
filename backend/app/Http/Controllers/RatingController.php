<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Rating;
use App\Models\User;
use App\Services\TipService;
use App\Services\TrustScoreService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RatingController extends Controller
{
    public function __construct(
        private readonly TrustScoreService $trustScore,
        private readonly WalletService $walletService,
        private readonly TipService $tipService,
    ) {}

    /**
     * Submit a rating after delivery.
     *
     * The requester may only rate the errander while the dispute window is
     * open. An optional tip is processed first; if it fails the whole
     * request is rejected so money movement and ratings stay consistent.
     *
     * POST /ratings
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'bid_id' => ['required', 'uuid', 'exists:bids,id'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'review' => ['nullable', 'string', 'max:500'],
            'tip' => ['nullable', 'numeric', 'min:0', 'max:100000'],
        ]);

        $bid = \App\Models\Bid::with('request', 'request.delivery')->findOrFail($validated['bid_id']);

        $isRequester = $user->id === $bid->request->user_id;
        $isErrander = $user->id === $bid->errander_id;

        // Only parties to the transaction can rate
        if (! $isRequester && ! $isErrander) {
            return response()->json([
                'success' => false,
                'message' => 'Only the requester or errander of this transaction can rate it.',
            ], 403);
        }

        // Requester → errander ratings are only allowed while the dispute window is open
        if ($isRequester) {
            $delivery = $bid->request->delivery;
            if (! $delivery || ! $delivery->confirmed || ! $delivery->isDisputeWindowOpen()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Ratings can only be submitted while the dispute window is open.',
                    'code' => 'rating_window_closed',
                ], 422);
            }
        }

        // Determine who is being rated
        $revieweeId = $isErrander ? $bid->request->user_id : $bid->errander_id;

        $existing = Rating::where('bid_id', $bid->id)->where('reviewer_id', $user->id)->first();
        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'You have already rated this transaction.',
                'code' => 'already_rated',
            ], 422);
        }

        // Check if the other party has already submitted (to determine visibility)
        $otherRating = Rating::where('bid_id', $bid->id)
            ->where('reviewer_id', '!=', $user->id)
            ->first();

        $tip = (float) ($validated['tip'] ?? 0);

        try {
            $rating = DB::transaction(function () use ($bid, $user, $validated, $revieweeId, $otherRating, $tip, $isRequester): Rating {
                // Process the tip first so its failure rejects the whole request
                if ($tip > 0 && $isRequester) {
                    $this->tipService->sendTip($bid, $user, $tip);
                }

                $rating = Rating::create([
                    'request_id' => $bid->request_id,
                    'bid_id' => $bid->id,
                    'reviewer_id' => $user->id,
                    'reviewee_id' => $revieweeId,
                    'rating' => $validated['rating'],
                    'review' => $validated['review'] ?? null,
                    'is_visible' => $otherRating !== null, // Visible only if both have rated
                    'submitted_at' => now(),
                ]);

                if ($otherRating) {
                    $otherRating->update(['is_visible' => true, 'visible_at' => now()]);
                }

                return $rating;
            });
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'code' => $this->errorCode($e->getMessage()),
            ], 422);
        }

        // Recalculate trust score for errander
        if ($revieweeId === $bid->errander_id) {
            $this->trustScore->recalculate($bid->errander);
        }

        return response()->json([
            'success' => true,
            'message' => $otherRating ? 'Rating published. Both ratings are now visible.' : 'Rating submitted. It will be visible when both parties submit.',
            'data' => [
                'id' => $rating->id,
                'rating' => $rating->rating,
                'is_visible' => $rating->is_visible,
                'tip' => $tip,
            ],
        ], 201);
    }

    /**
     * Get ratings for a user (public).
     *
     * GET /users/{id}/ratings
     */
    public function userRatings(string $id): JsonResponse
    {
        $ratings = Rating::visible()
            ->where('reviewee_id', $id)
            ->with('reviewer:id,name,avatar_url')
            ->latest()
            ->paginate(20);

        $avg = Rating::visible()->where('reviewee_id', $id)->avg('rating') ?: 0;

        return response()->json([
            'success' => true,
            'data' => $ratings->map(fn (Rating $r) => [
                'id' => $r->id,
                'reviewer' => $r->reviewer ? ['id' => $r->reviewer->id, 'name' => $r->reviewer->name] : null,
                'rating' => $r->rating,
                'review' => $r->review,
                'response' => $r->response,
                'created_at' => $r->created_at->toISOString(),
            ]),
            'meta' => [
                'average_rating' => round($avg, 2),
                'total' => Rating::visible()->where('reviewee_id', $id)->count(),
            ],
        ]);
    }

    /**
     * Map a service error message to a machine-readable code.
     */
    private function errorCode(string $message): string
    {
        return match (true) {
            str_contains($message, 'already tipped') => 'already_tipped',
            str_contains($message, 'window') => 'tip_window_closed',
            str_contains($message, 'Insufficient') => 'insufficient_funds',
            default => 'tip_failed',
        };
    }
}
