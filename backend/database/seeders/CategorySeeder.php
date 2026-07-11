<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    private const CATEGORIES = [
        ['name' => 'Food & Groceries', 'slug' => 'food-groceries', 'dispute_window_hours' => 6, 'sla_target_minutes' => 60, 'sort_order' => 1],
        ['name' => 'Documents / Printing', 'slug' => 'documents-printing', 'dispute_window_hours' => 12, 'sla_target_minutes' => 90, 'sort_order' => 2],
        ['name' => 'Clothing & Apparel', 'slug' => 'clothing-apparel', 'dispute_window_hours' => 24, 'sla_target_minutes' => 90, 'sort_order' => 3],
        ['name' => 'General Goods', 'slug' => 'general-goods', 'dispute_window_hours' => 24, 'sla_target_minutes' => 110, 'sort_order' => 4],
        ['name' => 'Electronics', 'slug' => 'electronics', 'dispute_window_hours' => 48, 'sla_target_minutes' => 110, 'sort_order' => 5],
        ['name' => 'Services (Repair)', 'slug' => 'services-repair', 'dispute_window_hours' => 72, 'sla_target_minutes' => 210, 'sort_order' => 6],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $cat) {
            Category::firstOrCreate(
                ['slug' => $cat['slug']],
                $cat
            );
        }

        $this->command?->info('Categories seeded: ' . count(self::CATEGORIES));
    }
}
