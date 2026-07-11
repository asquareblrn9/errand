<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payouts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('errander_id');
            $table->foreign('errander_id')->references('id')->on('users');
            $table->uuid('bid_id');
            $table->foreign('bid_id')->references('id')->on('bids');
            $table->uuid('escrow_transaction_id')->nullable();
            $table->foreign('escrow_transaction_id')->references('id')->on('escrow_transactions');
            $table->decimal('amount', 15, 2);
            $table->decimal('fee', 15, 2)->default(0.00);
            $table->decimal('net_amount', 15, 2);
            $table->string('status', 20)->default('pending');
            $table->string('provider', 20)->default('flutterwave');
            $table->string('provider_ref', 100)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('errander_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payouts');
    }
};
