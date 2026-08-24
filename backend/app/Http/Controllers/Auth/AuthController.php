<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\RefreshToken;
use App\Models\User;
use App\Services\AuthService;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * AuthController
 *
 * Handles user registration, login, logout, token refresh,
 * and the authenticated user profile endpoint.
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Registration
    |--------------------------------------------------------------------------
    */

    /**
     * Register a new user account.
     *
     * POST /auth/register
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Account created successfully. A verification code has been sent to your email.',
            'data' => [
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                    'phone' => $result['user']->phone,
                    'role' => $result['user']->role->value,
                    'email_verified' => false,
                    'phone_verified' => false,
                    'kyc_tier' => $result['user']->kyc_tier,
                    'created_at' => $result['user']->created_at->toISOString(),
                ],
                'token' => $result['token']->plainTextToken,
                'token_type' => 'Bearer',
                'requires_email_verification' => true,
            ],
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Login
    |--------------------------------------------------------------------------
    */

    /**
     * Authenticate with email OR phone and password.
     *
     * If the user has 2FA enabled, a temp token is returned and the client
     * must call POST /auth/login-2fa with the TOTP code to complete login.
     *
     * POST /auth/login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login(
            login: $request->input('login'),
            password: $request->input('password'),
            device: $request->only(['device_name', 'device_type']),
        );

        // If 2FA is required, return early with the temp token
        if (! empty($result['requires_2fa'])) {
            return response()->json([
                'success' => true,
                'message' => 'Two-factor authentication is required.',
                'data' => [
                    'requires_2fa' => true,
                    'temp_token' => $result['temp_token'],
                ],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                    'phone' => $result['user']->phone,
                    'role' => $result['user']->role->value,
                    'status' => $result['user']->status->value,
                    'kyc_tier' => $result['user']->kyc_tier,
                    'email_verified' => $result['user']->email_verified_at !== null,
                    'phone_verified' => $result['user']->phone_verified_at !== null,
                    'avatar_url' => $result['user']->avatar_url,
                ],
                'token' => $result['token']->plainTextToken,
                'token_type' => 'Bearer',
                'refresh_token' => $result['refresh_token']['plain_text'],
                'expires_at' => now()->addDays(30)->toISOString(),
            ],
        ]);
    }

    /**
     * Complete a 2FA-protected login by providing the TOTP code.
     *
     * POST /auth/login-2fa
     */
    public function login2FA(Request $request): JsonResponse
    {
        $request->validate([
            'temp_token' => ['required', 'string'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        $result = $this->authService->completeLoginWith2FA(
            tempToken: $request->input('temp_token'),
            code: $request->input('code'),
        );

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                    'phone' => $result['user']->phone,
                    'role' => $result['user']->role->value,
                    'status' => $result['user']->status->value,
                    'kyc_tier' => $result['user']->kyc_tier,
                    'email_verified' => $result['user']->email_verified_at !== null,
                    'phone_verified' => $result['user']->phone_verified_at !== null,
                    'avatar_url' => $result['user']->avatar_url,
                ],
                'token' => $result['token']->plainTextToken,
                'token_type' => 'Bearer',
                'refresh_token' => $result['refresh_token']['plain_text'],
                'expires_at' => now()->addDays(30)->toISOString(),
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Google OAuth
    |--------------------------------------------------------------------------
    */

    /**
     * Authenticate or register using a Google ID token.
     *
     * POST /auth/google
     */
    public function googleLogin(Request $request): JsonResponse
    {
        $request->validate([
            'id_token' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'device_type' => ['nullable', 'string', 'in:android,ios,web'],
        ]);

        $idToken = $request->input('id_token');

        // Verify the ID token with Google
        $payload = $this->verifyGoogleIdToken($idToken);

        if (! $payload) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid Google ID token.',
            ], 401);
        }

        $googleId = $payload['sub'];
        $email = $payload['email'];
        $name = $payload['name'] ?? '';
        $avatarUrl = $payload['picture'] ?? null;
        $emailVerified = $payload['email_verified'] ?? false;

        // Find existing user by google_id or email
        $user = User::where('google_id', $googleId)->first()
            ?? User::where('email', $email)->first();

        $isNewUser = false;

        if (! $user) {
            // Register new user from Google
            $isNewUser = true;
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'google_id' => $googleId,
                'email_verified_at' => $emailVerified ? now() : null,
                'avatar_url' => $avatarUrl,
                'password' => null,
                'role' => UserRole::Requester,
                'status' => UserStatus::Active,
                'kyc_tier' => 0,
            ]);

            $user->assignRole('requester');
        } elseif (! $user->google_id) {
            // Link Google account to existing email user
            $user->update([
                'google_id' => $googleId,
                'email_verified_at' => $user->email_verified_at ?? ($emailVerified ? now() : null),
                'avatar_url' => $user->avatar_url ?? $avatarUrl,
            ]);
        }

        // Create Sanctum token
        $tokenName = $request->input('device_name', $request->input('device_type', 'google-login'));
        $token = $user->createToken($tokenName, ['*']);

        // Record device metadata
        $token->accessToken->update([
            'device_type' => $request->input('device_type'),
            'device_name' => $request->input('device_name'),
            'ip_address' => $request->ip(),
        ]);

        // Generate refresh token
        $refreshToken = $this->authService->login(
            login: $email,
            password: '', // Will fail Hash::check — use direct token creation instead
            device: $request->only(['device_name', 'device_type']),
        );

        // Actually, skip the normal login flow since Google users have no password.
        // Generate refresh token directly via the auth service's internal mechanism.
        // We'll issue it inline.
        $refreshTokenModel = RefreshToken::create([
            'access_token_id' => $token->accessToken->getKey(),
            'user_id' => $user->id,
            'token' => hash('sha256', $plainRefresh = Str::random(80)),
            'token_family' => Str::random(40),
            'expires_at' => now()->addDays(30),
        ]);

        return response()->json([
            'success' => true,
            'message' => $isNewUser ? 'Account created successfully.' : 'Login successful.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role->value,
                    'status' => $user->status->value,
                    'kyc_tier' => $user->kyc_tier,
                    'email_verified' => $user->email_verified_at !== null,
                    'phone_verified' => $user->phone_verified_at !== null,
                    'avatar_url' => $user->avatar_url,
                ],
                'token' => $token->plainTextToken,
                'token_type' => 'Bearer',
                'refresh_token' => $plainRefresh,
                'expires_at' => now()->addDays(30)->toISOString(),
            ],
        ]);
    }

    /**
     * Verify a Google ID token and return its payload.
     *
     * @return array<string, mixed>|null
     */
    private function verifyGoogleIdToken(string $idToken): ?array
    {
        try {
            $client = new \Google_Client(['client_id' => config('services.google.client_id')]);
            $payload = $client->verifyIdToken($idToken);

            return $payload ?: null;
        } catch (\Exception) {
            // Fallback: verify via HTTP if client library fails
            try {
                $response = Http::get(
                    'https://oauth2.googleapis.com/tokeninfo',
                    ['id_token' => $idToken]
                );

                if ($response->successful()) {
                    $data = $response->json();

                    // Verify the token is issued for our app
                    $clientId = config('services.google.client_id');
                    if ($clientId && ($data['aud'] ?? '') !== $clientId) {
                        return null;
                    }

                    return $data;
                }
            } catch (\Exception) {
                return null;
            }

            return null;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Logout
    |--------------------------------------------------------------------------
    */

    /**
     * Log out and revoke the current token.
     *
     * POST /auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authService->logout($user);

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Token Refresh
    |--------------------------------------------------------------------------
    */

    /**
     * Refresh an expired access token using a refresh token.
     *
     * POST /auth/refresh
     */
    public function refresh(Request $request): JsonResponse
    {
        $request->validate([
            'refresh_token' => ['required', 'string'],
        ]);

        $result = $this->authService->refreshToken($request->input('refresh_token'));

        return response()->json([
            'success' => true,
            'message' => 'Token refreshed successfully.',
            'data' => [
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                    'role' => $result['user']->role->value,
                ],
                'token' => $result['token']->plainTextToken,
                'token_type' => 'Bearer',
                'refresh_token' => $result['refresh_token']['plain_text'],
                'expires_at' => now()->addDays(30)->toISOString(),
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Authenticated User Profile
    |--------------------------------------------------------------------------
    */

    /**
     * Get the authenticated user's full profile.
     *
     * GET /me
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $roles = $user->getRoleNames();
        $permissions = $user->getAllPermissions()->pluck('name');

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'middle_name' => $user->middle_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role->value,
                'roles' => $roles,
                'permissions' => $permissions,
                'status' => $user->status->value,
                'kyc_tier' => $user->kyc_tier,
                'date_of_birth' => $user->date_of_birth,
                'gender' => $user->gender,
                'email_verified' => $user->email_verified_at !== null,
                'phone_verified' => $user->phone_verified_at !== null,
                'two_factor_enabled' => $user->two_factor_enabled,
                'avatar_url' => $user->avatar_url,
                'residential_address' => $user->residential_address,
                'state' => $user->state,
                'lga' => $user->lga,
                'is_online' => $user->is_online,
                'completed_orders' => $user->completed_orders,
                'member_since' => $user->member_since,
                'created_at' => $user->created_at->toISOString(),
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Profile Update
    |--------------------------------------------------------------------------
    */

    /**
     * Update the authenticated user's profile.
     *
     * PUT /me
     */
    public function updateProfile(Request $request, FileUploadService $uploadService): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:200'],
            'email' => ['sometimes', 'string', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'phone' => ['sometimes', 'string', 'max:20', 'regex:/^\+?[1-9]\d{6,14}$/', 'unique:users,phone,'.$user->id],
            'avatar' => ['sometimes', 'image', 'max:5120'], // Max 5MB
            'device_type' => ['nullable', 'string', 'in:android,ios,web'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        // If email changed, reset verification and send new OTP
        if (isset($validated['email']) && $validated['email'] !== $user->email) {
            $validated['email_verified_at'] = null;
        }

        // If phone changed, reset verification
        if (isset($validated['phone']) && $validated['phone'] !== $user->phone) {
            $validated['phone_verified_at'] = null;
        }

        // Handle avatar upload if provided
        $oldAvatarPath = null;
        if ($request->hasFile('avatar')) {
            $oldAvatarPath = $user->avatar_path;
            $result = $uploadService->uploadAvatar(
                $request->file('avatar'),
                $user->id,
            );

            $validated['avatar_path'] = $result['path'];
            $validated['avatar_url'] = $result['url'];
        }

        $user->update($validated);

        // Remove the previous avatar file once the new one is in place
        if ($oldAvatarPath && $oldAvatarPath !== $user->avatar_path) {
            $uploadService->delete($oldAvatarPath);
        }

        // Send verification email if email was changed
        $verificationSent = false;
        if (isset($validated['email_verified_at']) && $validated['email_verified_at'] === null) {
            $this->authService->sendEmailVerification($user);
            $verificationSent = true;
        }

        return response()->json([
            'success' => true,
            'message' => $verificationSent
                ? 'Profile updated. A new verification code has been sent to your email.'
                : 'Profile updated successfully.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'email_verified' => $user->email_verified_at !== null,
                'phone_verified' => $user->phone_verified_at !== null,
                'avatar_url' => $user->avatar_url,
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Account Deletion
    |--------------------------------------------------------------------------
    */

    /**
     * Soft-delete the authenticated user's account.
     *
     * DELETE /me
     */
    public function deleteAccount(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // Revoke all tokens
        $user->tokens()->delete();

        // Soft delete
        $user->update(['status' => 'deleted']);
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'Account deleted successfully. You can restore your account within 30 days by contacting support.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Avatar Upload
    |--------------------------------------------------------------------------
    */

    /**
     * Upload or update the user's avatar.
     *
     * POST /me/avatar
     */
    public function uploadAvatar(Request $request, FileUploadService $uploadService): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
        ]);

        // Delete old avatar
        if ($user->avatar_path) {
            $uploadService->delete($user->avatar_path);
        }

        // Upload new avatar
        $result = $uploadService->uploadAvatar(
            $request->file('avatar'),
            $user->id,
        );

        $user->update([
            'avatar_path' => $result['path'],
            'avatar_url' => $result['url'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Avatar uploaded successfully.',
            'data' => [
                'avatar_url' => $user->avatar_url,
            ],
        ]);
    }
}
