<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispute_evidence', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('dispute_id');
            $table->foreign('dispute_id')->references('id')->on('disputes')->onDelete('cascade');
            $table->uuid('uploaded_by');
            $table->string('type', 20);
            $table->string('path', 500);
            $table->string('url', 500);
            $table->timestamps();

            $table->index('dispute_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispute_evidence');
    }
};
