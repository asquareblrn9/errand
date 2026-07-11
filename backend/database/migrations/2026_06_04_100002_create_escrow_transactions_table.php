<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('escrow_transactions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('bid_id');
            $table->foreign('bid_id')->references('id')->on('bids');
            $table->uuid('request_id');
            $table->foreign('request_id')->references('id')->on('requests');
            $table->uuid('requester_id');
            $table->foreign('requester_id')->references('id')->on('users');
            $table->uuid('errander_id');
            $table->foreign('errander_id')->references('id')->on('users');
            $table->decimal('amount', 15, 2);
            $table->jsonb('breakdown');
            $table->string('status', 20)->default('held');
            $table->timestamp('held_at')->useCurrent();
            $table->timestamp('released_at')->nullable();
            $table->string('release_trigger', 20)->nullable();
            $table->timestamps();

            $table->index('bid_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('escrow_transactions');
    }
};
