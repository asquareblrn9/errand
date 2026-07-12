<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table): void {
            $table->string('key', 100)->primary();
            $table->text('value');
            $table->string('type', 20)->default('string'); // string, integer, float, boolean, json
            $table->string('group', 50)->default('general'); // general, commission, kyc, notification
            $table->string('label', 200)->nullable();
            $table->string('description', 500)->nullable();
            $table->timestamps();
        });

        // Seed default settings
        $now = now()->toISOString();
        DB::table('platform_settings')->insert([
            // Commission
            ['key' => 'platform_commission_pct', 'value' => '5', 'type' => 'float', 'group' => 'commission', 'label' => 'Platform Commission (%)', 'description' => 'Percentage taken from each completed request', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'withdrawal_fee_pct', 'value' => '1.5', 'type' => 'float', 'group' => 'commission', 'label' => 'Withdrawal Fee (%)', 'description' => 'Fee charged on withdrawals', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'withdrawal_fee_cap', 'value' => '200', 'type' => 'float', 'group' => 'commission', 'label' => 'Withdrawal Fee Cap (₦)', 'description' => 'Maximum withdrawal fee in Naira', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'min_withdrawal', 'value' => '1000', 'type' => 'float', 'group' => 'commission', 'label' => 'Minimum Withdrawal (₦)', 'description' => null, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'min_wallet_fund', 'value' => '1000', 'type' => 'float', 'group' => 'commission', 'label' => 'Minimum Wallet Fund (₦)', 'description' => null, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'urgent_fee', 'value' => '1500', 'type' => 'float', 'group' => 'commission', 'label' => 'Urgent Request Fee (₦)', 'description' => 'Extra fee for urgent requests', 'created_at' => $now, 'updated_at' => $now],

            // General
            ['key' => 'platform_name', 'value' => 'Errand Boy', 'type' => 'string', 'group' => 'general', 'label' => 'Platform Name', 'description' => null, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'support_email', 'value' => 'support@errandboy.ng', 'type' => 'string', 'group' => 'general', 'label' => 'Support Email', 'description' => null, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'support_phone', 'value' => '+2348000000000', 'type' => 'string', 'group' => 'general', 'label' => 'Support Phone', 'description' => null, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'currency', 'value' => 'NGN', 'type' => 'string', 'group' => 'general', 'label' => 'Currency', 'description' => null, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'timezone', 'value' => 'Africa/Lagos', 'type' => 'string', 'group' => 'general', 'label' => 'Timezone', 'description' => null, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
    }
};
