<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\VerificationCodeType;
use App\Models\AuditLog;
use App\Models\DeviceToken;
use App\Models\RefreshToken;
use App\Models\User;
use App\Models\VerificationCode;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\NewAccessToken;

/**
 * AuthService
 *
 * Central authentication service implementing:
 *  - Registration with role assignment
 *  - Email OR phone login
 *  - Refresh token rotation with theft detection
 *  - Verification code generation & validation (OTP)
 *  - Password reset
 *  - Session management
 *  - Device token management
 *
 * All operations are wrapped in database transactions where mutations
 * span multiple tables (e.g., registration creates user + assigns role +
 * creates wallet in Phase 5).
 */
class AuthService
{
    /*
    |--------------------------------------------------------------------------
    | Registration
    |--------------------------------------------------------------------------
    */

    /**
     * Register a new user and assign their Spatie role.
     *
     * @param  array{first_name: string, last_name: string, date_of_birth: string, email: string, phone: string, password: string, role: string, device_name?: string, device_type?: string}  $data
     * @return array{user: User, token: NewAccessToken, verification_code: string}
     */
    public function register(array $data): array
    {
        // Prevent admin/super_admin registration via API
        $role = UserRole::from($data['role']);
        if (in_array($role, [UserRole::Admin, UserRole::SuperAdmin], true)) {
            throw new \InvalidArgumentException('Administrator accounts cannot be created via registration.');
        }

        return DB::transaction(function () use ($data, $role): array {
            /** @var User $user */
            $user = User::create([
                'name' => trim($data['first_name'] . ' ' . $data['last_name']),
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'date_of_birth' => $data['date_of_birth'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'password' => $data['password'],
                'role' => $role,
                'status' => UserStatus::Active,
                'kyc_tier' => 0,
            ]);

            // Assign Spatie role (source of truth for authorization)
            $user->assignRole($data['role']);

            // Create Sanctum API token
            $tokenName = $data['device_name'] ?? ($data['device_type'] ?? 'default');
            $token = $user->createToken($tokenName, ['*']);

            // Record device token metadata on the personal_access_token
            if (isset($data['device_type'])) {
                $token->accessToken->update([
                    'device_type' => $data['device_type'],
                    'device_name' => $data['device_name'] ?? null,
                    'ip_address' => request()->ip(),
                ]);
            }

            // Send email verification OTP immediately on registration (queues email)
            $code = $this->sendEmailVerification($user);

            // Fire Registered event
            event(new Registered($user));

            // Audit
            AuditLog::log('user.registered', $user, $user, null, $user->toArray(), [
                'ip' => request()->ip(),
            ]);

            return ['user' => $user->fresh(), 'token' => $token, 'verification_code' => $code];
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Login
    |--------------------------------------------------------------------------
    */

    /**
     * Authenticate a user by email or phone.
     *
     * Supports both email and phone login via the 'login' field.
     * The caller (FormRequest) determines which field to use.
     *
     * If the user has 2FA enabled, a temp token is returned instead of a full
     * session. The caller must then call completeLoginWith2FA() with the temp
     * token and a valid TOTP code to finalise authentication.
     *
     * @param  string  $login     Email or phone number
     * @param  string  $password  Plain-text password
     * @param  array{device_name?: string, device_type?: string}  $device
     * @return array{user?: User, token?: NewAccessToken, refresh_token?: RefreshToken, requires_2fa?: bool, temp_token?: string}
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function login(string $login, string $password, array $device = []): array
    {
        $field = filter_var($login, FILTER_VALIDATE_EMAIL) ? 'email' : 'phone';

        /** @var User|null $user */
        $user = User::where($field, $login)->first();

        // Fail fast with generic message — don't reveal which field was wrong
        if (! $user || ! Hash::check($password, $user->password)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'login' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Check account status
        if (! $user->canLogin()) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'login' => [
                    match ($user->status) {
                        UserStatus::Suspended => 'Your account has been suspended. Please contact support.',
                        UserStatus::Banned => 'Your account has been permanently banned.',
                        UserStatus::Deleted => 'This account has been deleted.',
                        default => 'Your account is not active.',
                    },
                ],
            ]);
        }

        // If 2FA is enabled, require a TOTP code before issuing tokens
        if ($user->two_factor_enabled) {
            $tempToken = Str::random(64);

            // Store temp token → user ID mapping in cache (10 min TTL)
            \Illuminate\Support\Facades\Cache::put(
                "login_2fa:{$tempToken}",
                ['user_id' => $user->id, 'device' => $device],
                now()->addMinutes(10)
            );

            AuditLog::log('user.login_2fa_required', $user, $user, null, null, [
                'auth_field' => $field,
                'ip' => request()->ip(),
            ]);

            return [
                'requires_2fa' => true,
                'temp_token' => $tempToken,
            ];
        }

        // Create Sanctum token
        $tokenName = $device['device_name'] ?? ($device['device_type'] ?? 'login');
        $token = $user->createToken($tokenName, ['*']);

        // Record device metadata
        $token->accessToken->update([
            'device_type' => $device['device_type'] ?? null,
            'device_name' => $device['device_name'] ?? null,
            'ip_address' => request()->ip(),
        ]);

        // Generate refresh token with family tracking
        $refreshToken = $this->issueRefreshToken($user, $token->accessToken->getKey());

        // Audit
        AuditLog::log('user.login', $user, $user, null, null, [
            'auth_field' => $field,
            'ip' => request()->ip(),
        ]);

        return [
            'user' => $user->fresh(),
            'token' => $token,
            'refresh_token' => $refreshToken, // ['model' => RefreshToken, 'plain_text' => string]
        ];
    }

    /**
     * Complete a 2FA-protected login by verifying the TOTP code.
     *
     * @param  string  $tempToken  The temp token returned by login()
     * @param  string  $code       6-digit TOTP code from the authenticator app
     * @return array{user: User, token: NewAccessToken, refresh_token: RefreshToken}
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function completeLoginWith2FA(string $tempToken, string $code): array
    {
        $cacheKey = "login_2fa:{$tempToken}";
        $cached = \Illuminate\Support\Facades\Cache::get($cacheKey);

        if (! $cached) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'temp_token' => ['The login session has expired. Please log in again.'],
            ]);
        }

        /** @var User $user */
        $user = User::findOrFail($cached['user_id']);
        $device = $cached['device'] ?? [];

        // Verify the TOTP code
        if (! $user->two_factor_secret) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'code' => ['Two-factor authentication is not properly configured.'],
            ]);
        }

        $secret = decrypt($user->two_factor_secret);
        $google2fa = new \PragmaRX\Google2FA\Google2FA();

        if (! $google2fa->verifyKey($secret, $code)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'code' => ['Invalid verification code. Please try again.'],
            ]);
        }

        // Consume the temp token — prevent replay
        \Illuminate\Support\Facades\Cache::forget($cacheKey);

        // Issue real tokens
        $tokenName = $device['device_name'] ?? ($device['device_type'] ?? 'login');
        $token = $user->createToken($tokenName, ['*']);

        $token->accessToken->update([
            'device_type' => $device['device_type'] ?? null,
            'device_name' => $device['device_name'] ?? null,
            'ip_address' => request()->ip(),
        ]);

        $refreshToken = $this->issueRefreshToken($user, $token->accessToken->getKey());

        AuditLog::log('user.login_2fa_completed', $user, $user, null, null, [
            'ip' => request()->ip(),
        ]);

        return [
            'user' => $user->fresh(),
            'token' => $token,
            'refresh_token' => $refreshToken,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Logout
    |--------------------------------------------------------------------------
    */

    /**
     * Log out by revoking the current access token and its refresh token family.
     */
    public function logout(User $user): void
    {
        /** @var \Laravel\Sanctum\PersonalAccessToken|null $currentToken */
        $currentToken = $user->currentAccessToken();

        if ($currentToken) {
            // Revoke the access token
            $currentToken->delete();

            // Revoke all refresh tokens in the family
            RefreshToken::where('access_token_id', $currentToken->getKey())
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);
        }

        AuditLog::log('user.logout', $user, $user, null, null, [
            'ip' => request()->ip(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Token Refresh
    |--------------------------------------------------------------------------
    */

    /**
     * Refresh an access token using a refresh token.
     *
     * Implements rotation:
     *  1. Validate the provided refresh token
     *  2. Revoke the old refresh token
     *  3. Issue a new access + refresh token pair within the same family
     *
     * If a revoked refresh token is reused, the ENTIRE family is revoked
     * (token theft detection).
     *
     * @param  string  $refreshTokenPlain  The raw refresh token from the client
     * @return array{user: User, token: NewAccessToken, refresh_token: RefreshToken}
     *
     * @throws \Illuminate\Auth\AuthenticationException
     */
    public function refreshToken(string $refreshTokenPlain): array
    {
        // Find the refresh token by its hashed value
        $refreshToken = RefreshToken::where('token', hash('sha256', $refreshTokenPlain))->first();

        if (! $refreshToken) {
            throw new \Illuminate\Auth\AuthenticationException('Invalid refresh token.');
        }

        // Check expiry
        if ($refreshToken->expires_at->isPast()) {
            throw new \Illuminate\Auth\AuthenticationException('Refresh token has expired. Please log in again.');
        }

        // Token theft detection: if the token was already revoked, someone
        // is replaying it — revoke the entire family
        if ($refreshToken->revoked_at !== null) {
            $refreshToken->revokeFamily();

            AuditLog::log('security.token_theft_detected', null, $refreshToken, null, null, [
                'token_family' => $refreshToken->token_family,
                'ip' => request()->ip(),
            ]);

            throw new \Illuminate\Auth\AuthenticationException(
                'Security alert: This refresh token has been revoked. All sessions for this login have been terminated. Please log in again.'
            );
        }

        return DB::transaction(function () use ($refreshToken): array {
            // Revoke the old refresh token
            $refreshToken->revoke();

            // Revoke the old access token
            \Laravel\Sanctum\PersonalAccessToken::where('id', $refreshToken->access_token_id)->delete();

            // Get the user
            $user = $refreshToken->user;

            // Issue a new access token
            $newAccessToken = $user->createToken('refresh', ['*']);

            // Issue a new refresh token in the same family
            $newRefreshToken = $this->issueRefreshToken(
                $user,
                $newAccessToken->accessToken->getKey(),
                $refreshToken->token_family // Keep the same family
            );

            return [
                'user' => $user->fresh(),
                'token' => $newAccessToken,
                'refresh_token' => $newRefreshToken, // ['model' => RefreshToken, 'plain_text' => string]
            ];
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Verification Codes (OTP)
    |--------------------------------------------------------------------------
    */

    /**
     * Generate and send a verification code.
     *
     * The code is stored in both Redis (primary, with TTL) and
     * PostgreSQL (fallback, audit trail).
     *
     * @return string The 6-digit code (for email/SMS sending)
     */
    public function sendVerificationCode(User $user, VerificationCodeType $type): string
    {
        // Invalidate previous unused codes of this type
        VerificationCode::where('user_id', $user->id)
            ->where('type', $type)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        // Generate a 6-digit code
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expiryMinutes = $type->expiryMinutes();

        // Store in DB
        VerificationCode::create([
            'user_id' => $user->id,
            'type' => $type,
            'code' => $code,
            'expires_at' => now()->addMinutes($expiryMinutes),
        ]);

        // Store in cache for fast verification (Redis in production, array in testing)
        \Illuminate\Support\Facades\Cache::put(
            "verification:{$user->id}:{$type->value}",
            $code,
            now()->addMinutes($expiryMinutes)
        );

        return $code;
    }

    /**
     * Generate an email verification code and queue the notification email.
     *
     * Combines OTP generation with email dispatch so every caller that needs
     * to send an email verification code gets both behaviours automatically.
     *
     * @return string The 6-digit code (useful for tests / dev introspection)
     */
    public function sendEmailVerification(User $user): string
    {
        $code = $this->sendVerificationCode($user, VerificationCodeType::EmailVerification);

        \Illuminate\Support\Facades\Mail::to($user)->queue(
            new \App\Mail\VerificationCodeMail($user, $code)
        );

        return $code;
    }

    /**
     * Verify a verification code.
     *
     * Checks Redis first (fast path), falls back to DB.
     *
     * @return bool Whether the code is valid
     */
    public function verifyCode(User $user, VerificationCodeType $type, string $code): bool
    {
        // Fast path: cache (Redis in production, array in testing)
        $cacheKey = "verification:{$user->id}:{$type->value}";
        $cachedCode = \Illuminate\Support\Facades\Cache::get($cacheKey);

        if ($cachedCode !== null) {
            if ($cachedCode === $code) {
                \Illuminate\Support\Facades\Cache::forget($cacheKey);

                // Mark DB record as used
                VerificationCode::where('user_id', $user->id)
                    ->where('type', $type)
                    ->where('code', $code)
                    ->whereNull('used_at')
                    ->update(['used_at' => now()]);

                return true;
            }

            return false;
        }

        // Fallback: DB lookup
        $verificationCode = VerificationCode::where('user_id', $user->id)
            ->where('type', $type)
            ->where('code', $code)
            ->valid()
            ->first();

        if ($verificationCode) {
            $verificationCode->markUsed();

            return true;
        }

        return false;
    }

    /*
    |--------------------------------------------------------------------------
    | Password Reset
    |--------------------------------------------------------------------------
    */

    /**
     * Send a password reset code.
     */
    public function sendPasswordResetCode(string $email): void
    {
        $user = User::where('email', $email)->first();

        if ($user) {
            $code = $this->sendVerificationCode($user, VerificationCodeType::PasswordReset);

            \Illuminate\Support\Facades\Mail::to($user)->queue(
                new \App\Mail\PasswordResetCodeMail($user, $code)
            );
        }

        // Always return success — don't reveal whether the email exists
    }

    /**
     * Reset the user's password using a verification code.
     */
    public function resetPassword(string $email, string $code, string $newPassword): void
    {
        $user = User::where('email', $email)->firstOrFail();

        if (! $this->verifyCode($user, VerificationCodeType::PasswordReset, $code)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'code' => ['The verification code is invalid or has expired.'],
            ]);
        }

        $oldPassword = $user->password;
        $user->update(['password' => $newPassword]);

        // Revoke all existing tokens — force re-login on all devices
        $user->tokens()->delete();
        RefreshToken::where('user_id', $user->id)->update(['revoked_at' => now()]);

        event(new PasswordReset($user));

        AuditLog::log('user.password_reset', $user, $user, null, null, [
            'ip' => request()->ip(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Email & Phone Verification
    |--------------------------------------------------------------------------
    */

    /**
     * Verify the user's email address.
     */
    public function verifyEmail(User $user, string $code): bool
    {
        if (! $this->verifyCode($user, VerificationCodeType::EmailVerification, $code)) {
            return false;
        }

        $user->update(['email_verified_at' => now()]);

        AuditLog::log('user.email_verified', $user, $user, null, [
            'email_verified_at' => $user->email_verified_at,
        ]);

        return true;
    }

    /**
     * Verify the user's phone number.
     */
    public function verifyPhone(User $user, string $code): bool
    {
        if (! $this->verifyCode($user, VerificationCodeType::PhoneVerification, $code)) {
            return false;
        }

        $user->update(['phone_verified_at' => now()]);

        AuditLog::log('user.phone_verified', $user, $user, null, [
            'phone_verified_at' => $user->phone_verified_at,
        ]);

        return true;
    }

    /*
    |--------------------------------------------------------------------------
    | Device Token Management
    |--------------------------------------------------------------------------
    */

    /**
     * Register or update a device token for FCM push notifications.
     */
    public function registerDeviceToken(User $user, string $token, ?string $deviceType = null, ?string $deviceName = null): DeviceToken
    {
        return DeviceToken::updateOrCreate(
            ['user_id' => $user->id, 'token' => $token],
            [
                'device_type' => $deviceType,
                'device_name' => $deviceName,
                'last_used_at' => now(),
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Session Management
    |--------------------------------------------------------------------------
    */

    /**
     * List all active sessions (Sanctum tokens) for the authenticated user.
     */
    public function listSessions(User $user): array
    {
        return $user->tokens()
            ->orderBy('last_used_at', 'desc')
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'device_type' => $token->device_type,
                'device_name' => $token->device_name,
                'ip_address' => $token->ip_address,
                'last_used_at' => $token->last_used_at?->toISOString(),
                'created_at' => $token->created_at->toISOString(),
                'is_current' => $token->id === ($user->currentAccessToken()?->id),
            ])
            ->toArray();
    }

    /**
     * Revoke a specific session (token) by ID.
     */
    public function revokeSession(User $user, string $tokenId): void
    {
        $token = $user->tokens()->where('id', $tokenId)->first();

        if ($token) {
            // Don't allow revoking the current token via this method —
            // use logout() for that
            if ($token->id === $user->currentAccessToken()?->id) {
                throw new \InvalidArgumentException('Use the logout endpoint to revoke your current session.');
            }

            $token->delete();

            // Revoke associated refresh tokens
            RefreshToken::where('access_token_id', $tokenId)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);
        }

        AuditLog::log('user.session_revoked', $user, $user, null, null, [
            'token_id' => $tokenId,
            'ip' => request()->ip(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Two-Factor Authentication
    |--------------------------------------------------------------------------
    */

    /**
     * Enable two-factor authentication for the user.
     *
     * @return array{secret: string, qr_code_url: string}
     */
    public function enableTwoFactor(User $user): array
    {
        $google2fa = new \PragmaRX\Google2FA\Google2FA();

        $secret = $google2fa->generateSecretKey();

        $user->update([
            'two_factor_secret' => encrypt($secret),
            'two_factor_enabled' => false, // Requires verification before full enable
        ]);

        $qrCodeUrl = $google2fa->getQRCodeUrl(
            'Errand Boy',
            $user->email,
            $secret
        );

        AuditLog::log('user.2fa_initiated', $user, $user);

        return [
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
        ];
    }

    /**
     * Disable two-factor authentication.
     */
    public function disableTwoFactor(User $user): void
    {
        $user->update([
            'two_factor_enabled' => false,
            'two_factor_secret' => null,
        ]);

        AuditLog::log('user.2fa_disabled', $user, $user);
    }

    /*
    |--------------------------------------------------------------------------
    | Private Helpers
    |--------------------------------------------------------------------------
    */

    /**
     * Issue a new refresh token for the given user and access token.
     *
     * The token stored in the DB is a SHA-256 hash — the plaintext is
     * returned in the result array and MUST be sent to the client.
     * The plaintext is never stored on the server.
     *
     * @param  string|null  $family  Token family (null = new family)
     * @return array{model: RefreshToken, plain_text: string}
     */
    private function issueRefreshToken(User $user, string $accessTokenId, ?string $family = null): array
    {
        $plainText = Str::random(80);
        $family = $family ?? Str::random(40);

        $model = RefreshToken::create([
            'access_token_id' => $accessTokenId,
            'user_id' => $user->id,
            'token' => hash('sha256', $plainText),
            'token_family' => $family,
            'expires_at' => now()->addDays(30),
        ]);

        return [
            'model' => $model,
            'plain_text' => $plainText,
        ];
    }
}
