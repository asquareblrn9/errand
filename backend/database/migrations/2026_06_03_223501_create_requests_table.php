<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the requests table.
     *
     * Core marketplace entity. A requester posts a request;
     * erranders bid on it. Status flows: draft → open → assigned
     * → in_progress → delivered → completed (or disputed → refunded).
     */
    public function up(): void
    {
        Schema::create('requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->uuid('category_id');
            $table->foreign('category_id')->references('id')->on('categories')->onDelete('restrict');
            $table->uuid('company_id')->nullable()->comment('FK to companies — added in Phase 11');
            $table->string('title', 200);
            $table->text('description');
            $table->string('location', 255);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('budget_hint', 15, 2)->nullable();
            $table->string('status', 20)->default('draft');
            $table->boolean('is_urgent')->default(false);
            $table->decimal('urgent_fee', 10, 2)->default(0.00);
            $table->uuid('accepted_bid_id')->nullable();
            $table->timestamp('delivery_confirmed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->jsonb('metadata')->nullable()->default('{}');
            $table->timestamps();

            // Indexes
            $table->index('user_id');
            $table->index('category_id');
            $table->index('status');
            $table->index(['latitude', 'longitude']);
            $table->index('is_urgent');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('requests');
    }
};
