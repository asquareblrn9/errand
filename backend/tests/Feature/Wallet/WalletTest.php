<?php

declare(strict_types=1);

namespace Tests\Feature\Wallet;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class WalletTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    #[Test]
    public function wallet_is_auto_created_on_first_access(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/wallet');

        $response->assertOk()
            ->assertJsonPath('data.balance', 0)
            ->assertJsonPath('data.locked_balance', 0)
            ->assertJsonPath('data.available_balance', 0)
            ->assertJsonPath('data.currency', 'NGN')
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('wallets', ['user_id' => $user->id]);
    }

    #[Test]
    public function user_can_fund_wallet(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/wallet/fund', [
            'amount' => 50000,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.amount', 50000)
            ->assertJsonPath('data.balance_after', 50000);

        $this->assertDatabaseHas('wallets', ['user_id' => $user->id, 'balance' => 50000]);
    }

    #[Test]
    public function fund_validates_minimum_amount(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/wallet/fund', [
            'amount' => 100, // Below min of 1000
        ])->assertUnprocessable();
    }

    #[Test]
    public function fund_validates_maximum_amount(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/wallet/fund', [
            'amount' => 1000000, // Above max of 500000
        ])->assertUnprocessable();
    }

    #[Test]
    public function wallet_transaction_history_is_paginated(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        // Fund twice to create 2 transactions
        $this->withToken($token)->postJson('/api/v1/wallet/fund', ['amount' => 10000]);
        $this->withToken($token)->postJson('/api/v1/wallet/fund', ['amount' => 20000]);

        $response = $this->withToken($token)->getJson('/api/v1/wallet/transactions');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2);
    }

    #[Test]
    public function user_can_withdraw_to_bank(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        // Fund first
        $this->withToken($token)->postJson('/api/v1/wallet/fund', ['amount' => 50000]);

        $response = $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 10000,
            'bank_code' => '044',
            'account_number' => '0123456789',
            'account_name' => 'John Doe',
            'narration' => 'Test withdrawal',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.amount', 10000);

        // 1.5% of 10000 = 150, capped at 200
        $this->assertEquals(150, $response->json('data.fee'));
        $this->assertEquals(9850, $response->json('data.net_amount'));

        // Balance should be 50000 - 10000 = 40000
        $balance = $this->withToken($token)->getJson('/api/v1/wallet');
        $this->assertEquals(40000, $balance->json('data.balance'));
    }

    #[Test]
    public function cannot_withdraw_more_than_available_balance(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/wallet/fund', ['amount' => 5000]);

        $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 10000,
            'bank_code' => '044',
            'account_number' => '0123456789',
            'account_name' => 'John Doe',
        ])->assertStatus(422);
    }

    #[Test]
    public function cannot_withdraw_below_minimum(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/wallet/fund', ['amount' => 5000]);

        $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 500,
            'bank_code' => '044',
            'account_number' => '0123456789',
            'account_name' => 'John Doe',
        ])->assertStatus(422);
    }

    #[Test]
    public function withdrawal_fee_is_capped_at_200(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/wallet/fund', ['amount' => 500000]);

        // 1.5% of 20000 = 300, but capped at 200
        $response = $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 20000,
            'bank_code' => '044',
            'account_number' => '0123456789',
            'account_name' => 'John Doe',
        ]);

        $response->assertCreated();
        $this->assertEquals(200, $response->json('data.fee'));
        $this->assertEquals(19800, $response->json('data.net_amount'));
    }

    #[Test]
    public function unauthenticated_user_cannot_access_wallet(): void
    {
        $this->getJson('/api/v1/wallet')->assertUnauthorized();
        $this->postJson('/api/v1/wallet/fund', ['amount' => 1000])->assertUnauthorized();
        $this->getJson('/api/v1/wallet/transactions')->assertUnauthorized();
        $this->postJson('/api/v1/wallet/withdraw', [])->assertUnauthorized();
    }

    private function createUser(): User
    {
        $user = User::factory()->requester()->create([
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'kyc_tier' => 1,
        ]);
        $user->assignRole(UserRole::Requester);
        return $user;
    }
}
