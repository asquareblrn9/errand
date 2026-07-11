<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('request_id')->unique();
            $table->foreign('request_id')->references('id')->on('requests')->onDelete('cascade');
            $table->uuid('requester_id');
            $table->foreign('requester_id')->references('id')->on('users');
            $table->uuid('errander_id');
            $table->foreign('errander_id')->references('id')->on('users');
            $table->timestamp('last_message_at')->nullable();
            $table->string('last_message_preview', 150)->nullable();
            $table->integer('requester_unread_count')->default(0);
            $table->integer('errander_unread_count')->default(0);
            $table->string('status', 20)->default('active');
            $table->timestamps();

            $table->index('requester_id');
            $table->index('errander_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
