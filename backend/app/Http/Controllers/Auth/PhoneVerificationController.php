<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Enums\VerificationCodeType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\VerifyPhoneRequest;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PhoneVerificationController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
    ) {}

    /**
     * Send a verification code to the authenticated user's phone via SMS.
     *
     * POST /auth/verify-phone/send
     */
    public function send(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->phone_verified_at) {
            return response()->json([
                'success' => true,
                'message' => 'Phone is already verified.',
            ]);
        }

        $code = $this->authService->sendVerificationCode($user, VerificationCodeType::PhoneVerification);

        Log::info('Phone verification code generated', [
            'user_id' => $user->id,
            'phone' => $user->phone,
            'code' => $code,
        ]);

        // TODO: Queue SMS via Termii/Africa's Talking in production
        // SendPhoneVerificationSms::dispatch($user->phone, $code);

        return response()->json([
            'success' => true,
            'message' => 'Verification code sent to your phone.',
        ]);
    }

    /**
     * Verify the phone number using the sent code.
     *
     * POST /auth/verify-phone
     */
    public function verify(VerifyPhoneRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $verified = $this->authService->verifyPhone($user, $request->input('code'));

        if (! $verified) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired verification code.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Phone verified successfully.',
            'data' => [
                'phone_verified' => true,
                'verified_at' => $user->phone_verified_at->toISOString(),
            ],
        ]);
    }
}
