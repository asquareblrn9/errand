<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\KycStatus;
use App\Enums\KycVerificationType;
use App\Exceptions\BankChangeLockedException;
use App\Models\AuditLog;
use App\Models\BankAccount;
use App\Models\EmergencyContact;
use App\Models\KycDocument;
use App\Models\KycVerification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class KycService
{
    public function __construct(
        private readonly FileUploadService $uploadService,
        private readonly FcmService $fcm,
    ) {}

    // ── Profile Update ───────────────────────────────────────

    /**
     * Update the user's KYC profile information (Step 1).
     */
    public function updateProfile(User $user, array $data): User
    {
        $user->update([
            'first_name' => $data['first_name'] ?? $user->first_name,
            'last_name' => $data['last_name'] ?? $user->last_name,
            'middle_name' => $data['middle_name'] ?? $user->middle_name,
            'name' => trim(($data['first_name'] ?? $user->first_name).' '.($data['last_name'] ?? $user->last_name)),
            'date_of_birth' => $data['date_of_birth'] ?? $user->date_of_birth,
            'gender' => $data['gender'] ?? $user->gender,
            'residential_address' => $data['residential_address'] ?? $user->residential_address,
            'state' => $data['state'] ?? $user->state,
            'lga' => $data['lga'] ?? $user->lga,
            'kyc_status' => $user->kyc_status === KycStatus::Draft->value
                ? KycStatus::Draft->value
                : $user->kyc_status,
        ]);

        AuditLog::log('kyc.profile_updated', $user, $user);

        return $user->fresh();
    }

    // ── Identity Verification ────────────────────────────────

    /**
     * Submit government ID documents (Step 4).
     */
    public function submitIdentityDocuments(
        User $user,
        string $documentType,
        string $documentNumber,
        UploadedFile $frontImage,
        ?UploadedFile $backImage = null,
    ): KycDocument {
        return DB::transaction(function () use ($user, $documentType, $documentNumber, $frontImage, $backImage) {
            // Upsert the verification record
            $verification = $this->getOrCreateVerification($user, KycVerificationType::Identity);

            // Upload files
            $front = $this->uploadDocument($user, $frontImage, 'kyc/identity');

            $back = null;
            if ($backImage) {
                $back = $this->uploadDocument($user, $backImage, 'kyc/identity');
            }

            // Delete old documents (files and records)
            $this->deleteVerificationDocuments($verification);

            // Create new document record
            $document = $verification->documents()->create([
                'document_type' => $documentType,
                'document_number' => $documentNumber,
                'front_image_path' => $front['path'],
                'front_image_url' => $front['url'],
                'back_image_path' => $back ? $back['path'] : null,
                'back_image_url' => $back ? $back['url'] : null,
                'file_type' => $frontImage->getClientMimeType() === 'application/pdf' ? 'pdf' : 'image',
                'file_size' => $frontImage->getSize(),
                'original_filename' => $frontImage->getClientOriginalName(),
            ]);

            // Submit for review
            $verification->submit();

            AuditLog::log('kyc.identity_submitted', $user, $user);

            return $document;
        });
    }

    // ── Selfie Verification ──────────────────────────────────

    /**
     * Submit selfie photo for verification (Step 5).
     */
    public function submitSelfie(User $user, UploadedFile $selfie): KycVerification
    {
        return DB::transaction(function () use ($user, $selfie) {
            $verification = $this->getOrCreateVerification($user, KycVerificationType::Selfie);

            // Upload selfie
            $result = $this->uploadDocument($user, $selfie, 'kyc/selfies');

            // Delete old documents (files and records)
            $this->deleteVerificationDocuments($verification);

            // Store selfie path on the verification record
            $verification->documents()->create([
                'document_type' => 'international_passport', // reuse enum; selfie is stored as front
                'document_number' => 'SELFIE-'.$user->id,
                'front_image_path' => $result['path'],
                'front_image_url' => $result['url'],
                'file_type' => 'image',
                'file_size' => $selfie->getSize(),
                'original_filename' => $selfie->getClientOriginalName(),
            ]);

            $verification->submit();

            AuditLog::log('kyc.selfie_submitted', $user, $user);

            return $verification;
        });
    }

    // ── Bank Verification ────────────────────────────────────

    /**
     * Save bank account details (Step 6).
     */
    public function saveBankAccount(
        User $user,
        string $bankName,
        string $bankCode,
        string $accountNumber,
        string $accountName,
    ): BankAccount {
        return DB::transaction(function () use ($user, $bankName, $bankCode, $accountNumber, $accountName) {
            // Verify bank name matches
            if (empty($accountName) || strlen($accountName) < 3) {
                throw ValidationException::withMessages([
                    'account_number' => ['Could not verify account name. Please check the account number.'],
                ]);
            }

            // Payout bank can only be CHANGED once per calendar month.
            // First-time add and identical re-saves are free. The lock lives
            // on users because the bank row itself is deleted on every save.
            $existing = BankAccount::where('user_id', $user->id)
                ->where('is_verified', true)
                ->orderByDesc('is_primary')
                ->orderByDesc('created_at')
                ->first();

            $isSameAccount = $existing !== null
                && trim($existing->bank_code) === trim($bankCode)
                && trim($existing->account_number) === trim($accountNumber);

            if ($existing !== null
                && ! $isSameAccount
                && $user->bank_changed_at !== null
                && now()->isSameMonth(Carbon::parse($user->bank_changed_at))
            ) {
                throw new BankChangeLockedException(
                    now()->addMonthNoOverflow()->startOfMonth()->toDateString()
                );
            }

            $verification = $this->getOrCreateVerification($user, KycVerificationType::Bank);

            // Delete old bank accounts for this verification
            BankAccount::where('kyc_verification_id', $verification->id)->delete();

            $bankAccount = BankAccount::create([
                'user_id' => $user->id,
                'kyc_verification_id' => $verification->id,
                'bank_name' => $bankName,
                'bank_code' => $bankCode,
                'account_number' => $accountNumber,
                'account_name' => $accountName,
                'is_verified' => true,
                'is_primary' => ! BankAccount::where('user_id', $user->id)->exists(),
            ]);

            // Only a real change restarts the monthly lock — first adds and
            // identical re-saves leave bank_changed_at untouched.
            if ($existing !== null && ! $isSameAccount) {
                $user->forceFill(['bank_changed_at' => now()])->save();
            }

            $verification->approve($user); // Auto-approve bank verification

            AuditLog::log('kyc.bank_saved', $user, $user);

            return $bankAccount;
        });
    }

    // ── Emergency Contact ────────────────────────────────────

    /**
     * Save emergency contact (Step 7).
     */
    public function saveEmergencyContact(
        User $user,
        string $fullName,
        string $phoneNumber,
        string $relationship,
        ?string $otherRelationship = null,
    ): EmergencyContact {
        return DB::transaction(function () use ($user, $fullName, $phoneNumber, $relationship, $otherRelationship) {
            $verification = $this->getOrCreateVerification($user, KycVerificationType::EmergencyContact);

            // Delete old contacts for this verification
            EmergencyContact::where('kyc_verification_id', $verification->id)->delete();

            $contact = EmergencyContact::create([
                'user_id' => $user->id,
                'kyc_verification_id' => $verification->id,
                'full_name' => $fullName,
                'phone_number' => $phoneNumber,
                'relationship' => $relationship,
                'other_relationship' => $otherRelationship,
            ]);

            $verification->approve($user); // Auto-approve emergency contact

            AuditLog::log('kyc.emergency_contact_saved', $user, $user);

            return $contact;
        });
    }

    // ── Final Submission ─────────────────────────────────────

    /**
     * Submit the entire KYC application for admin review.
     */
    public function submitForReview(User $user): void
    {
        DB::transaction(function () use ($user) {
            // Mark all pending verifications as pending_review
            KycVerification::where('user_id', $user->id)
                ->where('status', 'draft')
                ->update(['status' => KycStatus::PendingReview->value]);

            $user->update([
                'kyc_status' => KycStatus::PendingReview->value,
                'kyc_submitted_at' => now(),
            ]);

            AuditLog::log('kyc.submitted_for_review', $user, $user);
        });
    }

    // ── Admin Review ─────────────────────────────────────────

    /**
     * Approve a specific verification type.
     */
    public function approveVerification(User $reviewer, string $verificationId, ?string $notes = null): KycVerification
    {
        return DB::transaction(function () use ($reviewer, $verificationId, $notes) {
            /** @var KycVerification $verification */
            $verification = KycVerification::findOrFail($verificationId);
            $verification->approve($reviewer, $notes);

            $this->syncUserKycStatus($verification->user);

            AuditLog::log(
                action: 'kyc.verification_approved',
                actor: $verification->user,
                model: $verification,
                metadata: ['notes' => $notes, 'reviewed_by' => $reviewer->id],
            );

            // Send push notification
            $this->fcm->notifyUser(
                userId: $verification->user_id,
                title: 'KYC Approved ✅',
                body: 'Your '.$verification->type.' verification has been approved.',
                data: ['type' => 'kyc_approved', 'verification_id' => $verification->id],
            );

            return $verification;
        });
    }

    /**
     * Reject a verification type.
     */
    public function rejectVerification(
        User $reviewer,
        string $verificationId,
        string $reason,
        string $category,
        ?string $notes = null,
    ): KycVerification {
        return DB::transaction(function () use ($reviewer, $verificationId, $reason, $category, $notes) {
            /** @var KycVerification $verification */
            $verification = KycVerification::findOrFail($verificationId);
            $verification->reject($reviewer, $reason, $category, $notes);

            $this->syncUserKycStatus($verification->user);

            AuditLog::log(
                action: 'kyc.verification_rejected',
                actor: $verification->user, // The KYC user gets the notification
                model: $verification,
                metadata: [
                    'reason' => $reason,
                    'category' => $category,
                    'notes' => $notes,
                    'reviewed_by' => $reviewer->id,
                ],
            );

            // Send push notification
            $this->fcm->notifyUser(
                userId: $verification->user_id,
                title: 'KYC Rejected ❌',
                body: "Your {$verification->type} verification was rejected: {$reason}",
                data: ['type' => 'kyc_rejected', 'verification_id' => $verification->id],
            );

            return $verification;
        });
    }

    /**
     * Request resubmission for a verification type.
     */
    public function requestResubmission(
        User $reviewer,
        string $verificationId,
        string $reason,
        string $category,
        ?string $notes = null,
    ): KycVerification {
        return DB::transaction(function () use ($reviewer, $verificationId, $reason, $category, $notes) {
            /** @var KycVerification $verification */
            $verification = KycVerification::findOrFail($verificationId);
            $verification->requestResubmission($reviewer, $reason, $category, $notes);

            $this->syncUserKycStatus($verification->user);

            AuditLog::log(
                action: 'kyc.resubmission_requested',
                actor: $verification->user, // The KYC user gets the notification
                model: $verification,
                metadata: [
                    'reason' => $reason,
                    'category' => $category,
                    'notes' => $notes,
                    'reviewed_by' => $reviewer->id,
                ],
            );

            // Send push notification
            $this->fcm->notifyUser(
                userId: $verification->user_id,
                title: 'KYC Resubmission Required 📝',
                body: "Your {$verification->type} verification needs to be resubmitted: {$reason}",
                data: ['type' => 'kyc_resubmission', 'verification_id' => $verification->id],
            );

            return $verification;
        });
    }

    // ── Queries ──────────────────────────────────────────────

    /**
     * Get the user's full KYC status with all verifications.
     */
    public function getKycStatus(User $user): array
    {
        $verifications = KycVerification::where('user_id', $user->id)
            ->with(['documents', 'emergencyContact', 'bankAccount'])
            ->get();

        $bankAccount = BankAccount::where('user_id', $user->id)->first();
        $emergencyContact = EmergencyContact::where('user_id', $user->id)->first();

        // Calculate completion percentage
        $steps = [
            'profile' => $user->first_name && $user->last_name && $user->date_of_birth,
            'phone' => $user->phone_verified_at !== null,
            'email' => $user->email_verified_at !== null,
            'identity' => $verifications->firstWhere('type', KycVerificationType::Identity->value)?->status === KycStatus::Approved->value,
            'selfie' => $verifications->firstWhere('type', KycVerificationType::Selfie->value)?->status === KycStatus::Approved->value,
            'bank' => $bankAccount !== null,
            'emergency_contact' => $emergencyContact !== null,
        ];

        $completed = count(array_filter($steps));
        $progress = round(($completed / count($steps)) * 100);

        return [
            'kyc_status' => $user->kyc_status,
            'kyc_tier' => $user->kyc_tier,
            'kyc_submitted_at' => $user->kyc_submitted_at instanceof Carbon ? $user->kyc_submitted_at->toISOString() : $user->kyc_submitted_at,
            'kyc_approved_at' => $user->kyc_approved_at instanceof Carbon ? $user->kyc_approved_at->toISOString() : $user->kyc_approved_at,
            'progress' => $progress,
            'steps' => $steps,
            'verifications' => $verifications->map(fn (KycVerification $v) => [
                'id' => $v->id,
                'type' => $v->type,
                'status' => $v->status,
                'rejection_reason' => $v->rejection_reason,
                'rejection_category' => $v->rejection_category,
                'reviewed_at' => $v->reviewed_at?->toISOString(),
                'review_notes' => $v->review_notes,
                'attempt' => $v->attempt,
                'has_documents' => $v->documents->isNotEmpty(),
                'documents' => $v->documents->map(fn (KycDocument $d) => [
                    'id' => $d->id,
                    'document_type' => $d->document_type,
                    'document_number' => $d->document_number,
                    'front_image_url' => $d->front_image_url,
                    'back_image_url' => $d->back_image_url,
                    'file_type' => $d->file_type,
                    'created_at' => $d->created_at->toISOString(),
                ])->values(),
                'bank_account' => $v->bankAccount ? [
                    'id' => $v->bankAccount->id,
                    'bank_name' => $v->bankAccount->bank_name,
                    'account_number' => $v->bankAccount->maskedAccountNumber(),
                    'account_name' => $v->bankAccount->account_name,
                    'is_verified' => $v->bankAccount->is_verified,
                ] : null,
                'emergency_contact' => $v->emergencyContact ? [
                    'id' => $v->emergencyContact->id,
                    'full_name' => $v->emergencyContact->full_name,
                    'phone_number' => $v->emergencyContact->phone_number,
                    'relationship' => $v->emergencyContact->relationship,
                ] : null,
                'created_at' => $v->created_at->toISOString(),
            ])->values(),
        ];
    }

    /**
     * Get all pending KYC applications for admin review.
     */
    public function getPendingReviews(int $perPage = 20): array
    {
        $paginator = User::whereIn('kyc_status', [
            KycStatus::PendingReview->value,
            KycStatus::UnderReview->value,
        ])
            ->with(['kycVerifications.documents', 'kycVerifications.emergencyContact', 'kycVerifications.bankAccount'])
            ->orderBy('kyc_submitted_at', 'asc')
            ->paginate($perPage);

        return [
            'data' => $paginator->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role->value,
                'kyc_status' => $user->kyc_status,
                'kyc_tier' => $user->kyc_tier,
                'kyc_submitted_at' => $user->kyc_submitted_at instanceof Carbon ? $user->kyc_submitted_at->toISOString() : $user->kyc_submitted_at,
                'verifications' => $user->kycVerifications->map(fn (KycVerification $v) => [
                    'id' => $v->id,
                    'type' => $v->type,
                    'status' => $v->status,
                    'attempt' => $v->attempt,
                    'documents' => $v->documents->map(fn (KycDocument $d) => [
                        'id' => $d->id,
                        'document_type' => $d->document_type,
                        'document_number' => $d->document_number,
                        'front_image_url' => $d->front_image_url,
                        'back_image_url' => $d->back_image_url,
                    ])->values(),
                    'created_at' => $v->created_at->toISOString(),
                ])->values(),
            ])->values()->toArray(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    // ── Private Helpers ──────────────────────────────────────

    private function getOrCreateVerification(User $user, KycVerificationType $type): KycVerification
    {
        $verification = KycVerification::where('user_id', $user->id)
            ->where('type', $type->value)
            ->first();

        if (! $verification) {
            $verification = KycVerification::create([
                'user_id' => $user->id,
                'type' => $type->value,
                'status' => KycStatus::Draft->value,
            ]);
        }

        return $verification;
    }

    /**
     * Upload a KYC document to the environment-appropriate disk
     * (public locally, S3 in production).
     *
     * @return array{path: string, url: string}
     */
    private function uploadDocument(User $user, UploadedFile $file, string $directory): array
    {
        return $this->uploadService->uploadKycDocument($file, $directory, $user->id);
    }

    /**
     * Delete a verification's documents — both the files and the DB records.
     */
    private function deleteVerificationDocuments(KycVerification $verification): void
    {
        $paths = $verification->documents->flatMap(
            fn (KycDocument $document) => array_filter([
                $document->front_image_path,
                $document->back_image_path,
            ])
        );

        $verification->documents()->delete();

        foreach ($paths as $path) {
            $this->uploadService->delete($path);
        }
    }

    /**
     * Sync the user's kyc_status based on all verification statuses.
     */
    private function syncUserKycStatus(User $user): void
    {
        $verifications = KycVerification::where('user_id', $user->id)->get();

        if ($verifications->isEmpty()) {
            return;
        }

        $hasRejected = $verifications->contains('status', KycStatus::Rejected->value);
        $hasPending = $verifications->contains(fn ($v) => in_array($v->status, [
            KycStatus::PendingReview->value,
            KycStatus::UnderReview->value,
            KycStatus::Draft->value,
        ]));
        $allApproved = $verifications->every('status', KycStatus::Approved->value);

        if ($hasRejected) {
            $user->update(['kyc_status' => KycStatus::Rejected->value]);
        } elseif ($hasPending) {
            // Keep as pending_review
        } elseif ($allApproved) {
            $user->update([
                'kyc_status' => KycStatus::Approved->value,
                'kyc_approved_at' => now(),
                'kyc_tier' => max($user->kyc_tier, 1), // Promote to at least tier 1
            ]);
        }
    }
}
