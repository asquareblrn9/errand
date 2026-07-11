<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Rating;
use App\Models\User;
use App\Services\TrustScoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RatingController extends Controller
{
    public function __construct(
        private readonly TrustScoreService $trustScore,
    ) {}

    /**
     * Submit a rating after delivery.
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
        ]);

        $bid = \App\Models\Bid::with('request')->findOrFail($validated['bid_id']);

        // Determine who is being rated
        $revieweeId = $user->id === $bid->errander_id
            ? $bid->request->user_id
            : $bid->errander_id;

        $existing = Rating::where('bid_id', $bid->id)->where('reviewer_id', $user->id)->first();
        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'You have already rated this transaction.',
            ], 422);
        }

        // Check if the other party has already submitted (to determine visibility)
        $otherRating = Rating::where('bid_id', $bid->id)
            ->where('reviewer_id', '!=', $user->id)
            ->first();

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
}
