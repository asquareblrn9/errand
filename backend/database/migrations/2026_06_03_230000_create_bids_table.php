<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the bids table.
     *
     * Erranders submit bids on open requests. Each errander can only
     * bid once per request (unique constraint). When a bid is accepted,
     * all other bids on the same request are auto-rejected.
     */
    public function up(): void
    {
        Schema::create('bids', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('request_id');
            $table->foreign('request_id')->references('id')->on('requests')->onDelete('cascade');
            $table->uuid('errander_id');
            $table->foreign('errander_id')->references('id')->on('users')->onDelete('cascade');
            $table->decimal('goods_amount', 15, 2);
            $table->decimal('service_fee', 15, 2);
            $table->decimal('platform_fee', 15, 2);
            $table->decimal('total_amount', 15, 2);
            $table->text('note')->nullable();
            $table->timestamp('delivery_at')->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamps();

            $table->unique(['request_id', 'errander_id']);
            $table->index('request_id');
            $table->index('errander_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bids');
    }
};
