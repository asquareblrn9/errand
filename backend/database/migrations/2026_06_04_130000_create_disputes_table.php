<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disputes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('delivery_id');
            $table->foreign('delivery_id')->references('id')->on('deliveries');
            $table->uuid('bid_id');
            $table->foreign('bid_id')->references('id')->on('bids');
            $table->uuid('request_id');
            $table->foreign('request_id')->references('id')->on('requests');
            $table->uuid('raised_by');
            $table->foreign('raised_by')->references('id')->on('users');
            $table->uuid('errander_id');
            $table->foreign('errander_id')->references('id')->on('users');
            $table->string('reason', 200);
            $table->text('description');
            $table->string('status', 30)->default('open');
            $table->text('errander_response')->nullable();
            $table->text('resolution_note')->nullable();
            $table->uuid('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->boolean('is_appeal')->default(false);
            $table->uuid('parent_dispute_id')->nullable();
            $table->timestamps();

            $table->index('delivery_id');
            $table->index('status');
            $table->index('raised_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disputes');
    }
};
