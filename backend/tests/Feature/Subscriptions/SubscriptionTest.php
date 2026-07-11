<?php

declare(strict_types=1);

namespace Tests\Feature\Subscriptions;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class SubscriptionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(PlanSeeder::class);
    }

    #[Test]
    public function plans_are_publicly_accessible(): void
    {
        $this->getJson('/api/v1/plans')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    #[Test]
    public function user_can_subscribe_to_plan(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;
        $plan = \App\Models\Plan::where('slug', 'pro')->first();

        $response = $this->withToken($token)->postJson('/api/v1/subscriptions', [
            'plan_id' => $plan->id,
            'billing_cycle' => 'monthly',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.plan', 'Pro')
            ->assertJsonPath('data.amount', 5000);
    }

    #[Test]
    public function user_can_view_current_subscription(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;
        $plan = \App\Models\Plan::where('slug', 'pro')->first();

        $this->withToken($token)->postJson('/api/v1/subscriptions', [
            'plan_id' => $plan->id,
        ]);

        $response = $this->withToken($token)->getJson('/api/v1/my/subscription');
        $response->assertOk()->assertJsonPath('data.plan.name', 'Pro');
    }

    #[Test]
    public function user_can_cancel_subscription(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;
        $plan = \App\Models\Plan::where('slug', 'pro')->first();

        $this->withToken($token)->postJson('/api/v1/subscriptions', ['plan_id' => $plan->id]);

        $this->withToken($token)->postJson('/api/v1/subscriptions/cancel')
            ->assertOk();
    }

    private function createUser(): User
    {
        $u = User::factory()->requester()->create([
            'email_verified_at' => now(), 'phone_verified_at' => now(), 'kyc_tier' => 1,
        ]);
        $u->assignRole(UserRole::Requester);
        return $u;
    }
}
