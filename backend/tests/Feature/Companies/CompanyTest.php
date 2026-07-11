<?php

declare(strict_types=1);

namespace Tests\Feature\Companies;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class CompanyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    #[Test]
    public function user_can_create_company(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/companies', [
            'name' => 'Acme Logistics Ltd',
            'industry' => 'Logistics',
            'rc_number' => 'RC123456',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Acme Logistics Ltd');

        $this->assertDatabaseHas('companies', ['name' => 'Acme Logistics Ltd', 'owner_id' => $user->id]);
        $this->assertDatabaseHas('company_users', ['user_id' => $user->id, 'role' => 'admin']);
    }

    #[Test]
    public function owner_can_invite_members(): void
    {
        $owner = $this->createRequester();
        $token = $owner->createToken('test')->plainTextToken;

        $company = \App\Models\Company::create([
            'name' => 'Test Co', 'slug' => 'test-co', 'owner_id' => $owner->id,
        ]);
        \App\Models\CompanyUser::create([
            'company_id' => $company->id, 'user_id' => $owner->id, 'role' => 'admin',
        ]);

        $member = User::factory()->requester()->create([
            'email' => 'member@test.com', 'email_verified_at' => now(),
        ]);
        $member->assignRole('requester');

        $response = $this->withToken($token)->postJson("/api/v1/companies/{$company->id}/invite", [
            'email' => 'member@test.com',
            'role' => 'member',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('company_users', [
            'company_id' => $company->id, 'user_id' => $member->id, 'role' => 'member',
        ]);
    }

    #[Test]
    public function can_view_company_profile(): void
    {
        $owner = $this->createRequester();
        $token = $owner->createToken('test')->plainTextToken;

        $company = \App\Models\Company::create([
            'name' => 'Test Co', 'slug' => 'test-co-2', 'owner_id' => $owner->id,
        ]);

        $this->withToken($token)->getJson("/api/v1/companies/{$company->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Test Co');
    }

    #[Test]
    public function can_list_company_members(): void
    {
        $owner = $this->createRequester();
        $token = $owner->createToken('test')->plainTextToken;

        $company = \App\Models\Company::create([
            'name' => 'Test Co', 'slug' => 'test-co-3', 'owner_id' => $owner->id,
        ]);
        \App\Models\CompanyUser::create([
            'company_id' => $company->id, 'user_id' => $owner->id, 'role' => 'admin',
        ]);

        $this->withToken($token)->getJson("/api/v1/companies/{$company->id}/members")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    private function createRequester(): User
    {
        $u = User::factory()->requester()->create([
            'email_verified_at' => now(), 'phone_verified_at' => now(), 'kyc_tier' => 1,
        ]);
        $u->assignRole(UserRole::Requester);
        return $u;
    }
}
