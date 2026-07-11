<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('bid_id');
            $table->foreign('bid_id')->references('id')->on('bids');
            $table->uuid('request_id');
            $table->foreign('request_id')->references('id')->on('requests');
            $table->uuid('user_id');
            $table->foreign('user_id')->references('id')->on('users');
            $table->string('provider', 20);
            $table->string('provider_ref', 100)->nullable()->unique();
            $table->decimal('amount', 15, 2);
            $table->jsonb('breakdown');
            $table->string('currency', 3)->default('NGN');
            $table->string('status', 20)->default('pending');
            $table->string('payment_method', 50)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->jsonb('metadata')->nullable()->default('{}');
            $table->integer('retry_count')->default(0);
            $table->timestamps();

            $table->index('bid_id');
            $table->index('user_id');
            $table->index('provider_ref');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
