<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StoreRequestRequest;
use App\Models\Request;
use App\Models\User;
use App\Services\RequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request as HttpRequest;

class RequestController extends Controller
{
    public function __construct(
        private readonly RequestService $requestService,
    ) {}

    /**
     * Browse the errander feed — list open requests.
     *
     * GET /requests
     */
    public function index(HttpRequest $request): JsonResponse
    {
        $requests = $this->requestService->feed(
            filters: $request->only([
                'category_id', 'latitude', 'longitude', 'radius_km',
                'budget_min', 'budget_max', 'urgent_only', 'sort',
            ]),
            perPage: (int) $request->input('per_page', 20),
        );

        return response()->json([
            'success' => true,
            'data' => $requests->map(fn (Request $r): array => $this->formatRequest($r)),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'per_page' => $requests->perPage(),
                'total' => $requests->total(),
                'last_page' => $requests->lastPage(),
            ],
        ]);
    }

    /**
     * Create a new request.
     *
     * POST /requests
     */
    public function store(StoreRequestRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->role->canCreateRequests()) {
            return response()->json([
                'success' => false,
                'message' => 'Only requesters can create requests.',
            ], 403);
        }

        // Require email verification, completed KYC, and active account
        if (! $user->canPostRequest()) {
            return response()->json([
                'success' => false,
                'message' => 'You must complete email verification and KYC before posting requests.',
                'code' => 'verification_required',
                'requirements' => [
                    'email_verified' => $user->email_verified_at !== null,
                    'kyc_completed' => $user->kyc_tier >= 1,
                    'account_active' => $user->status->value === 'active',
                ],
            ], 403);
        }

        $req = $this->requestService->create(
            requester: $user,
            data: $request->validated(),
            photos: $request->file('photos', []),
        );

        return response()->json([
            'success' => true,
            'message' => 'Request posted successfully.',
            'data' => $this->formatRequest($req),
        ], 201);
    }

    /**
     * Get a single request with photos and category.
     *
     * GET /requests/{id}
     */
    public function show(string $id): JsonResponse
    {
        $request = Request::with(['category', 'requester', 'photos', 'bids', 'bids.errander'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatRequest($request),
        ]);
    }

    /**
     * Update a request. Only allowed when status is draft or open.
     *
     * PUT /requests/{id}
     */
    public function update(HttpRequest $httpRequest, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $httpRequest->user();
        $request = Request::where('id', $id)->where('user_id', $user->id)->firstOrFail();

        if (! $request->status->isEditable()) {
            return response()->json([
                'success' => false,
                'message' => 'This request can no longer be edited.',
            ], 422);
        }

        $validated = $httpRequest->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'string', 'max:2000'],
            'location' => ['sometimes', 'string', 'max:255'],
            'latitude' => ['sometimes', 'numeric', 'min:-90', 'max:90'],
            'longitude' => ['sometimes', 'numeric', 'min:-180', 'max:180'],
            'budget_hint' => ['nullable', 'numeric', 'min:500', 'max:500000'],
        ]);

        $this->requestService->update($request, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Request updated successfully.',
            'data' => $this->formatRequest($request->fresh(['category', 'requester', 'photos'])),
        ]);
    }

    /**
     * Cancel a request. Only the owner can cancel.
     *
     * DELETE /requests/{id}
     */
    public function destroy(HttpRequest $httpRequest, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $httpRequest->user();
        $request = Request::where('id', $id)->where('user_id', $user->id)->firstOrFail();

        if (! $request->status->isEditable()) {
            return response()->json([
                'success' => false,
                'message' => 'Only draft and open requests can be cancelled.',
            ], 422);
        }

        $this->requestService->cancel(
            $request,
            $httpRequest->input('reason')
        );

        return response()->json([
            'success' => true,
            'message' => 'Request cancelled.',
        ]);
    }

    /**
     * List the authenticated user's own requests.
     *
     * GET /my/requests
     */
    public function myRequests(HttpRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = Request::where('user_id', $user->id)
            ->with(['category', 'photos'])
            ->orderByDesc('created_at');

        // Accept a single status, comma-separated list, or repeated params
        if ($statuses = $request->input('status')) {
            $statuses = is_array($statuses) ? $statuses : explode(',', $statuses);
            $query->whereIn('status', array_filter($statuses));
        }

        $requests = $query->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $requests->map(fn (Request $r): array => $this->formatRequest($r)),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'per_page' => $requests->perPage(),
                'total' => $requests->total(),
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Formatting
    |--------------------------------------------------------------------------
    */

    private function formatRequest(Request $r): array
    {
        $data = [
            'id' => $r->id,
            'title' => $r->title,
            'description' => $r->description,
            'category' => $r->category ? [
                'id' => $r->category->id,
                'name' => $r->category->name,
                'dispute_window_hours' => $r->category->dispute_window_hours,
            ] : null,
            'location' => $r->location,
            'latitude' => $r->latitude,
            'longitude' => $r->longitude,
            'budget_hint' => $r->budget_hint,
            'is_urgent' => $r->is_urgent,
            'sla_minutes' => $r->sla_minutes,
            'urgent_fee' => $r->urgent_fee,
            'status' => $r->status->value,
            'photos' => $r->photos?->map(fn ($p) => [
                'id' => $p->id,
                'url' => $p->url,
            ]),
            'requester' => $r->relationLoaded('requester') && $r->requester ? [
                'id' => $r->requester->id,
                'name' => $r->requester->name,
                'completed_orders' => $r->requester->completed_orders,
                'rating' => \App\Models\Rating::where('reviewee_id', $r->requester->id)->visible()->avg('rating'),
            ] : null,
            'bids' => $r->relationLoaded('bids') ? $r->bids->map(fn ($b) => [
                'id' => $b->id,
                'errander' => $b->relationLoaded('errander') && $b->errander ? [
                    'id' => $b->errander->id,
                    'name' => $b->errander->name,
                    'completed_orders' => $b->errander->completed_orders,
                    'rating' => \App\Models\Rating::where('reviewee_id', $b->errander->id)->visible()->avg('rating'),
                ] : null,
                'goods_amount' => $b->goods_amount,
                'service_fee' => $b->service_fee,
                'platform_fee' => $b->platform_fee,
                'total_amount' => $b->total_amount,
                'note' => $b->note,
                'status' => $b->status->value,
                'created_at' => $b->created_at->toISOString(),
            ])->values() : [],
            'created_at' => $r->created_at->toISOString(),
            'updated_at' => $r->updated_at->toISOString(),
        ];

        // Expose distance when the nearby scope computed it
        if (is_numeric($r->distance ?? null)) {
            $data['distance_km'] = round((float) $r->distance, 1);
        }

        return $data;
    }
}
