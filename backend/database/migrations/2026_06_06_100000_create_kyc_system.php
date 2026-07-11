<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * KYC & Verification System
     *
     * Adds KYC profile columns to users and creates the supporting
     * tables: kyc_verifications, kyc_documents, emergency_contacts,
     * and bank_accounts.
     */
    public function up(): void
    {
        // ── KYC Profile Columns on Users ──────────────────────
        Schema::table('users', function (Blueprint $table): void {
            $table->string('first_name', 100)->nullable()->after('name');
            $table->string('last_name', 100)->nullable()->after('first_name');
            $table->string('middle_name', 100)->nullable()->after('last_name');
            $table->date('date_of_birth')->nullable()->after('middle_name');
            $table->string('gender', 20)->nullable()->after('date_of_birth');
            $table->string('residential_address', 500)->nullable()->after('avatar_url');
            $table->string('state', 100)->nullable()->after('residential_address');
            $table->string('lga', 100)->nullable()->after('state');
            $table->string('kyc_status', 20)->default('draft')->after('kyc_tier');
            $table->timestamp('kyc_submitted_at')->nullable()->after('kyc_status');
            $table->timestamp('kyc_approved_at')->nullable()->after('kyc_submitted_at');
            $table->uuid('kyc_reviewed_by')->nullable()->after('kyc_approved_at');

            // Indexes
            $table->index('kyc_status');
        });

        // ── KYC Verifications ─────────────────────────────────
        Schema::create('kyc_verifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('type', 50); // identity, selfie, bank, emergency_contact
            $table->string('status', 20)->default('draft'); // draft, pending_review, under_review, approved, rejected, requires_resubmission
            $table->text('rejection_reason')->nullable();
            $table->string('rejection_category', 50)->nullable(); // blurry_document, id_mismatch, invalid_info, expired_document, other
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->unsignedInteger('attempt')->default(1);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index('user_id');
            $table->index('status');
            $table->index('type');
        });

        // ── KYC Documents ─────────────────────────────────────
        Schema::create('kyc_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('kyc_verification_id');
            $table->enum('document_type', ['nin', 'drivers_license', 'voters_card', 'international_passport']);
            $table->string('document_number', 100);
            $table->string('front_image_path', 500);
            $table->string('front_image_url', 500)->nullable();
            $table->string('back_image_path', 500)->nullable();
            $table->string('back_image_url', 500)->nullable();
            $table->string('file_type', 10)->default('image'); // image, pdf
            $table->unsignedInteger('file_size')->nullable(); // bytes
            $table->string('original_filename', 255)->nullable();
            $table->timestamps();

            $table->foreign('kyc_verification_id')->references('id')->on('kyc_verifications')->cascadeOnDelete();
            $table->index('document_number');
        });

        // ── Emergency Contacts ────────────────────────────────
        Schema::create('emergency_contacts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('kyc_verification_id');
            $table->string('full_name', 200);
            $table->string('phone_number', 20);
            $table->enum('relationship', ['parent', 'sibling', 'friend', 'spouse', 'other']);
            $table->string('other_relationship', 100)->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('kyc_verification_id')->references('id')->on('kyc_verifications')->cascadeOnDelete();
            $table->index('user_id');
        });

        // ── Bank Accounts ─────────────────────────────────────
        Schema::create('bank_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('kyc_verification_id');
            $table->string('bank_name', 100);
            $table->string('bank_code', 20);
            $table->string('account_number', 20);
            $table->string('account_name', 200);
            $table->boolean('is_verified')->default(false);
            $table->string('paystack_recipient_code', 100)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index('user_id');
            $table->unique(['user_id', 'account_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
        Schema::dropIfExists('emergency_contacts');
        Schema::dropIfExists('kyc_documents');
        Schema::dropIfExists('kyc_verifications');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'first_name', 'last_name', 'middle_name',
                'date_of_birth', 'gender',
                'residential_address', 'state', 'lga',
                'kyc_status', 'kyc_submitted_at', 'kyc_approved_at', 'kyc_reviewed_by',
            ]);
        });
    }
};
