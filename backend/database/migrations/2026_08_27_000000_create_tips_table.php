<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tips', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('bid_id')->unique();
            $table->foreign('bid_id')->references('id')->on('bids');
            $table->uuid('request_id');
            $table->foreign('request_id')->references('id')->on('requests');
            $table->uuid('requester_id');
            $table->foreign('requester_id')->references('id')->on('users');
            $table->uuid('errander_id');
            $table->foreign('errander_id')->references('id')->on('users');
            $table->decimal('amount', 15, 2);
            $table->string('reference', 60);
            $table->timestamps();

            $table->index('requester_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tips');
    }
};
