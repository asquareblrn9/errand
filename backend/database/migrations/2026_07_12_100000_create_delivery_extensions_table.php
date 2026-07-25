<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_extensions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('delivery_id');
            $table->uuid('request_id');
            $table->uuid('requested_by');
            $table->integer('additional_minutes');
            $table->text('reason');
            $table->string('status', 20)->default('pending'); // pending, approved, rejected
            $table->uuid('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->foreign('delivery_id')->references('id')->on('deliveries')->cascadeOnDelete();
            $table->foreign('requested_by')->references('id')->on('users');
            $table->index('delivery_id');
        });

        // Seed late threshold setting
        $now = now()->toISOString();
        DB::table('platform_settings')->insertOrIgnore([
            ['key' => 'delivery_late_threshold_pct', 'value' => '40', 'type' => 'integer', 'group' => 'delivery', 'label' => 'Late Threshold (%)', 'description' => 'Percentage of SLA elapsed before requester can cancel', 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_extensions');
        DB::table('platform_settings')->where('key', 'delivery_late_threshold_pct')->delete();
    }
};
