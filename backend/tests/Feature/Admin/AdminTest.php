<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    #[Test]
    public function admin_can_view_dashboard(): void
    {
        $admin = $this->createAdmin();
        $token = $admin->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonStructure(['data' => ['users', 'requests', 'disputes', 'finances']]);
    }

    #[Test]
    public function admin_can_list_users(): void
    {
        $admin = $this->createAdmin();
        User::factory()->requester()->create(['email_verified_at' => now()]);
        User::factory()->errander()->create(['email_verified_at' => now()]);

        $token = $admin->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/admin/users')
            ->assertOk();
    }

    #[Test]
    public function admin_can_suspend_user(): void
    {
        $admin = $this->createAdmin();
        $user = User::factory()->requester()->create([
            'status' => UserStatus::Active, 'email_verified_at' => now(),
        ]);

        $token = $admin->createToken('test')->plainTextToken;

        $this->withToken($token)->putJson("/api/v1/admin/users/{$user->id}/suspend")
            ->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'status' => 'suspended']);
    }

    #[Test]
    public function admin_can_ban_user(): void
    {
        $admin = $this->createAdmin();
        $user = User::factory()->requester()->create([
            'status' => UserStatus::Active, 'email_verified_at' => now(),
        ]);

        $token = $admin->createToken('test')->plainTextToken;

        $this->withToken($token)->putJson("/api/v1/admin/users/{$user->id}/ban", ['reason' => 'Fraud'])
            ->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'status' => 'banned']);
    }

    #[Test]
    public function non_admin_cannot_access_admin_routes(): void
    {
        $user = User::factory()->requester()->create(['email_verified_at' => now()]);
        $user->assignRole('requester');
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $this->withToken($token)->getJson('/api/v1/admin/users')->assertForbidden();
    }

    private function createAdmin(): User
    {
        $u = User::factory()->admin()->create([
            'email_verified_at' => now(), 'phone_verified_at' => now(),
        ]);
        $u->assignRole('admin');
        return $u;
    }
}
