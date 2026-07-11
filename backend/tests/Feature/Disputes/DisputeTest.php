<?php

declare(strict_types=1);

namespace Tests\Feature\Disputes;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Delivery;
use App\Models\Dispute;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class DisputeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    #[Test]
    public function requester_can_open_dispute_on_confirmed_delivery(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $delivery = $this->createConfirmedDelivery($requester, $errander);

        $token = $requester->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/disputes', [
            'delivery_id' => $delivery->id,
            'reason' => 'Items not as described',
            'description' => 'Received Brand Y instead of Brand X.',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'open');

        $this->assertDatabaseHas('disputes', ['delivery_id' => $delivery->id]);
        $this->assertDatabaseHas('requests', ['id' => $delivery->request_id, 'status' => 'disputed']);
    }

    #[Test]
    public function non_owner_cannot_open_dispute(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $delivery = $this->createConfirmedDelivery($requester, $errander);

        $token = $errander->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/disputes', [
            'delivery_id' => $delivery->id,
            'reason' => 'Test',
            'description' => 'Test',
        ])->assertForbidden();
    }

    #[Test]
    public function cannot_open_dispute_on_unconfirmed_delivery(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $delivery = $this->createUnconfirmedDelivery($requester, $errander);

        $token = $requester->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/disputes', [
            'delivery_id' => $delivery->id,
            'reason' => 'Test',
            'description' => 'Test',
        ])->assertStatus(422);
    }

    #[Test]
    public function errander_can_respond_to_dispute(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $delivery = $this->createConfirmedDelivery($requester, $errander);

        $dispute = Dispute::create([
            'delivery_id' => $delivery->id, 'bid_id' => $delivery->bid_id,
            'request_id' => $delivery->request_id, 'raised_by' => $requester->id,
            'errander_id' => $errander->id, 'reason' => 'Test', 'description' => 'Test',
            'status' => 'open',
        ]);

        $token = $errander->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson("/api/v1/disputes/{$dispute->id}/respond", [
                'response' => 'I purchased exactly what was requested. Here is the receipt.',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'under_review');
    }

    #[Test]
    public function user_can_view_their_disputes(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $delivery = $this->createConfirmedDelivery($requester, $errander);

        Dispute::create([
            'delivery_id' => $delivery->id, 'bid_id' => $delivery->bid_id,
            'request_id' => $delivery->request_id, 'raised_by' => $requester->id,
            'errander_id' => $errander->id, 'reason' => 'Test', 'description' => 'Test',
            'status' => 'open',
        ]);

        $token = $requester->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/my/disputes')
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

    private function createErrander(): User
    {
        $u = User::factory()->errander()->create([
            'email_verified_at' => now(), 'phone_verified_at' => now(), 'kyc_tier' => 1,
        ]);
        $u->assignRole(UserRole::Errander);
        return $u;
    }

    private function createConfirmedDelivery(User $requester, User $errander): Delivery
    {
        $r = \App\Models\Request::create([
            'user_id' => $requester->id, 'category_id' => Category::first()->id,
            'title' => 'T', 'description' => 'D', 'location' => 'L',
            'status' => RequestStatus::Delivered,
        ]);
        $bid = \App\Models\Bid::create([
            'request_id' => $r->id, 'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);
        return Delivery::create([
            'bid_id' => $bid->id, 'request_id' => $r->id,
            'errander_id' => $errander->id, 'dispute_window_hours' => 24,
            'confirmed' => true, 'confirmed_at' => now(),
            'dispute_window_closes_at' => now()->addHours(24),
        ]);
    }

    private function createUnconfirmedDelivery(User $requester, User $errander): Delivery
    {
        $r = \App\Models\Request::create([
            'user_id' => $requester->id, 'category_id' => Category::first()->id,
            'title' => 'T', 'description' => 'D', 'location' => 'L',
            'status' => RequestStatus::InProgress,
        ]);
        $bid = \App\Models\Bid::create([
            'request_id' => $r->id, 'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);
        return Delivery::create([
            'bid_id' => $bid->id, 'request_id' => $r->id,
            'errander_id' => $errander->id, 'dispute_window_hours' => 24,
            'confirmed' => false,
        ]);
    }
}
