<?php

declare(strict_types=1);

namespace Tests\Feature\Profile;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class AddressTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    /*
    |--------------------------------------------------------------------------
    | List Addresses
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_list_their_addresses(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/me/addresses')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    /*
    |--------------------------------------------------------------------------
    | Create Address
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_create_address(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson('/api/v1/me/addresses', [
                'label' => 'home',
                'address_line_1' => '15 Marina Road',
                'city' => 'Lagos',
                'state' => 'Lagos',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.label', 'home')
            ->assertJsonPath('data.city', 'Lagos');

        // First address should be auto-set as default
        $this->assertTrue($response->json('data.is_default'));

        $this->assertDatabaseHas('user_addresses', [
            'user_id' => $user->id,
            'label' => 'home',
            'is_default' => true,
        ]);
    }

    #[Test]
    public function create_address_validates_required_fields(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/me/addresses', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['label', 'address_line_1', 'city', 'state']);
    }

    #[Test]
    public function create_address_validates_label_value(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/me/addresses', [
                'label' => 'invalid_label',
                'address_line_1' => '15 Marina Road',
                'city' => 'Lagos',
                'state' => 'Lagos',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['label']);
    }

    /*
    |--------------------------------------------------------------------------
    | Get Single Address
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_view_their_address(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $address = $user->addresses()->create([
            'label' => 'work',
            'address_line_1' => '20 Broad Street',
            'city' => 'Lagos',
            'state' => 'Lagos',
        ]);

        $this->withToken($token)
            ->getJson("/api/v1/me/addresses/{$address->id}")
            ->assertOk()
            ->assertJsonPath('data.label', 'work');
    }

    #[Test]
    public function user_cannot_view_another_users_address(): void
    {
        $user1 = $this->createUser();
        $user2 = User::factory()->create(['role' => UserRole::Requester]);
        $user2->assignRole('requester');

        $address = $user2->addresses()->create([
            'label' => 'home',
            'address_line_1' => 'Secret Location',
            'city' => 'Abuja',
            'state' => 'FCT',
        ]);

        $token = $user1->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/v1/me/addresses/{$address->id}")
            ->assertNotFound();
    }

    /*
    |--------------------------------------------------------------------------
    | Update Address
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_update_their_address(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $address = $user->addresses()->create([
            'label' => 'home',
            'address_line_1' => '15 Marina Road',
            'city' => 'Lagos',
            'state' => 'Lagos',
        ]);

        $this->withToken($token)
            ->putJson("/api/v1/me/addresses/{$address->id}", [
                'label' => 'work',
            ])
            ->assertOk()
            ->assertJsonPath('data.label', 'work');
    }

    /*
    |--------------------------------------------------------------------------
    | Delete Address
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function user_can_delete_their_address(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $address = $user->addresses()->create([
            'label' => 'home',
            'address_line_1' => '15 Marina Road',
            'city' => 'Lagos',
            'state' => 'Lagos',
        ]);

        $this->withToken($token)
            ->deleteJson("/api/v1/me/addresses/{$address->id}")
            ->assertOk();

        $this->assertDatabaseMissing('user_addresses', ['id' => $address->id]);
    }

    /*
    |--------------------------------------------------------------------------
    | Default Address
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function setting_new_default_clears_old_default(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        // Create first address (auto-default)
        $first = $user->addresses()->create([
            'label' => 'home',
            'address_line_1' => '15 Marina Road',
            'city' => 'Lagos',
            'state' => 'Lagos',
            'is_default' => true,
        ]);

        // Create second address
        $second = $user->addresses()->create([
            'label' => 'work',
            'address_line_1' => '20 Broad Street',
            'city' => 'Lagos',
            'state' => 'Lagos',
        ]);

        // Set second as default
        $this->withToken($token)
            ->putJson("/api/v1/me/addresses/{$second->id}", [
                'is_default' => true,
            ])
            ->assertOk();

        // First should no longer be default
        $this->assertDatabaseHas('user_addresses', ['id' => $first->id, 'is_default' => false]);
        $this->assertDatabaseHas('user_addresses', ['id' => $second->id, 'is_default' => true]);
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
