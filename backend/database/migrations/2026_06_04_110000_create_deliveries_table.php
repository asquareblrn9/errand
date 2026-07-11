<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deliveries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('bid_id')->unique();
            $table->foreign('bid_id')->references('id')->on('bids');
            $table->uuid('request_id');
            $table->foreign('request_id')->references('id')->on('requests');
            $table->uuid('errander_id');
            $table->foreign('errander_id')->references('id')->on('users');
            $table->string('otp_hash')->nullable();
            $table->timestamp('otp_generated_at')->nullable();
            $table->timestamp('otp_expires_at')->nullable();
            $table->integer('otp_attempts')->default(0);
            $table->integer('max_otp_attempts')->default(3);
            $table->boolean('confirmed')->default(false);
            $table->timestamp('confirmed_at')->nullable();
            $table->uuid('confirmed_by')->nullable();
            $table->integer('dispute_window_hours');
            $table->timestamp('dispute_window_closes_at')->nullable();
            $table->string('proof_photo_path', 500)->nullable();
            $table->string('proof_photo_url', 500)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('bid_id');
            $table->index('confirmed');
            $table->index('dispute_window_closes_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliveries');
    }
};
