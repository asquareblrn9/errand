<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddressController extends Controller
{
    /**
     * List all addresses for the authenticated user.
     *
     * GET /me/addresses
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $addresses = $user->addresses()
            ->orderByDesc('is_default')
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $addresses->map(fn (UserAddress $addr): array => [
                'id' => $addr->id,
                'label' => $addr->label,
                'address_line_1' => $addr->address_line_1,
                'address_line_2' => $addr->address_line_2,
                'city' => $addr->city,
                'state' => $addr->state,
                'postal_code' => $addr->postal_code,
                'country' => $addr->country,
                'latitude' => $addr->latitude,
                'longitude' => $addr->longitude,
                'is_default' => $addr->is_default,
                'created_at' => $addr->created_at->toISOString(),
            ]),
        ]);
    }

    /**
     * Create a new address.
     *
     * POST /me/addresses
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'label' => ['required', 'string', 'in:home,work,other', 'max:50'],
            'address_line_1' => ['required', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:100'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'country' => ['nullable', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'min:-90', 'max:90'],
            'longitude' => ['nullable', 'numeric', 'min:-180', 'max:180'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        $validated['user_id'] = $user->id;

        // Auto-set as default if it's the first address
        if ($user->addresses()->count() === 0) {
            $validated['is_default'] = true;
        }

        $address = UserAddress::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Address saved successfully.',
            'data' => [
                'id' => $address->id,
                'label' => $address->label,
                'address_line_1' => $address->address_line_1,
                'address_line_2' => $address->address_line_2,
                'city' => $address->city,
                'state' => $address->state,
                'is_default' => $address->is_default,
            ],
        ], 201);
    }

    /**
     * Get a single address.
     *
     * GET /me/addresses/{id}
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $address = $user->addresses()->where('id', $id)->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $address->id,
                'label' => $address->label,
                'address_line_1' => $address->address_line_1,
                'address_line_2' => $address->address_line_2,
                'city' => $address->city,
                'state' => $address->state,
                'postal_code' => $address->postal_code,
                'country' => $address->country,
                'latitude' => $address->latitude,
                'longitude' => $address->longitude,
                'is_default' => $address->is_default,
                'created_at' => $address->created_at->toISOString(),
            ],
        ]);
    }

    /**
     * Update an address.
     *
     * PUT /me/addresses/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $address = $user->addresses()->where('id', $id)->firstOrFail();

        $validated = $request->validate([
            'label' => ['sometimes', 'string', 'in:home,work,other', 'max:50'],
            'address_line_1' => ['sometimes', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'string', 'max:100'],
            'state' => ['sometimes', 'string', 'max:100'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'country' => ['nullable', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'min:-90', 'max:90'],
            'longitude' => ['nullable', 'numeric', 'min:-180', 'max:180'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        $address->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Address updated successfully.',
            'data' => [
                'id' => $address->id,
                'label' => $address->label,
                'address_line_1' => $address->address_line_1,
                'city' => $address->city,
                'state' => $address->state,
                'is_default' => $address->is_default,
            ],
        ]);
    }

    /**
     * Delete an address.
     *
     * DELETE /me/addresses/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $address = $user->addresses()->where('id', $id)->firstOrFail();

        $wasDefault = $address->is_default;
        $address->delete();

        // If we deleted the default, promote the most recent to default
        if ($wasDefault) {
            $next = $user->addresses()->latest()->first();
            if ($next) {
                $next->update(['is_default' => true]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Address deleted successfully.',
        ]);
    }
}
