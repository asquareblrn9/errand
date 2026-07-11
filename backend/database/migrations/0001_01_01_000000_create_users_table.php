<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the core users table with UUID primary key.
     *
     * Columns support:
     *  - Multiple auth factors (email, phone, 2FA)
     *  - Role-based access (via Spatie — the 'role' column is a
     *    convenience default; the source of truth is Spatie's
     *    model_has_roles pivot)
     *  - KYC tier tracking (0-3, denormalized for fast queries)
     *  - Account status (active, suspended, banned, deleted)
     *  - Device/push notification support
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 200);
            $table->string('email', 255)->unique();
            $table->string('phone', 20)->nullable()->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('phone_verified_at')->nullable();
            $table->string('password');
            $table->string('role', 20)->default('requester');
            $table->string('status', 20)->default('active');
            $table->unsignedTinyInteger('kyc_tier')->default(0);
            $table->string('avatar_path', 500)->nullable();
            $table->string('avatar_url', 500)->nullable();
            $table->string('fcm_token', 500)->nullable();
            $table->string('device_type', 20)->nullable();
            $table->string('device_name', 100)->nullable();
            $table->boolean('is_online')->default(false);
            $table->timestamp('last_location_update')->nullable();
            $table->boolean('two_factor_enabled')->default(false);
            $table->string('two_factor_secret', 255)->nullable();
            $table->unsignedInteger('completed_orders')->default(0);
            $table->timestamp('banned_at')->nullable();
            $table->text('ban_reason')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index('role');
            $table->index('status');
            $table->index('kyc_tier');
            $table->index('created_at');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table): void {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->uuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
