<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\KycService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminKycController extends Controller
{
    public function __construct(
        private readonly KycService $kycService,
    ) {}

    // ── List Pending Reviews ─────────────────────────────────

    /**
     * List all users with pending KYC reviews.
     *
     * GET /admin/kyc/pending
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->input('per_page', 20);

        $result = $this->kycService->getPendingReviews($perPage);

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
        ]);
    }

    // ── Get User KYC Detail ──────────────────────────────────

    /**
     * Get detailed KYC information for a specific user.
     *
     * GET /admin/kyc/{userId}
     */
    public function show(string $userId): JsonResponse
    {
        $user = User::with([
            'kycVerifications.documents',
            'kycVerifications.emergencyContact',
            'kycVerifications.bankAccount',
        ])->findOrFail($userId);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role->value,
                    'status' => $user->status->value,
                    'kyc_status' => $user->kyc_status,
                    'kyc_tier' => $user->kyc_tier,
                    'date_of_birth' => $user->date_of_birth,
                    'gender' => $user->gender,
                    'residential_address' => $user->residential_address,
                    'state' => $user->state,
                    'lga' => $user->lga,
                    'email_verified' => $user->email_verified_at !== null,
                    'phone_verified' => $user->phone_verified_at !== null,
                    'created_at' => $user->created_at->toISOString(),
                ],
                'kyc_status' => $this->kycService->getKycStatus($user),
            ],
        ]);
    }

    // ── Approve ──────────────────────────────────────────────

    /**
     * Approve a KYC verification.
     *
     * POST /admin/kyc/{verificationId}/approve
     */
    public function approve(Request $request, string $verificationId): JsonResponse
    {
        /** @var User $reviewer */
        $reviewer = $request->user();

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->kycService->approveVerification(
            reviewer: $reviewer,
            verificationId: $verificationId,
            notes: $validated['notes'] ?? null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Verification approved.',
        ]);
    }

    // ── Reject ───────────────────────────────────────────────

    /**
     * Reject a KYC verification.
     *
     * POST /admin/kyc/{verificationId}/reject
     */
    public function reject(Request $request, string $verificationId): JsonResponse
    {
        /** @var User $reviewer */
        $reviewer = $request->user();

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'category' => ['required', 'string', 'in:blurry_document,id_mismatch,invalid_info,expired_document,other'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->kycService->rejectVerification(
            reviewer: $reviewer,
            verificationId: $verificationId,
            reason: $validated['reason'],
            category: $validated['category'],
            notes: $validated['notes'] ?? null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Verification rejected.',
        ]);
    }

    // ── Request Resubmission ─────────────────────────────────

    /**
     * Request resubmission of a KYC verification.
     *
     * POST /admin/kyc/{verificationId}/request-resubmission
     */
    public function requestResubmission(Request $request, string $verificationId): JsonResponse
    {
        /** @var User $reviewer */
        $reviewer = $request->user();

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'category' => ['required', 'string', 'in:blurry_document,id_mismatch,invalid_info,expired_document,other'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->kycService->requestResubmission(
            reviewer: $reviewer,
            verificationId: $verificationId,
            reason: $validated['reason'],
            category: $validated['category'],
            notes: $validated['notes'] ?? null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Resubmission requested.',
        ]);
    }
}
