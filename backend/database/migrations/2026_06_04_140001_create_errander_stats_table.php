<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('errander_stats', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->unique();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->integer('total_bids_submitted')->default(0);
            $table->integer('total_bids_accepted')->default(0);
            $table->integer('completed_orders')->default(0);
            $table->integer('cancelled_orders')->default(0);
            $table->integer('on_time_deliveries')->default(0);
            $table->integer('late_deliveries')->default(0);
            $table->integer('disputes_received')->default(0);
            $table->integer('disputes_lost')->default(0);
            $table->decimal('completion_rate', 5, 2)->default(0);
            $table->decimal('average_rating', 3, 2)->default(0);
            $table->decimal('on_time_percentage', 5, 2)->default(0);
            $table->decimal('trust_score', 3, 2)->default(0);
            $table->decimal('total_value_handled', 15, 2)->default(0);
            $table->integer('average_response_time_seconds')->default(0);
            $table->timestamp('last_completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('errander_stats');
    }
};
