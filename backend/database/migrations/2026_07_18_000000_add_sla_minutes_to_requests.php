<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requests', function (Blueprint $table): void {
            $table->unsignedInteger('sla_minutes')->nullable()->after('is_urgent')
                ->comment('Requester-specified delivery timeframe in minutes. Null = use platform default.');
        });
    }

    public function down(): void
    {
        Schema::table('requests', function (Blueprint $table): void {
            $table->dropColumn('sla_minutes');
        });
    }
};
