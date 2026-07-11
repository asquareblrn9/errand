<?php

declare(strict_types=1);

namespace Tests\Feature\Delivery;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Request as RequestModel;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class DeliveryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    #[Test]
    public function assigned_errander_can_generate_otp(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createInProgressRequest_old($requester, $errander);

        $token = $errander->createToken('test')->plainTextToken;

        $bid = $request->bids()->where('errander_id', $errander->id)->first();

        $response = $this->withToken($token)
            ->postJson("/api/v1/deliveries/{$bid->id}/generate-otp");

        $response->assertOk()
            ->assertJsonPath('data.otp', fn ($v) => strlen($v) === 6)
            ->assertJsonPath('data.expires_in_minutes', 30);

        // Request should be in 'delivered' status
        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'status' => 'delivered',
        ]);

        // OTP should be in cache
        $cachedOtp = Cache::get("delivery:{$bid->id}:otp");
        $this->assertNotNull($cachedOtp);
    }

    #[Test]
    public function requester_cannot_generate_otp(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createInProgressRequest_old($requester, $errander);

        $bid = $request->bids()->first();
        $token = $requester->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/deliveries/{$bid->id}/generate-otp")
            ->assertForbidden();
    }

    #[Test]
    public function requester_can_confirm_delivery_with_correct_otp(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();

        // Create request owned by requester
        $request = \App\Models\Request::create([
            'id' => \Illuminate\Support\Str::orderedUuid()->toString(),
            'user_id' => $requester->id,
            'category_id' => Category::first()->id,
            'title' => 'Test', 'description' => 'Test', 'location' => 'Test',
            'status' => RequestStatus::InProgress,
        ]);

        // Create accepted bid by errander
        $bid = \App\Models\Bid::create([
            'id' => \Illuminate\Support\Str::orderedUuid()->toString(),
            'request_id' => $request->id,
            'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        // Generate OTP manually via service (bypasses API)
        $otpService = app(\App\Services\DeliveryOtpService::class);
        $otpResult = $otpService->generate($bid, $errander);
        $otp = $otpResult['otp'];

        // Confirm via service directly
        $delivery = $otpService->confirm($bid, $requester, $otp);

        $this->assertTrue($delivery->confirmed, 'Delivery should be confirmed');
        $this->assertNotNull($delivery->dispute_window_closes_at);
    }

    #[Test]
    public function confirm_fails_with_wrong_otp(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();

        $request = \App\Models\Request::create([
            'user_id' => $requester->id, 'category_id' => Category::first()->id,
            'title' => 'T', 'description' => 'D', 'location' => 'L',
            'status' => RequestStatus::InProgress,
        ]);
        $bid = \App\Models\Bid::create([
            'request_id' => $request->id, 'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        $otpService = app(\App\Services\DeliveryOtpService::class);
        $otpService->generate($bid, $errander);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid OTP');
        $otpService->confirm($bid, $requester, '000000');
    }

    #[Test]
    public function otp_expires_after_30_minutes(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();

        $request = \App\Models\Request::create([
            'user_id' => $requester->id, 'category_id' => Category::first()->id,
            'title' => 'T', 'description' => 'D', 'location' => 'L',
            'status' => RequestStatus::InProgress,
        ]);
        $bid = \App\Models\Bid::create([
            'request_id' => $request->id, 'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        $otpService = app(\App\Services\DeliveryOtpService::class);
        $otpResult = $otpService->generate($bid, $errander);

        // Travel 31 minutes into the future to expire the OTP
        $this->travel(31)->minutes();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('OTP has expired');
        $otpService->confirm($bid, $requester, $otpResult['otp']);
    }

    #[Test]
    public function can_view_delivery_details(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $request = $this->createInProgressRequest_old($requester, $errander);
        $bid = $request->bids()->first();

        $token = $errander->createToken('test')->plainTextToken;
        $this->withToken($token)->postJson("/api/v1/deliveries/{$bid->id}/generate-otp");

        $this->withToken($token)->getJson("/api/v1/deliveries/{$bid->id}")
            ->assertOk()
            ->assertJsonPath('data.confirmed', false);
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

    private function createInProgressRequest_old(User $requester, User $errander): \App\Models\Request
    {
        $request = \App\Models\Request::create([
            'user_id' => $requester->id,
            'category_id' => Category::first()->id,
            'title' => 'Test Request',
            'description' => 'Test Description',
            'location' => 'Lagos, Nigeria',
            'status' => RequestStatus::InProgress,
        ]);

        \App\Models\Bid::create([
            'request_id' => $request->id,
            'errander_id' => $errander->id,
            'goods_amount' => 4000,
            'service_fee' => 1000,
            'platform_fee' => 250,
            'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);

        return $request->fresh();
    }
}
