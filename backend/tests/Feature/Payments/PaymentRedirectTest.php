<?php

declare(strict_types=1);

namespace Tests\Feature\Payments;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Payment;
use App\Models\Request;
use App\Models\User;
use App\Models\WalletFunding;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

/**
 * The completion page providers redirect to after checkout. It deep-links
 * back into the mobile app (errandboy://) with the provider reference so the
 * app can run its server-side verification.
 */
class PaymentRedirectTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    #[Test]
    public function wallet_funding_ref_renders_wallet_deep_link(): void
    {
        $user = $this->createUser();
        $funding = WalletFunding::create([
            'user_id' => $user->id,
            'provider' => 'paystack',
            'provider_ref' => 'FUND-TEST123',
            'amount' => 50000,
            'currency' => 'NGN',
            'status' => 'pending',
        ]);

        $response = $this->get('/api/v1/payments/complete/'.$funding->provider_ref.'?status=successful');

        $response->assertOk()
            ->assertSee('errandboy://wallet?payment_ref=FUND-TEST123&status=successful&provider=paystack', false)
            ->assertSee('Payment Successful', false);
    }

    #[Test]
    public function wallet_funding_ref_defaults_status_to_pending(): void
    {
        $user = $this->createUser();
        $funding = WalletFunding::create([
            'user_id' => $user->id,
            'provider' => 'flutterwave',
            'provider_ref' => 'FUND-FLW123',
            'amount' => 20000,
            'currency' => 'NGN',
            'status' => 'pending',
        ]);

        $response = $this->get('/api/v1/payments/complete/'.$funding->provider_ref);

        $response->assertOk()
            ->assertSee('errandboy://wallet?payment_ref=FUND-FLW123&status=pending&provider=flutterwave', false);
    }

    #[Test]
    public function bid_payment_ref_still_renders_request_deep_link(): void
    {
        $requester = $this->createUser();
        $errander = User::factory()->errander()->create([
            'email_verified_at' => now(), 'phone_verified_at' => now(), 'kyc_tier' => 1,
        ]);
        $errander->assignRole(UserRole::Errander);

        $request = Request::factory()->create([
            'user_id' => $requester->id,
            'category_id' => Category::first()->id,
            'status' => RequestStatus::Open,
        ]);
        $bid = $request->bids()->create([
            'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        $payment = Payment::create([
            'user_id' => $requester->id,
            'bid_id' => $bid->id,
            'request_id' => $request->id,
            'provider' => 'paystack',
            'provider_ref' => 'EB-TEST123',
            'amount' => 5250,
            'currency' => 'NGN',
            'status' => 'pending',
            'payment_method' => 'card',
        ]);

        $response = $this->get('/api/v1/payments/complete/'.$payment->provider_ref.'?status=failed');

        $response->assertOk()
            ->assertSee("errandboy://requests/{$request->id}?payment_ref=EB-TEST123&status=failed", false)
            ->assertSee('Payment Failed', false);
    }

    #[Test]
    public function unknown_ref_renders_page_without_deep_link(): void
    {
        $response = $this->get('/api/v1/payments/complete/UNKNOWN-REF');

        $response->assertOk()
            ->assertDontSee('errandboy://', false);
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
