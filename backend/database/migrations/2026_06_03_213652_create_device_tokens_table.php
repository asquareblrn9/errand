<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the device_tokens table.
     *
     * Stores FCM push notification tokens per device.
     * A user can have multiple devices (phone, tablet) —
     * each device gets its own token record.
     *
     * Tokens are unique per (user_id, token) to prevent
     * duplicate registrations.
     */
    public function up(): void
    {
        Schema::create('device_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');
            $table->string('token', 500);
            $table->string('device_type', 20)->nullable()->comment('android, ios, web');
            $table->string('device_name', 100)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'token']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
    }
};
