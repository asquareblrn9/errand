<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\KycService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KycController extends Controller
{
    public function __construct(
        private readonly KycService $kycService,
    ) {}

    // ── Status ───────────────────────────────────────────────

    /**
     * Get the authenticated user's full KYC status.
     *
     * GET /kyc/status
     */
    public function status(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => $this->kycService->getKycStatus($user),
        ]);
    }

    // ── Step 1: Profile ──────────────────────────────────────

    /**
     * Update KYC profile information.
     *
     * PUT /kyc/profile
     */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'gender' => ['required', 'string', 'in:male,female,other'],
            'residential_address' => ['required', 'string', 'max:500'],
            'state' => ['required', 'string', 'max:100'],
            'lga' => ['required', 'string', 'max:100'],
        ]);

        $updatedUser = $this->kycService->updateProfile($user, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'data' => $this->kycService->getKycStatus($updatedUser),
        ]);
    }

    // ── Step 4: Identity Documents ───────────────────────────

    /**
     * Submit government ID documents.
     *
     * POST /kyc/identity
     */
    public function submitIdentity(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'document_type' => ['required', 'string', 'in:nin,drivers_license,voters_card,international_passport'],
            'document_number' => ['required', 'string', 'max:100'],
            'front_image' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'back_image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        $this->kycService->submitIdentityDocuments(
            user: $user,
            documentType: $validated['document_type'],
            documentNumber: $validated['document_number'],
            frontImage: $validated['front_image'],
            backImage: $validated['back_image'] ?? null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Identity documents submitted for review.',
            'data' => $this->kycService->getKycStatus($user->fresh()),
        ]);
    }

    // ── Step 5: Selfie ───────────────────────────────────────

    /**
     * Submit selfie for verification.
     *
     * POST /kyc/selfie
     */
    public function submitSelfie(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'selfie' => ['required', 'file', 'mimes:jpg,jpeg,png', 'max:5120'],
        ]);

        $this->kycService->submitSelfie($user, $request->file('selfie'));

        return response()->json([
            'success' => true,
            'message' => 'Selfie submitted for review.',
            'data' => $this->kycService->getKycStatus($user->fresh()),
        ]);
    }

    // ── Step 6: Bank Account ─────────────────────────────────

    /**
     * Save bank account details.
     *
     * POST /kyc/bank-account
     */
    public function saveBankAccount(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'bank_name' => ['required', 'string', 'max:100'],
            'bank_code' => ['required', 'string', 'max:20'],
            'account_number' => ['required', 'string', 'digits:10', 'max:20'],
            'account_name' => ['required', 'string', 'max:200'],
        ]);

        $this->kycService->saveBankAccount(
            user: $user,
            bankName: $validated['bank_name'],
            bankCode: $validated['bank_code'],
            accountNumber: $validated['account_number'],
            accountName: $validated['account_name'],
        );

        return response()->json([
            'success' => true,
            'message' => 'Bank account saved successfully.',
            'data' => $this->kycService->getKycStatus($user->fresh()),
        ]);
    }

    // ── Step 7: Emergency Contact ────────────────────────────

    /**
     * Save emergency contact.
     *
     * POST /kyc/emergency-contact
     */
    public function saveEmergencyContact(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:200'],
            'phone_number' => ['required', 'string', 'max:20', 'regex:/^\+?[1-9]\d{6,14}$/'],
            'relationship' => ['required', 'string', 'in:parent,sibling,friend,spouse,other'],
            'other_relationship' => ['nullable', 'string', 'max:100', 'required_if:relationship,other'],
        ]);

        $this->kycService->saveEmergencyContact(
            user: $user,
            fullName: $validated['full_name'],
            phoneNumber: $validated['phone_number'],
            relationship: $validated['relationship'],
            otherRelationship: $validated['other_relationship'] ?? null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Emergency contact saved successfully.',
            'data' => $this->kycService->getKycStatus($user->fresh()),
        ]);
    }

    // ── Final Submission ─────────────────────────────────────

    /**
     * Submit the entire KYC application for admin review.
     *
     * POST /kyc/submit
     */
    public function submit(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $this->kycService->submitForReview($user);

        return response()->json([
            'success' => true,
            'message' => 'Your verification documents have been submitted for review. You will be notified when the review is complete.',
            'data' => $this->kycService->getKycStatus($user->fresh()),
        ]);
    }
}
