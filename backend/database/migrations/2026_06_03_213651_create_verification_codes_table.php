<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the verification_codes table.
     *
     * Stores time-limited OTP codes for:
     *  - Email verification
     *  - Phone verification
     *  - Password reset codes (application-managed, separate from
     *    Laravel's built-in password_reset_tokens)
     *  - Two-factor authentication codes
     *
     * Codes are also written to Redis with TTL matching expires_at.
     * Redis is the primary check path; DB is the fallback and audit record.
     */
    public function up(): void
    {
        Schema::create('verification_codes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');
            $table->string('type', 30);
            $table->string('code', 10);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            // Fast lookup for verification attempts
            $table->index(['user_id', 'type', 'code']);
            $table->index(['user_id', 'type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verification_codes');
    }
};
