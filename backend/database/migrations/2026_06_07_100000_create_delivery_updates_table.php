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
        Schema::create('delivery_updates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('delivery_id');
            $table->uuid('request_id');
            $table->uuid('user_id');
            $table->string('type', 50); // heading_to_pickup, item_purchased, on_the_way, traffic_delay, arrived, completed, custom
            $table->text('message');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('photo_url', 500)->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamps();

            $table->foreign('delivery_id')->references('id')->on('deliveries')->cascadeOnDelete();
            $table->foreign('request_id')->references('id')->on('requests')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index('request_id');
            $table->index('created_at');
        });

        // Add delivery tracking fields to deliveries table
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->timestamp('started_at')->nullable()->after('confirmed_at');
            $table->timestamp('completed_at')->nullable()->after('started_at');
            $table->integer('sla_minutes')->default(120)->after('completed_at');
            $table->decimal('late_fee_per_hour', 10, 2)->default(100.00)->after('sla_minutes');
            $table->decimal('late_fee_max', 10, 2)->default(2000.00)->after('late_fee_per_hour');
            $table->integer('grace_period_minutes')->default(10)->after('late_fee_max');
            $table->decimal('late_fee_accrued', 10, 2)->default(0)->after('grace_period_minutes');
            $table->timestamp('deadline_at')->nullable()->after('late_fee_accrued');
        });

        // Seed delivery settings
        $now = now()->toISOString();
        DB::table('platform_settings')->insert([
            ['key' => 'delivery_late_fee_per_hour', 'value' => '100', 'type' => 'float', 'group' => 'delivery', 'label' => 'Late Fee Per Hour (₦)', 'description' => 'Fee charged per hour of late delivery', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'delivery_late_fee_max', 'value' => '2000', 'type' => 'float', 'group' => 'delivery', 'label' => 'Maximum Late Fee (₦)', 'description' => 'Cap on total late fees', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'delivery_grace_period_minutes', 'value' => '10', 'type' => 'integer', 'group' => 'delivery', 'label' => 'Grace Period (minutes)', 'description' => 'Free minutes before late fee starts', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'delivery_default_sla_minutes', 'value' => '120', 'type' => 'integer', 'group' => 'delivery', 'label' => 'Default Delivery SLA (minutes)', 'description' => 'Standard delivery completion time', 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_updates');
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropColumn(['started_at', 'completed_at', 'sla_minutes', 'late_fee_per_hour', 'late_fee_max', 'grace_period_minutes', 'late_fee_accrued', 'deadline_at']);
        });
        DB::table('platform_settings')->whereIn('key', [
            'delivery_late_fee_per_hour', 'delivery_late_fee_max', 'delivery_grace_period_minutes', 'delivery_default_sla_minutes',
        ])->delete();
    }
};
