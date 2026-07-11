<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Widen two_factor_secret from VARCHAR(255) to TEXT.
     *
     * Laravel's encrypt() produces base64-encoded JSON that exceeds
     * 255 characters, so the column must be TEXT to store it.
     */
    public function up(): void
    {
        Schema::table('users', function ($table) {
            $table->text('two_factor_secret')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function ($table) {
            $table->string('two_factor_secret', 255)->nullable()->change();
        });
    }
};
