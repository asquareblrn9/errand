<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

class PasswordResetController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
    ) {}

    /**
     * Send a password reset verification code to the user's email.
     *
     * POST /auth/forgot-password
     */
    public function forgot(ForgotPasswordRequest $request): JsonResponse
    {
        $this->authService->sendPasswordResetCode($request->input('email'));

        // Always return success to prevent email enumeration
        return response()->json([
            'success' => true,
            'message' => 'If an account with that email exists, a password reset code has been sent.',
        ]);
    }

    /**
     * Reset the password using a verification code.
     *
     * POST /auth/reset-password
     */
    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $this->authService->resetPassword(
            email: $request->input('email'),
            code: $request->input('code'),
            newPassword: $request->input('password'),
        );

        return response()->json([
            'success' => true,
            'message' => 'Password reset successful. Please log in with your new password.',
        ]);
    }
}
