<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        Plan::firstOrCreate(['slug' => 'free'], [
            'name' => 'Free', 'monthly_price' => 0, 'annual_price' => 0,
            'features' => ['5 active requests', 'Basic support'],
            'limits' => ['active_requests' => 5, 'urgent_requests_per_month' => 0],
            'sort_order' => 0,
        ]);

        Plan::firstOrCreate(['slug' => 'pro'], [
            'name' => 'Pro', 'monthly_price' => 5000, 'annual_price' => 48000,
            'features' => ['20 active requests', '5 urgent requests/mo', '0% withdrawal fee', 'Priority support', 'Basic analytics'],
            'limits' => ['active_requests' => 20, 'urgent_requests_per_month' => 5],
            'sort_order' => 1,
        ]);

        Plan::firstOrCreate(['slug' => 'business'], [
            'name' => 'Business', 'monthly_price' => 25000, 'annual_price' => 240000,
            'features' => ['Unlimited requests', '20 urgent requests/mo', '0% withdrawal fee', 'Priority support', 'Advanced analytics', 'API access', 'Up to 10 team members'],
            'limits' => ['active_requests' => -1, 'urgent_requests_per_month' => 20, 'team_members' => 10],
            'sort_order' => 2,
        ]);

        $this->command?->info('Plans seeded.');
    }
}
