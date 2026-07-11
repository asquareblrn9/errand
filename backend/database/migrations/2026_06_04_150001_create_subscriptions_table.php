<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->foreign('user_id')->references('id')->on('users');
            $table->uuid('plan_id');
            $table->foreign('plan_id')->references('id')->on('plans');
            $table->string('status', 20)->default('active');
            $table->string('billing_cycle', 10)->default('monthly');
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('expires_at');
            $table->timestamp('cancelled_at')->nullable();
            $table->boolean('auto_renew')->default(true);
            $table->string('payment_provider', 20)->nullable();
            $table->string('provider_subscription_id', 100)->nullable();
            $table->timestamps();
            $table->index('user_id');
            $table->index('status');
            $table->index('expires_at');
        });
    }

    public function down()
    {
        Schema::dropIfExists('subscriptions');
    }
};
