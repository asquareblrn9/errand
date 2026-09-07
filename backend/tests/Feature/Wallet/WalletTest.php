<?php

declare(strict_types=1);

namespace Tests\Feature\Wallet;

use App\Enums\UserRole;
use App\Enums\WalletTransactionType;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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
        Http::fake([
            config('services.paystack.base_url').'/*' => Http::response([
                'status' => true,
                'data' => [
                    'authorization_url' => 'https://checkout.paystack.com/test',
                    'access_code' => 'test-code',
                    'reference' => 'FUND-TEST',
                ],
            ], 200),
        ]);

        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/wallet/fund', [
            'amount' => 50000,
            'payment_gateway' => 'paystack',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.authorization_url', 'https://checkout.paystack.com/test')
            ->assertJsonPath('data.provider', 'paystack')
            ->assertJsonPath('data.reference', fn ($v) => str_starts_with($v, 'FUND-'));

        $this->assertDatabaseHas('wallet_fundings', [
            'user_id' => $user->id,
            'provider' => 'paystack',
            'amount' => 50000,
            'status' => 'pending',
        ]);

        // Web (no platform) keeps the frontend redirect
        Http::assertSent(fn ($request) => str_contains($request->url(), '/transaction/initialize')
            && str_starts_with($request['callback_url'], config('app.frontend_url').'/wallet?funded=true&provider=paystack'));
    }

    #[Test]
    public function mobile_fund_redirects_to_completion_page_for_deep_link(): void
    {
        Http::fake([
            config('services.paystack.base_url').'/*' => Http::response([
                'status' => true,
                'data' => [
                    'authorization_url' => 'https://checkout.paystack.com/test',
                    'access_code' => 'test-code',
                    'reference' => 'FUND-TEST',
                ],
            ], 200),
            config('services.flutterwave.base_url').'/*' => Http::response([
                'status' => 'success',
                'message' => 'Hosted link generated',
                'data' => ['link' => 'https://checkout.flutterwave.com/test'],
            ], 200),
        ]);

        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        // Android + Paystack → callback_url points at the completion page
        $this->withToken($token)->postJson('/api/v1/wallet/fund', [
            'amount' => 50000,
            'payment_gateway' => 'paystack',
            'platform' => 'android',
        ])->assertCreated();

        Http::assertSent(fn ($request) => str_contains($request->url(), '/transaction/initialize')
            && str_starts_with($request['callback_url'], config('app.url').'/api/v1/payments/complete/FUND-'));

        // iOS + Flutterwave → redirect_url points at the completion page
        $this->withToken($token)->postJson('/api/v1/wallet/fund', [
            'amount' => 50000,
            'payment_gateway' => 'flutterwave',
            'platform' => 'ios',
        ])->assertCreated();

        Http::assertSent(fn ($request) => str_contains($request->url(), '/v3/payments')
            && str_starts_with($request['redirect_url'], config('app.url').'/api/v1/payments/complete/FUND-'));
    }

    #[Test]
    public function web_platform_keeps_frontend_redirect(): void
    {
        Http::fake([
            config('services.flutterwave.base_url').'/*' => Http::response([
                'status' => 'success',
                'message' => 'Hosted link generated',
                'data' => ['link' => 'https://checkout.flutterwave.com/test'],
            ], 200),
        ]);

        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/wallet/fund', [
            'amount' => 50000,
            'payment_gateway' => 'flutterwave',
            'platform' => 'web',
        ])->assertCreated();

        Http::assertSent(fn ($request) => str_contains($request->url(), '/v3/payments')
            && str_starts_with($request['redirect_url'], config('app.frontend_url').'/wallet?funded=true&provider=flutterwave'));
    }

    #[Test]
    public function fund_rejects_unknown_platform(): void
    {
        Http::fake();

        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/wallet/fund', [
            'amount' => 50000,
            'payment_gateway' => 'paystack',
            'platform' => 'windows',
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('wallet_fundings', ['user_id' => $user->id]);
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

        $wallet = $this->createWalletWithBalance($user, 30000);

        // Two deposits to page through
        foreach ([10000, 20000] as $amount) {
            WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => WalletTransactionType::Deposit,
                'amount' => $amount,
                'balance_before' => 0,
                'balance_after' => $amount,
                'reference' => "FUND-TEST-{$amount}",
                'description' => 'Wallet funded',
                'status' => 'successful',
            ]);
        }

        $response = $this->withToken($token)->getJson('/api/v1/wallet/transactions');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2);
    }

    #[Test]
    public function user_can_withdraw_to_bank(): void
    {
        Http::fake([
            config('services.paystack.base_url').'/transferrecipient' => Http::response([
                'status' => true,
                'data' => ['recipient_code' => 'RCP_test'],
            ], 200),
            config('services.paystack.base_url').'/transfer' => Http::response([
                'status' => true,
                'data' => ['transfer_code' => 'TRF_test', 'reference' => 'TRF-TEST', 'status' => 'success'],
            ], 200),
        ]);

        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->createWalletWithBalance($user, 50000);
        $this->createBankAccount($user);

        $response = $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 10000,
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

        // The saved bank (not body fields) must be used for the payout
        $this->assertDatabaseHas('withdrawals', [
            'user_id' => $user->id,
            'account_number' => '0123456789',
        ]);
    }

    #[Test]
    public function withdraw_without_bank_account_returns_422_no_bank_account(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->createWalletWithBalance($user, 50000);

        $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 10000,
        ])->assertStatus(422)
            ->assertJsonPath('code', 'no_bank_account');
    }

    #[Test]
    public function cannot_withdraw_more_than_available_balance(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->createWalletWithBalance($user, 5000);
        $this->createBankAccount($user);

        $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 10000,
        ])->assertStatus(422);
    }

    #[Test]
    public function cannot_withdraw_below_minimum(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->createWalletWithBalance($user, 5000);
        $this->createBankAccount($user);

        $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 500,
        ])->assertStatus(422);
    }

    #[Test]
    public function withdrawal_fee_is_capped_at_200(): void
    {
        Http::fake([
            config('services.paystack.base_url').'/transferrecipient' => Http::response([
                'status' => true,
                'data' => ['recipient_code' => 'RCP_test'],
            ], 200),
            config('services.paystack.base_url').'/transfer' => Http::response([
                'status' => true,
                'data' => ['transfer_code' => 'TRF_test', 'reference' => 'TRF-TEST', 'status' => 'success'],
            ], 200),
        ]);

        $user = $this->createUser();
        $token = $user->createToken('test')->plainTextToken;

        $this->createWalletWithBalance($user, 500000);
        $this->createBankAccount($user);

        // 1.5% of 20000 = 300, but capped at 200
        $response = $this->withToken($token)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 20000,
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

    /** Seed a wallet with a starting balance (funding goes through the gateway). */
    private function createWalletWithBalance(User $user, float $balance): Wallet
    {
        return Wallet::create([
            'user_id' => $user->id,
            'balance' => $balance,
            'currency' => 'NGN',
            'status' => 'active',
        ]);
    }

    /** Create a verified payout bank account for the user. */
    private function createBankAccount(User $user, string $accountNumber = '0123456789'): \App\Models\BankAccount
    {
        return \App\Models\BankAccount::create([
            'user_id' => $user->id,
            'kyc_verification_id' => (string) \Illuminate\Support\Str::uuid(),
            'bank_name' => 'Access Bank',
            'bank_code' => '044',
            'account_number' => $accountNumber,
            'account_name' => 'John Doe',
            'is_verified' => true,
            'is_primary' => true,
        ]);
    }
}
