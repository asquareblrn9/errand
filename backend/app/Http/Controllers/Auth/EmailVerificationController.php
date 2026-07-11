<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\VerifyEmailRequest;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
    ) {}

    /**
     * Send a verification code to the authenticated user's email.
     *
     * POST /auth/verify-email/send
     */
    public function send(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->email_verified_at) {
            return response()->json([
                'success' => true,
                'message' => 'Email is already verified.',
            ]);
        }

        $this->authService->sendEmailVerification($user);

        return response()->json([
            'success' => true,
            'message' => 'Verification code sent to your email.',
        ]);
    }

    /**
     * Verify the email address using the sent code.
     *
     * POST /auth/verify-email
     */
    public function verify(VerifyEmailRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user() ?? User::where('email', $request->input('email'))->first();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid verification attempt.',
            ], 400);
        }

        $verified = $this->authService->verifyEmail($user, $request->input('code'));

        if (! $verified) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired verification code.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully.',
            'data' => [
                'email_verified' => true,
                'verified_at' => $user->email_verified_at?->toISOString(),
            ],
        ]);
    }
}
