<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Category;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function __construct(
        private readonly CacheService $cache,
    ) {}

    /**
     * List all categories (admin sees all including inactive).
     *
     * GET /categories
     */
    public function index(): JsonResponse
    {
        $categories = Category::ordered()->get();

        return response()->json([
            'success' => true,
            'data' => $categories->map(fn (Category $c): array => [
                'id' => $c->id,
                'name' => $c->name, 'slug' => $c->slug,
                'description' => $c->description, 'icon' => $c->icon,
                'dispute_window_hours' => $c->dispute_window_hours,
                'sla_target_minutes' => $c->sla_target_minutes,
                'sort_order' => $c->sort_order,
                'is_active' => $c->is_active,
            ]),
        ]);
    }

    /**
     * Get a single category.
     *
     * GET /categories/{id}
     */
    public function show(string $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $category->id, 'name' => $category->name, 'slug' => $category->slug,
                'description' => $category->description, 'icon' => $category->icon,
                'dispute_window_hours' => $category->dispute_window_hours,
                'sla_target_minutes' => $category->sla_target_minutes,
                'sort_order' => $category->sort_order,
                'is_active' => $category->is_active,
            ],
        ]);
    }

    /**
     * Create a new category (admin only).
     *
     * POST /admin/categories
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:categories,name'],
            'slug' => ['nullable', 'string', 'max:100', 'unique:categories,slug'],
            'description' => ['nullable', 'string', 'max:500'],
            'icon' => ['nullable', 'string', 'max:50'],
            'dispute_window_hours' => ['nullable', 'integer', 'min:0', 'max:720'],
            'sla_target_minutes' => ['nullable', 'integer', 'min:0', 'max:10080'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $category = Category::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?? Str::slug($validated['name']),
            'description' => $validated['description'] ?? null,
            'icon' => $validated['icon'] ?? null,
            'dispute_window_hours' => $validated['dispute_window_hours'] ?? 48,
            'sla_target_minutes' => $validated['sla_target_minutes'] ?? 120,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $this->cache->invalidateCategories();

        return response()->json([
            'success' => true,
            'message' => 'Category created.',
            'data' => $category,
        ], 201);
    }

    /**
     * Update a category (admin only).
     *
     * PUT /admin/categories/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:100', 'unique:categories,name,' . $id],
            'slug' => ['nullable', 'string', 'max:100', 'unique:categories,slug,' . $id],
            'description' => ['nullable', 'string', 'max:500'],
            'icon' => ['nullable', 'string', 'max:50'],
            'dispute_window_hours' => ['nullable', 'integer', 'min:0', 'max:720'],
            'sla_target_minutes' => ['nullable', 'integer', 'min:0', 'max:10080'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $category->update($validated);
        $this->cache->invalidateCategories();

        return response()->json([
            'success' => true,
            'message' => 'Category updated.',
            'data' => $category->fresh(),
        ]);
    }

    /**
     * Delete a category (admin only, soft delete).
     *
     * DELETE /admin/categories/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        // Don't allow deleting categories with active requests
        if ($category->requests()->whereIn('status', ['open', 'assigned', 'accepted', 'in_progress'])->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete a category with active requests.',
            ], 422);
        }

        $category->delete();
        $this->cache->invalidateCategories();

        return response()->json([
            'success' => true,
            'message' => 'Category deleted.',
        ]);
    }
}
