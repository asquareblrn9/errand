<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Delivery;
use App\Models\DeliveryExtension;
use App\Models\User;
use App\Services\DeliveryOtpService;
use App\Services\DeliveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeliveryController extends Controller
{
    public function __construct(
        private readonly DeliveryOtpService $otpService,
        private readonly DeliveryService $deliveryService,
    ) {}

    /**
     * Errander starts the errand after payment is confirmed.
     *
     * POST /deliveries/{bidId}/start
     */
    public function start(Request $request, string $bidId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $bid = Bid::findOrFail($bidId);

        if ($bid->errander_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Only the assigned errander can start.'], 403);
        }

        // Allow start if payment_made, or if in_progress but delivery doesn't exist yet (retry)
        $existingDelivery = Delivery::where('bid_id', $bid->id)->first();
        if ($bid->status->value === 'payment_made') {
            // Normal flow — proceed
        } elseif ($bid->status->value === 'in_progress' && !$existingDelivery) {
            // Stuck state: bid was set to in_progress but startDelivery failed — allow retry
        } else {
            return response()->json(['success' => false, 'message' => 'Payment must be confirmed before starting.'], 422);
        }

        // Use a DB transaction to ensure bid status and delivery are created
        // atomically. If startDelivery fails, the bid stays as payment_made.
        $delivery = DB::transaction(function () use ($bid): Delivery {
            $bid->update(['status' => \App\Enums\BidStatus::InProgress]);
            return $this->deliveryService->startDelivery($bid);
        });

        return response()->json([
            'success' => true,
            'message' => 'Errand started. SLA timer is now active.',
            'data' => $this->deliveryService->getTimeline($delivery),
        ]);
    }

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
                'late_threshold_exceeded' => $this->deliveryService->isLateThresholdExceeded($delivery),
                'minutes_remaining' => $delivery->minutesRemaining(),
                'sla_minutes' => $delivery->sla_minutes,
                'grace_period_minutes' => $delivery->grace_period_minutes,
                'late_fee_per_hour' => $delivery->late_fee_per_hour,
                'late_fee_max' => $delivery->late_fee_max,
                'late_fee_accrued' => $delivery->late_fee_accrued,
                'dispute_window_hours' => $delivery->dispute_window_hours,
                'dispute_window_closes_at' => $delivery->dispute_window_closes_at?->toISOString(),
                'pending_extension' => $this->formatPendingExtension($delivery),
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

    /**
     * Request a time extension (errander).
     *
     * POST /deliveries/{bidId}/extensions
     */
    public function requestExtension(Request $request, string $bidId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $delivery = Delivery::where('bid_id', $bidId)->firstOrFail();

        $validated = $request->validate([
            'additional_minutes' => ['required', 'integer', 'min:5', 'max:1440'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        try {
            $ext = $this->deliveryService->requestExtension(
                delivery: $delivery,
                errander: $user,
                additionalMinutes: (int) $validated['additional_minutes'],
                reason: $validated['reason'],
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Extension requested.',
            'data' => ['id' => $ext->id, 'status' => $ext->status, 'additional_minutes' => $ext->additional_minutes],
        ], 201);
    }

    /**
     * Approve or reject an extension request (requester).
     *
     * POST /deliveries/extensions/{extensionId}/decide
     */
    public function decideExtension(Request $request, string $extensionId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'approved' => ['required', 'boolean'],
        ]);

        try {
            $this->deliveryService->decideExtension(
                extensionId: $extensionId,
                decider: $user,
                approved: $validated['approved'],
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $validated['approved'] ? 'Extension approved.' : 'Extension rejected.',
        ]);
    }

    // ── Helpers ─────────────────────────────────────────────

    /**
     * Cancel a delivery due to late threshold exceeded (requester only).
     *
     * POST /deliveries/{bidId}/cancel
     */
    public function cancel(Request $request, string $bidId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $delivery = Delivery::where('bid_id', $bidId)->firstOrFail();
        $bid = Bid::findOrFail($bidId);

        // Only the requester can cancel
        if ($user->id !== $bid->request->user_id) {
            return response()->json(['success' => false, 'message' => 'Only the requester can cancel.'], 403);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        if (! $this->deliveryService->isLateThresholdExceeded($delivery)) {
            return response()->json(['success' => false, 'message' => 'The late threshold has not been reached yet.'], 422);
        }

        $this->deliveryService->cancelDelivery($delivery, $user, $validated['reason']);

        return response()->json([
            'success' => true,
            'message' => 'Errand cancelled. A refund has been initiated.',
        ]);
    }

    private function formatPendingExtension(Delivery $delivery): ?array
    {
        $ext = $delivery->extensions()
            ->where('status', 'pending')
            ->with('requester')
            ->latest()
            ->first();

        if (! $ext) return null;

        return [
            'id' => $ext->id,
            'additional_minutes' => $ext->additional_minutes,
            'reason' => $ext->reason,
            'status' => $ext->status,
            'requested_by' => $ext->requester ? [
                'id' => $ext->requester->id,
                'name' => $ext->requester->name,
            ] : null,
            'created_at' => $ext->created_at->toISOString(),
        ];
    }
}
