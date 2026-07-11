<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 200);
            $table->string('slug', 100)->unique();
            $table->string('industry', 100)->nullable();
            $table->string('rc_number', 50)->nullable();
            $table->string('tax_id', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('website')->nullable();
            $table->string('logo_path', 500)->nullable();
            $table->string('logo_url', 500)->nullable();
            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('country', 100)->default('Nigeria');
            $table->uuid('owner_id');
            $table->foreign('owner_id')->references('id')->on('users');
            $table->string('status', 20)->default('active');
            $table->jsonb('settings')->nullable()->default('{}');
            $table->timestamps();
            $table->index('owner_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
