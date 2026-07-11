<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BidStatus;
use App\Exceptions\BidAlreadyExistsException;
use App\Models\Bid;
use App\Models\Request;
use App\Models\User;
use App\Services\BidService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request as HttpRequest;

class BidController extends Controller
{
    public function __construct(
        private readonly BidService $bidService,
    ) {}

    /**
     * Submit a bid on an open request.
     *
     * POST /requests/{requestId}/bids
     */
    public function store(HttpRequest $httpRequest, string $requestId): JsonResponse
    {
        /** @var User $user */
        $user = $httpRequest->user();

        if (! $user->role->canBidOnRequests()) {
            return response()->json([
                'success' => false,
                'message' => 'Only erranders can submit bids.',
            ], 403);
        }

        $request = Request::findOrFail($requestId);

        $validated = $httpRequest->validate([
            'goods_amount' => ['required', 'numeric', 'min:0'],
            'service_fee' => ['required', 'numeric', 'min:500'],
            'delivery_at' => ['nullable', 'date', 'after:now'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $bid = $this->bidService->submit($request, $user, $validated);
        } catch (BidAlreadyExistsException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Bid submitted successfully.',
            'data' => $this->formatBid($bid),
        ], 201);
    }

    /**
     * List all bids on a request.
     *
     * GET /requests/{requestId}/bids
     */
    public function index(string $requestId): JsonResponse
    {
        $request = Request::findOrFail($requestId);

        $bids = $request->bids()
            ->with('errander')
            ->orderByDesc('created_at')
            ->get();

        $currentUser = auth()->user();
        $isOwner = $currentUser && $request->isOwnedBy($currentUser);

        return response()->json([
            'success' => true,
            'data' => $bids->map(fn (Bid $b): array => $this->formatBid($b, $isOwner)),
        ]);
    }

    /**
     * Accept a bid. Only the request owner can accept.
     *
     * POST /bids/{id}/accept
     */
    public function accept(HttpRequest $httpRequest, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $httpRequest->user();
        $bid = Bid::with('request')->findOrFail($id);

        if (! $bid->request->isOwnedBy($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Only the request owner can accept a bid.',
            ], 403);
        }

        try {
            $bid = $this->bidService->accept($bid);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Bid accepted. Please complete payment to proceed.',
            'data' => [
                'bid' => [
                    'id' => $bid->id,
                    'status' => $bid->status->value,
                    'total_amount' => $bid->total_amount,
                ],
            ],
        ]);
    }

    /**
     * Withdraw a pending bid. Only the errander who placed it can withdraw.
     *
     * DELETE /bids/{id}
     */
    public function destroy(HttpRequest $httpRequest, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $httpRequest->user();
        $bid = Bid::where('id', $id)->where('errander_id', $user->id)->firstOrFail();

        try {
            $this->bidService->withdraw($bid);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Bid withdrawn.',
        ]);
    }

    /**
     * List the authenticated errander's own bids.
     *
     * GET /my/bids
     */
    public function myBids(HttpRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = Bid::where('errander_id', $user->id)
            ->with(['request.category'])
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $bids = $query->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $bids->map(fn (Bid $b): array => [
                'id' => $b->id,
                'request_id' => $b->request_id,
                'request_title' => $b->request?->title,
                'goods_amount' => $b->goods_amount,
                'service_fee' => $b->service_fee,
                'platform_fee' => $b->platform_fee,
                'total_amount' => $b->total_amount,
                'delivery_at' => $b->delivery_at?->toISOString(),
                'status' => $b->status->value,
                'created_at' => $b->created_at->toISOString(),
            ]),
            'meta' => [
                'current_page' => $bids->currentPage(),
                'per_page' => $bids->perPage(),
                'total' => $bids->total(),
            ],
        ]);
    }

    private function formatBid(Bid $b, bool $showFullDetails = false): array
    {
        $data = [
            'id' => $b->id,
            'request_id' => $b->request_id,
            'goods_amount' => $b->goods_amount,
            'service_fee' => $b->service_fee,
            'platform_fee' => $b->platform_fee,
            'total_amount' => $b->total_amount,
            'delivery_at' => $b->delivery_at?->toISOString(),
            'status' => $b->status->value,
            'created_at' => $b->created_at->toISOString(),
        ];

        if ($b->relationLoaded('errander') && $b->errander) {
            $data['errander'] = [
                'id' => $b->errander->id,
                'name' => $b->errander->name,
                'completed_orders' => $b->errander->completed_orders,
            ];
        }

        if ($showFullDetails) {
            $data['note'] = $b->note;
        }

        return $data;
    }
}
