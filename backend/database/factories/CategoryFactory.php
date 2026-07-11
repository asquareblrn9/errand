<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'name' => ucwords($name),
            'slug' => \Illuminate\Support\Str::slug($name),
            'dispute_window_hours' => fake()->randomElement([6, 12, 24, 48, 72]),
            'sla_target_minutes' => fake()->randomElement([60, 90, 120, 210]),
            'is_active' => true,
        ];
    }
}
