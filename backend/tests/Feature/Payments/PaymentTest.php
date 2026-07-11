<?php

declare(strict_types=1);

namespace Tests\Feature\Payments;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Enums\UserRole;
use App\Models\Bid;
use App\Models\Category;
use App\Models\Request;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    #[Test]
    public function requester_can_pay_accepted_bid_with_wallet(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createOpenRequest($requester);

        // Fund wallet
        $wallet = \App\Models\Wallet::create([
            'user_id' => $requester->id, 'balance' => 50000, 'currency' => 'NGN',
        ]);

        // Create + accept bid
        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        $request->update(['status' => RequestStatus::Assigned, 'accepted_bid_id' => $bid->id]);

        $token = $requester->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/payments/initiate', [
            'bid_id' => $bid->id,
            'payment_method' => 'wallet',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.provider_ref', fn ($v) => ! empty($v))
            ->assertJsonPath('data.status', 'successful')
            ->assertJsonPath('data.amount', 5250);

        $this->assertDatabaseHas('payments', [
            'bid_id' => $bid->id,
            'status' => 'successful',
        ]);

        // Request should be in_progress
        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'status' => 'in_progress',
        ]);
    }

    #[Test]
    public function cannot_pay_unaccepted_bid(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createOpenRequest($requester);

        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Pending,
        ]);

        $token = $requester->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/payments/initiate', [
            'bid_id' => $bid->id,
        ])->assertStatus(422);
    }

    #[Test]
    public function non_owner_cannot_pay(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createOpenRequest($requester);

        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        $otherUser = $this->createRequester(['email' => 'other@test.com', 'phone' => '+2348090000100']);
        $token = $otherUser->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/payments/initiate', [
            'bid_id' => $bid->id,
        ])->assertForbidden();
    }

    #[Test]
    public function flutterwave_webhook_confirms_payment(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createOpenRequest($requester);
        $request->update(['status' => RequestStatus::Assigned]);

        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        $token = $requester->createToken('test')->plainTextToken;
        $initiate = $this->withToken($token)->postJson('/api/v1/payments/initiate', [
            'bid_id' => $bid->id,
            'payment_method' => 'card',
        ]);

        $providerRef = $initiate->json('data.provider_ref');

        // Simulate Flutterwave webhook
        $this->postJson('/api/v1/payments/webhook/flutterwave', [
            'status' => 'successful',
            'tx_ref' => $providerRef,
            'id' => 123456,
        ])->assertOk();

        $this->assertDatabaseHas('payments', [
            'provider_ref' => $providerRef,
            'status' => 'successful',
        ]);
    }

    #[Test]
    public function webhook_is_idempotent(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createOpenRequest($requester);
        $request->update(['status' => RequestStatus::Assigned]);

        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        $token = $requester->createToken('test')->plainTextToken;
        $initiate = $this->withToken($token)->postJson('/api/v1/payments/initiate', [
            'bid_id' => $bid->id,
            'payment_method' => 'card',
        ]);
        $ref = $initiate->json('data.provider_ref');

        // Send webhook twice
        $this->postJson('/api/v1/payments/webhook/flutterwave', ['status' => 'successful', 'tx_ref' => $ref]);
        $this->postJson('/api/v1/payments/webhook/flutterwave', ['status' => 'successful', 'tx_ref' => $ref]);

        // Should still be just one payment
        $this->assertDatabaseHas('payments', ['provider_ref' => $ref, 'status' => 'successful']);
    }

    #[Test]
    public function user_can_view_payment_history(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createOpenRequest($requester);
        $request->update(['status' => RequestStatus::Assigned]);

        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        $wallet = \App\Models\Wallet::create([
            'user_id' => $requester->id, 'balance' => 50000, 'currency' => 'NGN',
        ]);

        $token = $requester->createToken('test')->plainTextToken;
        $this->withToken($token)->postJson('/api/v1/payments/initiate', [
            'bid_id' => $bid->id, 'payment_method' => 'wallet',
        ]);

        $this->withToken($token)->getJson('/api/v1/my/payments')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    private function createRequester(array $o = []): User
    {
        $u = User::factory()->requester()->create(array_merge([
            'email_verified_at' => now(), 'phone_verified_at' => now(), 'kyc_tier' => 1,
        ], $o));
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

    private function createOpenRequest(User $requester): Request
    {
        return Request::factory()->create([
            'user_id' => $requester->id,
            'category_id' => Category::first()->id,
            'status' => RequestStatus::Open,
        ]);
    }
}
