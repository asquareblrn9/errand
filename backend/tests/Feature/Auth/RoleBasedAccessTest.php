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

class RoleBasedAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Role Assignment
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function registered_requester_has_correct_permissions(): void
    {
        $user = User::factory()->requester()->create();
        $user->assignRole('requester');

        $this->assertTrue($user->hasRole('requester'));
        $this->assertTrue($user->can('request.create'));
        $this->assertTrue($user->can('payment.initiate'));
        $this->assertTrue($user->can('wallet.fund'));

        // Requesters should NOT have errander permissions
        $this->assertFalse($user->can('bid.create'));
        $this->assertFalse($user->can('delivery.generate_otp'));
        $this->assertFalse($user->can('wallet.withdraw'));
    }

    #[Test]
    public function registered_errander_has_correct_permissions(): void
    {
        $user = User::factory()->errander()->create();
        $user->assignRole('errander');

        $this->assertTrue($user->hasRole('errander'));
        $this->assertTrue($user->can('bid.create'));
        $this->assertTrue($user->can('delivery.generate_otp'));
        $this->assertTrue($user->can('wallet.withdraw'));

        // Erranders should NOT have requester permissions
        $this->assertFalse($user->can('request.create'));
        $this->assertFalse($user->can('payment.initiate'));
        $this->assertFalse($user->can('dispute.create'));
    }

    #[Test]
    public function admin_has_admin_permissions(): void
    {
        $user = User::factory()->admin()->create();
        $user->assignRole('admin');

        $this->assertTrue($user->hasRole('admin'));
        $this->assertTrue($user->can('admin.users'));
        $this->assertTrue($user->can('admin.disputes'));
        $this->assertTrue($user->can('admin.payments'));
        $this->assertTrue($user->can('admin.settings'));
    }

    #[Test]
    public function super_admin_has_all_permissions(): void
    {
        $user = User::factory()->create(['role' => UserRole::SuperAdmin]);
        $user->assignRole('super_admin');

        $this->assertTrue($user->hasRole('super_admin'));
        $this->assertTrue($user->can('request.create'));
        $this->assertTrue($user->can('bid.create'));
        $this->assertTrue($user->can('admin.users'));
        $this->assertTrue($user->can('admin.disputes'));
    }

    #[Test]
    public function user_can_have_multiple_roles(): void
    {
        $user = User::factory()->requester()->create();
        $user->assignRole('requester');
        $user->assignRole('company_admin');

        $this->assertTrue($user->hasRole('requester'));
        $this->assertTrue($user->hasRole('company_admin'));
        $this->assertTrue($user->hasAnyRole(['requester', 'company_admin']));
        $this->assertTrue($user->can('request.create')); // both have this
        $this->assertTrue($user->can('business.manage')); // company_admin
    }

    /*
    |--------------------------------------------------------------------------
    | Permission Caching
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function removing_role_revokes_permissions(): void
    {
        $user = User::factory()->requester()->create();
        $user->assignRole('requester');

        $this->assertTrue($user->can('request.create'));

        $user->removeRole('requester');

        // Refresh from DB and clear cache
        $user->refresh();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $this->assertFalse($user->can('request.create'));
    }

    /*
    |--------------------------------------------------------------------------
    | Guard
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function all_roles_use_web_guard(): void
    {
        $user = User::factory()->create();
        $user->assignRole('requester');

        $roles = $user->getRoleNames();

        $this->assertCount(1, $roles);
        $this->assertEquals('requester', $roles->first());
    }
}
