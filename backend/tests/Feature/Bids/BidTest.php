<?php

declare(strict_types=1);

namespace Tests\Feature\Bids;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Request;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class BidTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    #[Test]
    public function errander_can_submit_bid(): void
    {
        $request = $this->createOpenRequest();
        $errander = $this->createErrander();
        $token = $errander->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson("/api/v1/requests/{$request->id}/bids", [
                'goods_amount' => 4500,
                'service_fee' => 1500,
                'note' => 'Can deliver within 3 hours',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.goods_amount', 4500)
            ->assertJsonPath('data.status', 'pending');

        $this->assertDatabaseHas('bids', [
            'request_id' => $request->id,
            'errander_id' => $errander->id,
        ]);
    }

    #[Test]
    public function platform_fee_is_calculated_automatically(): void
    {
        $request = $this->createOpenRequest();
        $errander = $this->createErrander();
        $token = $errander->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson("/api/v1/requests/{$request->id}/bids", [
                'goods_amount' => 5000,
                'service_fee' => 5000,
            ]);

        $response->assertCreated();
        // 5% of (5000 + 5000) = 500
        $this->assertEquals(500, $response->json('data.platform_fee'));
        $this->assertEquals(10500, $response->json('data.total_amount'));
    }

    #[Test]
    public function errander_cannot_bid_twice_on_same_request(): void
    {
        $request = $this->createOpenRequest();
        $errander = $this->createErrander();
        $token = $errander->createToken('test')->plainTextToken;

        // First bid
        $this->withToken($token)->postJson("/api/v1/requests/{$request->id}/bids", [
            'goods_amount' => 4500, 'service_fee' => 1500,
        ])->assertCreated();

        // Duplicate
        $this->withToken($token)->postJson("/api/v1/requests/{$request->id}/bids", [
            'goods_amount' => 5000, 'service_fee' => 2000,
        ])->assertStatus(422);
    }

    #[Test]
    public function requester_cannot_submit_bid(): void
    {
        $request = $this->createOpenRequest();
        $requester = $this->createRequester();
        $token = $requester->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson("/api/v1/requests/{$request->id}/bids", [
            'goods_amount' => 4500, 'service_fee' => 1500,
        ])->assertForbidden();
    }

    #[Test]
    public function cannot_bid_on_non_open_request(): void
    {
        $request = Request::factory()->create([
            'user_id' => $this->createRequester()->id,
            'category_id' => Category::first()->id,
            'status' => RequestStatus::Cancelled,
        ]);
        $errander = $this->createErrander();
        $token = $errander->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson("/api/v1/requests/{$request->id}/bids", [
            'goods_amount' => 4500, 'service_fee' => 1500,
        ])->assertStatus(422);
    }

    #[Test]
    public function owner_can_accept_bid(): void
    {
        $requester = $this->createRequester();
        $request = $this->createOpenRequest($requester);
        $errander = $this->createErrander();

        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4500,
            'service_fee' => 1500,
            'platform_fee' => 300,
            'total_amount' => 6300,
            'status' => BidStatus::Pending,
        ]);

        $token = $requester->createToken('test')->plainTextToken;
        $response = $this->withToken($token)->postJson("/api/v1/bids/{$bid->id}/accept");

        $response->assertOk()
            ->assertJsonPath('data.bid.status', 'accepted');

        $this->assertDatabaseHas('bids', ['id' => $bid->id, 'status' => 'accepted']);
        $this->assertDatabaseHas('requests', ['id' => $request->id, 'status' => 'assigned']);
    }

    #[Test]
    public function accepting_bid_rejects_other_bids(): void
    {
        $requester = $this->createRequester();
        $request = $this->createOpenRequest($requester);

        // Two erranders bid
        $errander1 = $this->createErrander();
        $errander2 = $this->createErrander(['email' => 'errander2@test.com', 'phone' => '+2348090000002']);

        $bid1 = $request->bids()->create([
            'errander_id' => $errander1->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Pending,
        ]);
        $bid2 = $request->bids()->create([
            'errander_id' => $errander2->id,
            'goods_amount' => 4500, 'service_fee' => 1500,
            'platform_fee' => 300, 'total_amount' => 6300,
            'status' => BidStatus::Pending,
        ]);

        $token = $requester->createToken('test')->plainTextToken;
        $this->withToken($token)->postJson("/api/v1/bids/{$bid1->id}/accept")->assertOk();

        $this->assertDatabaseHas('bids', ['id' => $bid1->id, 'status' => 'accepted']);
        $this->assertDatabaseHas('bids', ['id' => $bid2->id, 'status' => 'rejected']);
    }

    #[Test]
    public function non_owner_cannot_accept_bid(): void
    {
        $requester = $this->createRequester();
        $request = $this->createOpenRequest($requester);
        $errander = $this->createErrander();

        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4500, 'service_fee' => 1500,
            'platform_fee' => 300, 'total_amount' => 6300,
            'status' => BidStatus::Pending,
        ]);

        $otherUser = $this->createRequester(['email' => 'other@test.com', 'phone' => '+2348090000005']);
        $token = $otherUser->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson("/api/v1/bids/{$bid->id}/accept")->assertForbidden();
    }

    #[Test]
    public function errander_can_withdraw_their_bid(): void
    {
        $request = $this->createOpenRequest();
        $errander = $this->createErrander();

        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4500, 'service_fee' => 1500,
            'platform_fee' => 300, 'total_amount' => 6300,
            'status' => BidStatus::Pending,
        ]);

        $token = $errander->createToken('test')->plainTextToken;
        $this->withToken($token)->deleteJson("/api/v1/bids/{$bid->id}")->assertOk();

        $this->assertDatabaseHas('bids', ['id' => $bid->id, 'status' => 'withdrawn']);
    }

    #[Test]
    public function errander_can_view_their_bids(): void
    {
        $errander = $this->createErrander();
        $request = $this->createOpenRequest();

        $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4500, 'service_fee' => 1500,
            'platform_fee' => 300, 'total_amount' => 6300,
            'status' => BidStatus::Pending,
        ]);

        $token = $errander->createToken('test')->plainTextToken;
        $this->withToken($token)->getJson('/api/v1/my/bids')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createRequester(array $overrides = []): User
    {
        $user = User::factory()->requester()->create(array_merge([
            'email_verified_at' => now(), 'phone_verified_at' => now(), 'kyc_tier' => 1,
        ], $overrides));
        $user->assignRole('requester');
        return $user;
    }

    private function createErrander(array $overrides = []): User
    {
        $user = User::factory()->errander()->create(array_merge([
            'email_verified_at' => now(), 'phone_verified_at' => now(), 'kyc_tier' => 1,
        ], $overrides));
        $user->assignRole('errander');
        return $user;
    }

    private function createOpenRequest(?User $requester = null): Request
    {
        return Request::factory()->create([
            'user_id' => ($requester ?? $this->createRequester())->id,
            'category_id' => Category::first()->id,
            'status' => RequestStatus::Open,
        ]);
    }
}
