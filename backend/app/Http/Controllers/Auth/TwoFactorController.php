<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwoFactorController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
    ) {}

    /**
     * Initiate two-factor authentication setup.
     * Returns the QR code URL for the user to scan.
     *
     * POST /auth/enable-2fa
     */
    public function enable(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->two_factor_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'Two-factor authentication is already enabled.',
            ], 400);
        }

        $result = $this->authService->enableTwoFactor($user);

        return response()->json([
            'success' => true,
            'message' => 'Scan the QR code with your authenticator app, then verify with the code to complete setup.',
            'data' => [
                'secret' => $result['secret'],
                'qr_code_url' => $result['qr_code_url'],
            ],
        ]);
    }

    /**
     * Verify and complete 2FA setup by providing a valid TOTP code.
     *
     * POST /auth/verify-2fa
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        /** @var User $user */
        $user = $request->user();

        if ($user->two_factor_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'Two-factor authentication is already enabled.',
            ], 400);
        }

        if (! $user->two_factor_secret) {
            return response()->json([
                'success' => false,
                'message' => 'You must initiate 2FA setup first.',
            ], 400);
        }

        $secret = decrypt($user->two_factor_secret);

        $google2fa = new \PragmaRX\Google2FA\Google2FA();

        if (! $google2fa->verifyKey($secret, $request->input('code'))) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid verification code.',
            ], 422);
        }

        $user->update(['two_factor_enabled' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication enabled successfully.',
            'data' => [
                'two_factor_enabled' => true,
                'recovery_codes' => [], // TODO: Generate backup codes in a future iteration
            ],
        ]);
    }

    /**
     * Disable two-factor authentication.
     *
     * POST /auth/disable-2fa
     */
    public function disable(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->two_factor_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'Two-factor authentication is not enabled.',
            ], 400);
        }

        $this->authService->disableTwoFactor($user);

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication disabled successfully.',
        ]);
    }
}
