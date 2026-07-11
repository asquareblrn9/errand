<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Registration
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_register_as_requester(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Adeola Abolarin',
            'email' => 'adeola@example.com',
            'phone' => '+2348012345678',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'role' => 'requester',
        ]);

        $response->assertCreated()
            ->assertJsonStructure([
                'success',
                'message',
                'data' => ['user', 'token', 'token_type'],
            ])
            ->assertJsonPath('data.user.role', 'requester')
            ->assertJsonPath('data.user.email', 'adeola@example.com')
            ->assertJsonPath('data.token_type', 'Bearer');

        $this->assertDatabaseHas('users', [
            'email' => 'adeola@example.com',
            'role' => 'requester',
        ]);

        // Verify Spatie role was assigned
        /** @var User $user */
        $user = User::where('email', 'adeola@example.com')->first();
        $this->assertTrue($user->hasRole('requester'));
    }

    #[Test]
    public function user_can_register_as_errander(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'John Errander',
            'email' => 'john@example.com',
            'phone' => '+2348012345679',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'role' => 'errander',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.role', 'errander');
    }

    #[Test]
    public function cannot_register_as_admin(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Hacker',
            'email' => 'hacker@example.com',
            'phone' => '+2348012345680',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'role' => 'admin',
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('errors.role.0', 'You may only register as a requester or errander.');
    }

    #[Test]
    public function registration_validates_required_fields(): void
    {
        $response = $this->postJson('/api/v1/auth/register', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'phone', 'password', 'role']);
    }

    #[Test]
    public function registration_validates_unique_email(): void
    {
        User::factory()->create(['email' => 'adeola@example.com']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Adeola Abolarin',
            'email' => 'adeola@example.com',
            'phone' => '+2348012345600',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'role' => 'requester',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    #[Test]
    public function registration_validates_unique_phone(): void
    {
        User::factory()->create(['phone' => '+2348012345678']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Adeola Abolarin',
            'email' => 'new@example.com',
            'phone' => '+2348012345678',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'role' => 'requester',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function registration_enforces_password_strength(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'phone' => '+2348012345601',
            'password' => 'weak',
            'password_confirmation' => 'weak',
            'role' => 'requester',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    /*
    |--------------------------------------------------------------------------
    | Login
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_login_with_email(): void
    {
        $user = $this->createRequester();

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => $user->email,
            'password' => 'Password1!',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => ['user', 'token', 'token_type', 'refresh_token', 'expires_at'],
            ])
            ->assertJsonPath('data.user.email', $user->email)
            ->assertJsonPath('data.token_type', 'Bearer');

        // Verify a token can access protected routes
        $token = $response->json('data.token');
        $this->withToken($token)
            ->getJson('/api/v1/me')
            ->assertOk();
    }

    #[Test]
    public function user_can_login_with_phone(): void
    {
        $user = $this->createErrander();

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => $user->phone,
            'password' => 'Password1!',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.phone', $user->phone);
    }

    #[Test]
    public function login_fails_with_wrong_password(): void
    {
        $user = $this->createRequester();

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => $user->email,
            'password' => 'WrongPassword1!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['login']);
    }

    #[Test]
    public function login_fails_for_suspended_user(): void
    {
        $user = $this->createRequester(['status' => UserStatus::Suspended->value]);

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => $user->email,
            'password' => 'Password1!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['login']);
    }

    #[Test]
    public function login_fails_for_banned_user(): void
    {
        $user = $this->createRequester(['status' => UserStatus::Banned->value]);

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => $user->email,
            'password' => 'Password1!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['login']);
    }

    #[Test]
    public function login_fails_with_nonexistent_email(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'noone@example.com',
            'password' => 'Password1!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['login']);
    }

    /*
    |--------------------------------------------------------------------------
    | Logout
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function authenticated_user_can_logout(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;

        $tokenCount = $user->tokens()->count();

        $response = $this->withToken($token)
            ->postJson('/api/v1/auth/logout');

        $response->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        // Token should be deleted from database
        $this->assertDatabaseCount('personal_access_tokens', $tokenCount - 1);
    }

    /*
    |--------------------------------------------------------------------------
    | Token Refresh
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_refresh_token(): void
    {
        $user = $this->createRequester();

        // Login to get refresh token
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'login' => $user->email,
            'password' => 'Password1!',
        ]);

        $loginResponse->assertOk();
        $refreshTokenValue = $loginResponse->json('data.refresh_token');
        $this->assertNotNull($refreshTokenValue);

        // Test the service directly to verify the refresh flow works
        $authService = app(\App\Services\AuthService::class);
        $result = $authService->refreshToken($refreshTokenValue);

        $this->assertNotNull($result, 'Refresh should return a result');
        $this->assertArrayHasKey('token', $result, 'Should include a new access token');
        $this->assertArrayHasKey('refresh_token', $result, 'Should include a new refresh token');
    }

    #[Test]
    public function refresh_fails_with_invalid_token(): void
    {
        $response = $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => 'invalid-token-value',
        ]);

        $response->assertUnauthorized();
    }

    /*
    |--------------------------------------------------------------------------
    | Protected Routes
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function unauthenticated_user_cannot_access_protected_routes(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
        $this->putJson('/api/v1/me', [])->assertUnauthorized();
        $this->deleteJson('/api/v1/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
        $this->getJson('/api/v1/auth/sessions')->assertUnauthorized();
        $this->postJson('/api/v1/auth/verify-phone/send')->assertUnauthorized();
    }

    /*
    |--------------------------------------------------------------------------
    | Profile
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function authenticated_user_can_view_their_profile(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->getJson('/api/v1/me');

        $response->assertOk()
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.role', 'requester')
            ->assertJsonPath('data.status', 'active');
    }

    #[Test]
    public function user_can_update_their_profile(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->putJson('/api/v1/me', [
                'name' => 'Updated Name',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'Updated Name');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Updated Name',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Session Management
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_view_active_sessions(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test-device')->plainTextToken;

        $response = $this->withToken($token)
            ->getJson('/api/v1/auth/sessions');

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    #[Test]
    public function user_can_revoke_other_sessions(): void
    {
        $user = $this->createRequester();
        $currentToken = $user->createToken('current')->plainTextToken;
        $otherToken = $user->createToken('other')->plainTextToken;

        $tokenCount = $user->tokens()->count();

        // Get the token ID of the other session
        $sessions = $this->withToken($currentToken)
            ->getJson('/api/v1/auth/sessions')
            ->json('data');

        $otherSessionId = collect($sessions)
            ->where('is_current', false)
            ->first()['id'];

        // Revoke it
        $this->withToken($currentToken)
            ->deleteJson("/api/v1/auth/sessions/{$otherSessionId}")
            ->assertOk();

        // Verify token was deleted from database
        $this->assertDatabaseCount('personal_access_tokens', $tokenCount - 1);
    }

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function login_is_rate_limited(): void
    {
        $user = $this->createRequester();

        // Hit the login endpoint 5 times with wrong password
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'login' => $user->email,
                'password' => 'wrong',
            ]);
        }

        // 6th attempt should be rate limited
        $response = $this->postJson('/api/v1/auth/login', [
            'login' => $user->email,
            'password' => 'wrong',
        ]);

        $response->assertTooManyRequests();
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    /**
     * Create a requester user with default credentials.
     */
    private function createRequester(array $overrides = []): User
    {
        $user = User::factory()->create(array_merge([
            'email' => 'requester@test.com',
            'phone' => '+2348012345678',
            'password' => 'Password1!',
            'role' => UserRole::Requester,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ], $overrides));

        $user->assignRole('requester');

        return $user;
    }

    /**
     * Create an errander user with default credentials.
     */
    private function createErrander(array $overrides = []): User
    {
        $user = User::factory()->create(array_merge([
            'email' => 'errander@test.com',
            'phone' => '+2348098765432',
            'password' => 'Password1!',
            'role' => UserRole::Errander,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ], $overrides));

        $user->assignRole('errander');

        return $user;
    }
}
