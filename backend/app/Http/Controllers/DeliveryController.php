<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Delivery;
use App\Models\User;
use App\Services\DeliveryOtpService;
use App\Services\DeliveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryController extends Controller
{
    public function __construct(
        private readonly DeliveryOtpService $otpService,
        private readonly DeliveryService $deliveryService,
    ) {}

    /**
     * Generate delivery OTP. Only the assigned errander.
     *
     * POST /deliveries/{bidId}/generate-otp
     */
    public function generateOtp(Request $request, string $bidId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $bid = Bid::with('request.category')->findOrFail($bidId);

        if (! $user->role->canBidOnRequests()) {
            return response()->json([
                'success' => false,
                'message' => 'Only erranders can generate delivery OTPs.',
            ], 403);
        }

        try {
            $result = $this->otpService->generate($bid, $user);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'OTP generated. Share this code with the requester to confirm delivery.',
            'data' => [
                'otp' => $result['otp'],
                'expires_in_minutes' => $result['expires_in_minutes'],
                'expires_at' => $result['expires_at'],
            ],
        ]);
    }

    /**
     * Confirm delivery by entering OTP. Only the requester.
     *
     * POST /deliveries/{bidId}/confirm
     */
    public function confirm(Request $request, string $bidId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $bid = Bid::with('request')->findOrFail($bidId);

        // Only the request owner can confirm delivery
        $isOwner = \App\Models\Request::where('id', $bid->request_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isOwner) {
            return response()->json([
                'success' => false,
                'message' => 'Only the request owner can confirm delivery.',
            ], 403);
        }

        $validated = $request->validate([
            'otp' => ['required', 'string', 'size:6'],
        ]);

        try {
            $delivery = $this->otpService->confirm($bid, $user, $validated['otp']);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Delivery confirmed. The dispute window is now open.',
            'data' => [
                'delivery_id' => $delivery->id,
                'confirmed_at' => $delivery->confirmed_at->toISOString(),
                'dispute_window_hours' => $delivery->dispute_window_hours,
                'dispute_window_closes_at' => $delivery->dispute_window_closes_at->toISOString(),
            ],
        ]);
    }

    /**
     * Get delivery details for a bid.
     *
     * GET /deliveries/{bidId}
     */
    public function show(Request $request, string $bidId): JsonResponse
    {
        $delivery = \App\Models\Delivery::where('bid_id', $bidId)->firstOrFail();

        /** @var User $user */
        $user = $request->user();
        $bid = Bid::findOrFail($bidId);

        if ($user->id !== $bid->errander_id && $user->id !== $bid->request->user_id && ! $user->role->isStaff()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $delivery = Delivery::where('bid_id', $bidId)->with('updates')->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $delivery->id,
                'bid_id' => $delivery->bid_id,
                'confirmed' => $delivery->confirmed,
                'confirmed_at' => $delivery->confirmed_at?->toISOString(),
                'started_at' => $delivery->started_at?->toISOString(),
                'deadline_at' => $delivery->deadline_at?->toISOString(),
                'completed_at' => $delivery->completed_at?->toISOString(),
                'is_late' => $delivery->isLate(),
                'minutes_remaining' => $delivery->minutesRemaining(),
                'late_fee_accrued' => $delivery->late_fee_accrued,
                'dispute_window_hours' => $delivery->dispute_window_hours,
                'dispute_window_closes_at' => $delivery->dispute_window_closes_at?->toISOString(),
            ],
        ]);
    }

    /**
     * Get delivery timeline with all updates.
     *
     * GET /deliveries/{bidId}/timeline
     */
    public function timeline(Request $request, string $bidId): JsonResponse
    {
        $delivery = Delivery::where('bid_id', $bidId)->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $this->deliveryService->getTimeline($delivery),
        ]);
    }

    /**
     * Post a delivery progress update.
     *
     * POST /deliveries/{bidId}/updates
     */
    public function postUpdate(Request $request, string $bidId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $delivery = Delivery::where('bid_id', $bidId)->firstOrFail();

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:heading_to_pickup,item_purchased,on_the_way,traffic_delay,arrived,completed,custom'],
            'message' => ['required', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
        ]);

        $update = $this->deliveryService->postUpdate(
            delivery: $delivery,
            user: $user,
            type: $validated['type'],
            message: $validated['message'],
            lat: $validated['latitude'] ?? null,
            lng: $validated['longitude'] ?? null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Update posted.',
            'data' => [
                'id' => $update->id,
                'type' => $update->type,
                'message' => $update->message,
                'created_at' => $update->created_at->toISOString(),
            ],
        ], 201);
    }
}
