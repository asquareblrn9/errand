<?php

declare(strict_types=1);

namespace Tests\Feature\Bids;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Enums\WalletTransactionType;
use App\Models\Bid;
use App\Models\Category;
use App\Models\Delivery;
use App\Models\Rating;
use App\Models\Request;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class ErranderHomeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    #[Test]
    public function errander_can_fetch_home_dashboard(): void
    {
        $errander = $this->createErrander();
        $wallet = Wallet::factory()->create(['user_id' => $errander->id]);

        // Yesterday + today payouts to reflect in earnings
        WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'user_id' => $errander->id,
            'type' => WalletTransactionType::Payout,
            'amount' => 5000,
            'balance_before' => 0,
            'balance_after' => 5000,
            'reference' => 'PAYOUT-test-1',
            'status' => 'completed',
            'created_at' => now()->subDay(),
        ]);
        WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'user_id' => $errander->id,
            'type' => WalletTransactionType::Payout,
            'amount' => 6500,
            'balance_before' => 5000,
            'balance_after' => 11500,
            'reference' => 'PAYOUT-test-2',
            'status' => 'completed',
            'created_at' => now(),
        ]);

        // Active errand in progress
        $requester = $this->createRequester();
        $request = $this->createOpenRequest($requester);
        $bid = Bid::create([
            'request_id' => $request->id,
            'errander_id' => $errander->id,
            'goods_amount' => 4500,
            'service_fee' => 1500,
            'platform_fee' => 300,
            'total_amount' => 6300,
            'status' => BidStatus::InProgress,
        ]);
        Delivery::create([
            'bid_id' => $bid->id,
            'request_id' => $request->id,
            'errander_id' => $errander->id,
            'started_at' => now()->subHour(),
        ]);

        // A rating received
        Rating::create([
            'request_id' => $request->id,
            'bid_id' => $bid->id,
            'reviewer_id' => $requester->id,
            'reviewee_id' => $errander->id,
            'rating' => 5,
            'is_visible' => true,
        ]);

        // Nearby open requests
        Request::factory()->count(2)->create([
            'user_id' => $this->createRequester()->id,
            'category_id' => Category::first()->id,
            'status' => RequestStatus::Open,
            'latitude' => 6.5,
            'longitude' => 3.35,
        ]);

        $token = $errander->createToken('test')->plainTextToken;
        $response = $this->withToken($token)->getJson('/api/v1/errander/home?latitude=6.5244&longitude=3.3792');

        $response->assertOk()
            ->assertJsonPath('data.earnings.today', 6500.0)
            ->assertJsonPath('data.earnings.yesterday', 5000.0)
            ->assertJsonPath('data.earnings.this_week', 11500.0)
            ->assertJsonPath('data.earnings.this_week_jobs', 2)
            ->assertJsonPath('data.active_errand.bid_id', $bid->id)
            ->assertJsonPath('data.active_errand.progress_pct', 60)
            ->assertJsonPath('data.performance.rating', 5.0)
            ->assertJsonCount(2, 'data.nearby')
            ->assertJsonStructure([
                'data' => [
                    'availability' => ['is_online'],
                    'earnings' => ['chart_today', 'chart_week'],
                    'performance' => ['accept_rate', 'on_time_pct', 'trust_score'],
                ],
            ]);
    }

    #[Test]
    public function errander_can_toggle_availability(): void
    {
        $errander = $this->createErrander();
        $token = $errander->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/errander/availability', ['is_online' => true])
            ->assertOk()
            ->assertJsonPath('data.is_online', true);
        $this->assertTrue($errander->fresh()->is_online);

        $this->withToken($token)->postJson('/api/v1/errander/availability', ['is_online' => false])
            ->assertOk()
            ->assertJsonPath('data.is_online', false);
        $this->assertFalse($errander->fresh()->is_online);
    }

    #[Test]
    public function requester_cannot_access_errander_home(): void
    {
        $requester = $this->createRequester();
        $token = $requester->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/errander/home')->assertForbidden();
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
