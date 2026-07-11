<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
    ) {}

    /**
     * List all active sessions for the authenticated user.
     *
     * GET /auth/sessions
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $sessions = $this->authService->listSessions($user);

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    /**
     * Revoke a specific session by token ID.
     *
     * DELETE /auth/sessions/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $this->authService->revokeSession($user, $id);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Session revoked successfully.',
        ]);
    }
}
