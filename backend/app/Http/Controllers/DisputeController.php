<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\Dispute;
use App\Models\User;
use App\Services\DisputeService;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DisputeController extends Controller
{
    public function __construct(
        private readonly DisputeService $disputeService,
        private readonly FileUploadService $fileUpload,
    ) {}

    /**
     * Open a dispute on a confirmed delivery.
     *
     * Supports optional image/video evidence (max 5 files, 5 MB each).
     *
     * POST /disputes
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'delivery_id' => ['required', 'uuid', 'exists:deliveries,id'],
            'reason' => ['required', 'string', 'max:200'],
            'description' => ['required', 'string', 'max:2000'],
            'evidence' => ['nullable', 'array', 'max:5'],
            'evidence.*' => ['file', 'mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/quicktime', 'max:5120'],
        ]);

        $delivery = Delivery::findOrFail($validated['delivery_id']);

        if ($delivery->request->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Only the request owner can open a dispute.',
            ], 403);
        }

        // Upload evidence before opening so a failed upload aborts cleanly
        $evidence = [];
        foreach ($request->file('evidence', []) as $index => $file) {
            try {
                $evidence[] = $this->fileUpload->uploadDisputeEvidence(
                    $file,
                    $delivery->id,
                    $index,
                );
            } catch (\InvalidArgumentException $e) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                ], 422);
            }
        }

        try {
            $dispute = $this->disputeService->open($delivery, $user, $validated, $evidence);
        } catch (\InvalidArgumentException $e) {
            // Roll back any evidence files that were uploaded before the dispute failed to open
            foreach ($evidence as $uploaded) {
                $this->fileUpload->delete($uploaded['path']);
            }

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Dispute opened. An admin will review it within 24 hours.',
            'data' => [
                'id' => $dispute->id,
                'status' => $dispute->status,
                'reason' => $dispute->reason,
                'evidence_count' => count($evidence),
                'created_at' => $dispute->created_at->toISOString(),
            ],
        ], 201);
    }

    /**
     * Get dispute details.
     *
     * GET /disputes/{id}
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $dispute = Dispute::with(['raiser', 'errander', 'evidence', 'messages.sender'])
            ->findOrFail($id);

        $isParty = in_array($user->id, [$dispute->raised_by, $dispute->errander_id], true);
        if (! $isParty && ! $user->role->isStaff()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatDispute($dispute),
        ]);
    }

    /**
     * List authenticated user's disputes.
     *
     * GET /my/disputes
     */
    public function myDisputes(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = Dispute::where('raised_by', $user->id)
            ->orWhere('errander_id', $user->id)
            ->with(['raiser', 'errander'])
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $disputes = $query->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $disputes->map(fn (Dispute $d) => $this->formatDispute($d)),
            'meta' => [
                'current_page' => $disputes->currentPage(),
                'per_page' => $disputes->perPage(),
                'total' => $disputes->total(),
            ],
        ]);
    }

    /**
     * Errander responds to a dispute.
     *
     * POST /disputes/{id}/respond
     */
    public function respond(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $dispute = Dispute::where('errander_id', $user->id)->findOrFail($id);

        $validated = $request->validate([
            'response' => ['required', 'string', 'max:2000'],
        ]);

        try {
            $dispute = $this->disputeService->respond($dispute, $validated['response']);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Response submitted. An admin will review the dispute.',
            'data' => $this->formatDispute($dispute),
        ]);
    }

    /**
     * Admin requests additional evidence.
     *
     * POST /disputes/{id}/request-evidence
     */
    public function requestEvidence(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $dispute = Dispute::findOrFail($id);

        $validated = $request->validate([
            'note' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $dispute = $this->disputeService->requestEvidence($dispute, $user, $validated['note']);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Evidence requested. Both parties have been notified.',
            'data' => $this->formatDispute($dispute),
        ]);
    }

    /**
     * Admin resolves a dispute.
     *
     * POST /disputes/{id}/resolve
     */
    public function resolve(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $dispute = Dispute::findOrFail($id);

        $validated = $request->validate([
            'outcome' => ['required', 'string', 'in:full_refund,partial_refund,funds_released'],
            'note' => ['required', 'string', 'max:2000'],
            'errander_split_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        try {
            $outcome = \App\Enums\DisputeStatus::from($validated['outcome']);
            $dispute = $this->disputeService->resolve(
                $dispute, $user, $outcome, $validated['note'],
                (int) ($validated['errander_split_percent'] ?? 50),
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Dispute resolved.',
            'data' => $this->formatDispute($dispute),
        ]);
    }

    private function formatDispute(Dispute $d): array
    {
        return [
            'id' => $d->id,
            'delivery_id' => $d->delivery_id,
            'bid_id' => $d->bid_id,
            'request_id' => $d->request_id,
            'raised_by' => $d->raiser ? ['id' => $d->raiser->id, 'name' => $d->raiser->name] : null,
            'errander' => $d->errander ? ['id' => $d->errander->id, 'name' => $d->errander->name] : null,
            'reason' => $d->reason,
            'description' => $d->description,
            'errander_response' => $d->errander_response,
            'status' => $d->status,
            'resolution_note' => $d->resolution_note,
            'resolved_at' => $d->resolved_at?->toISOString(),
            'opened_at' => $d->created_at->toISOString(),
            'evidence' => $d->relationLoaded('evidence')
                ? $d->evidence->map(fn ($e) => [
                    'id' => $e->id,
                    'type' => $e->type,
                    'url' => $e->url,
                    'uploaded_by' => $e->uploaded_by,
                    'created_at' => $e->created_at?->toISOString(),
                ])->values()
                : [],
        ];
    }
}
