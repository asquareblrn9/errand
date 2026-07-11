<?php

declare(strict_types=1);

namespace Tests\Feature\Profile;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Public Profile
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function anyone_can_view_public_profile(): void
    {
        $user = $this->createUser([
            'name' => 'Adeola',
            'role' => UserRole::Errander,
            'completed_orders' => 42,
        ]);

        $response = $this->getJson("/api/v1/users/{$user->id}/profile");

        $response->assertOk()
            ->assertJsonPath('data.name', 'Adeola')
            ->assertJsonPath('data.role', 'errander')
            ->assertJsonPath('data.completed_orders', 42)
            ->assertJsonPath('data.kyc_tier', 0);

        // PII must not be exposed
        $response->assertJsonMissing(['email']);
        $response->assertJsonMissing(['phone']);
    }

    #[Test]
    public function public_profile_returns_404_for_banned_user(): void
    {
        $user = $this->createUser(['status' => UserStatus::Banned]);

        $this->getJson("/api/v1/users/{$user->id}/profile")
            ->assertNotFound();
    }

    #[Test]
    public function public_profile_returns_404_for_deleted_user(): void
    {
        $user = $this->createUser();
        $user->update(['status' => 'deleted']);
        $user->delete();

        $this->getJson("/api/v1/users/{$user->id}/profile")
            ->assertNotFound();
    }

    #[Test]
    public function public_profile_returns_404_for_nonexistent_user(): void
    {
        $this->getJson('/api/v1/users/00000000-0000-0000-0000-000000000000/profile')
            ->assertNotFound();
    }

    /*
    |--------------------------------------------------------------------------
    | Profile Update
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_update_their_name(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/v1/me', ['name' => 'New Name'])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name');
    }

    #[Test]
    public function user_cannot_update_their_email(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/v1/me', ['email' => 'hacked@example.com'])
            ->assertOk();

        // Email should not have changed (not in fillable for update)
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => $user->email,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Avatar Upload
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_upload_avatar(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $file = UploadedFile::fake()->image('avatar.jpg', 200, 200);

        $response = $this->withToken($token)
            ->postJson('/api/v1/me/avatar', ['avatar' => $file]);

        $response->assertOk()
            ->assertJsonStructure(['data' => ['avatar_url']]);

        $this->assertNotNull($response->json('data.avatar_url'));
    }

    #[Test]
    public function avatar_must_be_an_image(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $file = UploadedFile::fake()->create('document.pdf', 100);

        $this->withToken($token)
            ->postJson('/api/v1/me/avatar', ['avatar' => $file])
            ->assertUnprocessable();
    }

    #[Test]
    public function avatar_must_be_under_5mb(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $file = UploadedFile::fake()->image('huge.jpg')->size(6000); // 6MB

        $this->withToken($token)
            ->postJson('/api/v1/me/avatar', ['avatar' => $file])
            ->assertUnprocessable();
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
            'role' => UserRole::Requester,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ], $overrides));

        $user->assignRole($overrides['role'] ?? UserRole::Requester);

        return $user;
    }
}
