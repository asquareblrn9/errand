<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\BidStatus;
use App\Models\Bid;
use App\Models\Request;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Bid>
 */
class BidFactory extends Factory
{
    protected $model = Bid::class;

    public function definition(): array
    {
        $goods = fake()->randomFloat(2, 500, 50000);
        $fee = fake()->randomFloat(2, 500, 5000);
        $platform = round(($goods + $fee) * 0.05, 2);

        return [
            'request_id' => Request::factory(),
            'errander_id' => User::factory()->errander(),
            'goods_amount' => $goods,
            'service_fee' => $fee,
            'platform_fee' => $platform,
            'total_amount' => $goods + $fee + $platform,
            'status' => BidStatus::Pending,
            'delivery_at' => now()->addHours(fake()->numberBetween(1, 48)),
        ];
    }
}
