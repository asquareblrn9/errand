<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\RequestStatus;
use App\Models\Category;
use App\Models\Request;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Request>
 */
class RequestFactory extends Factory
{
    protected $model = Request::class;

    public function definition(): array
    {
        return [
            'user_id' => (string) \Illuminate\Support\Str::orderedUuid(),
            'category_id' => Category::factory(),
            'title' => fake()->sentence(4),
            'description' => fake()->paragraph(),
            'location' => fake()->city() . ', Nigeria',
            'latitude' => fake()->latitude(6.3, 6.7),
            'longitude' => fake()->longitude(3.2, 3.5),
            'budget_hint' => fake()->randomFloat(2, 500, 50000),
            'status' => RequestStatus::Open,
            'is_urgent' => false,
            'urgent_fee' => 0,
        ];
    }

    public function urgent(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_urgent' => true,
            'urgent_fee' => 1500,
        ]);
    }

    public function draft(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RequestStatus::Draft,
        ]);
    }
}
