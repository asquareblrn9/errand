<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ratings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('request_id');
            $table->foreign('request_id')->references('id')->on('requests');
            $table->uuid('bid_id');
            $table->foreign('bid_id')->references('id')->on('bids');
            $table->uuid('reviewer_id');
            $table->foreign('reviewer_id')->references('id')->on('users');
            $table->uuid('reviewee_id');
            $table->foreign('reviewee_id')->references('id')->on('users');
            $table->integer('rating');
            $table->text('review')->nullable();
            $table->jsonb('aspects')->nullable()->default('{}');
            $table->boolean('is_visible')->default(false);
            $table->text('response')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamp('visible_at')->nullable();
            $table->timestamps();
            $table->unique(['bid_id', 'reviewer_id']);
            $table->index('reviewee_id');
            $table->index('is_visible');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ratings');
    }
};
