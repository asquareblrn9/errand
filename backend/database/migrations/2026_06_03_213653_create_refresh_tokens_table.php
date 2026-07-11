<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the refresh_tokens table.
     *
     * Implements refresh token rotation:
     *  - Each refresh token belongs to an access token (via Sanctum).
     *  - When a refresh token is used, it is revoked and a new
     *    access + refresh pair is issued.
     *  - If a revoked refresh token is reused (token theft detection),
     *    the entire token family is revoked.
     *
     * The token_family groups all refresh tokens issued from the
     * same original login, enabling family-wide revocation.
     */
    public function up(): void
    {
        Schema::create('refresh_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('access_token_id');
            $table->foreign('access_token_id')
                ->references('id')
                ->on('personal_access_tokens')
                ->onDelete('cascade');
            $table->uuid('user_id');
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');
            $table->string('token', 100)->unique();
            $table->string('token_family', 100)->index();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index('access_token_id');
            $table->index('user_id');
            $table->index('revoked_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
    }
};
