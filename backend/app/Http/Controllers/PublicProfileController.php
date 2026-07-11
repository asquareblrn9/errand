<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;

class PublicProfileController extends Controller
{
    /**
     * Get a user's public profile.
     *
     * No authentication required. Returns only publicly visible
     * information — no PII (email, phone are excluded).
     *
     * GET /users/{id}/profile
     */
    public function show(string $id): JsonResponse
    {
        $user = User::where('id', $id)
            ->whereIn('status', ['active', 'suspended']) // Only show non-deleted/banned
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role->value,
                'kyc_tier' => $user->kyc_tier,
                'avatar_url' => $user->avatar_url,
                'completed_orders' => $user->completed_orders,
                'member_since' => $user->member_since,
            ],
        ]);
    }
}
