<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\VerificationCodeType;
use App\Models\User;
use App\Services\AuthService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private AuthService $authService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->authService = app(AuthService::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Forgot Password
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function forgot_password_sends_code_for_existing_email(): void
    {
        $user = $this->createUser();

        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => $user->email,
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'If an account with that email exists, a password reset code has been sent.');

        // Verify code was created in DB
        $this->assertDatabaseHas('verification_codes', [
            'user_id' => $user->id,
            'type' => VerificationCodeType::PasswordReset->value,
        ]);
    }

    #[Test]
    public function forgot_password_returns_success_for_nonexistent_email(): void
    {
        // Should not reveal whether the email exists (prevents enumeration)
        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'noone@example.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'If an account with that email exists, a password reset code has been sent.');
    }

    #[Test]
    public function forgot_password_validates_email_format(): void
    {
        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'not-an-email',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    /*
    |--------------------------------------------------------------------------
    | Reset Password
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_reset_password_with_valid_code(): void
    {
        $user = $this->createUser();
        $code = $this->authService->sendVerificationCode($user, VerificationCodeType::PasswordReset);

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'code' => $code,
            'password' => 'NewPassword2!',
            'password_confirmation' => 'NewPassword2!',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Password reset successful. Please log in with your new password.');

        // Verify new password works
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'login' => $user->email,
            'password' => 'NewPassword2!',
        ]);

        $loginResponse->assertOk();
    }

    #[Test]
    public function reset_password_fails_with_invalid_code(): void
    {
        $user = $this->createUser();

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'code' => '000000',
            'password' => 'NewPassword2!',
            'password_confirmation' => 'NewPassword2!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    #[Test]
    public function reset_password_fails_with_expired_code(): void
    {
        $user = $this->createUser();
        $code = $this->authService->sendVerificationCode($user, VerificationCodeType::PasswordReset);

        // Simulate expiry by moving time forward
        $this->travel(61)->minutes();

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'code' => $code,
            'password' => 'NewPassword2!',
            'password_confirmation' => 'NewPassword2!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    #[Test]
    public function reset_password_enforces_password_strength(): void
    {
        $user = $this->createUser();
        $code = $this->authService->sendVerificationCode($user, VerificationCodeType::PasswordReset);

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'code' => $code,
            'password' => 'weak',
            'password_confirmation' => 'weak',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    #[Test]
    public function reset_password_revokes_all_existing_tokens(): void
    {
        $user = $this->createUser();

        // Create some tokens
        $token1 = $user->createToken('device1')->plainTextToken;
        $token2 = $user->createToken('device2')->plainTextToken;

        // Reset password
        $code = $this->authService->sendVerificationCode($user, VerificationCodeType::PasswordReset);
        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'code' => $code,
            'password' => 'NewPassword2!',
            'password_confirmation' => 'NewPassword2!',
        ]);

        // Old tokens should be revoked
        $this->withToken($token1)->getJson('/api/v1/me')->assertUnauthorized();
        $this->withToken($token2)->getJson('/api/v1/me')->assertUnauthorized();
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createUser(array $overrides = []): User
    {
        $user = User::factory()->create(array_merge([
            'email' => 'test@example.com',
            'password' => 'Password1!',
            'email_verified_at' => now(),
        ], $overrides));

        $user->assignRole('requester');

        return $user;
    }
}
