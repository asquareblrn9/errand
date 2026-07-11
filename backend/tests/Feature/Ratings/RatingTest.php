<?php

declare(strict_types=1);

namespace Tests\Feature\Ratings;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class RatingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    #[Test]
    public function user_can_submit_rating(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $bid = $this->createBid($requester, $errander);

        $token = $requester->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/ratings', [
            'bid_id' => $bid->id,
            'rating' => 4,
            'review' => 'Great service!',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.rating', 4)
            ->assertJsonPath('data.is_visible', false); // Blind until both rate

        $this->assertDatabaseHas('ratings', ['bid_id' => $bid->id, 'reviewer_id' => $requester->id]);
    }

    #[Test]
    public function cannot_rate_twice(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $bid = $this->createBid($requester, $errander);

        $token = $requester->createToken('test')->plainTextToken;
        $this->withToken($token)->postJson('/api/v1/ratings', ['bid_id' => $bid->id, 'rating' => 4]);
        $this->withToken($token)->postJson('/api/v1/ratings', ['bid_id' => $bid->id, 'rating' => 5])
            ->assertStatus(422);
    }

    #[Test]
    public function requester_submitting_rating_creates_record(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $bid = $this->createBid($requester, $errander);

        $token = $requester->createToken('test')->plainTextToken;
        $this->withToken($token)->postJson('/api/v1/ratings', ['bid_id' => $bid->id, 'rating' => 4])
            ->assertCreated();

        $this->assertDatabaseHas('ratings', ['bid_id' => $bid->id]);
    }

    #[Test]
    public function trust_score_is_updated_after_rating(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $bid = $this->createBid($requester, $errander);

        // Create initial stats for errander
        \App\Models\ErranderStats::create([
            'user_id' => $errander->id, 'completed_orders' => 10,
            'total_bids_accepted' => 12, 'trust_score' => 3.5,
        ]);

        $token = $requester->createToken('test')->plainTextToken;
        $response = $this->withToken($token)->postJson('/api/v1/ratings', [
            'bid_id' => $bid->id, 'rating' => 5,
        ]);

        $response->assertCreated();

        // Trust score should be recalculated
        $this->assertDatabaseHas('errander_stats', ['user_id' => $errander->id]);
        $stats = \App\Models\ErranderStats::where('user_id', $errander->id)->first();
        $this->assertGreaterThan(0, $stats->trust_score);
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

    private function createErrander2(): User
    {
        $u = User::factory()->errander()->create([
            'email' => 'errander2@test.com', 'phone' => '+2348090000098',
            'email_verified_at' => now(), 'phone_verified_at' => now(), 'kyc_tier' => 1,
        ]);
        $u->assignRole(UserRole::Errander);
        return $u;
    }

    private function createBid(User $requester, User $errander): \App\Models\Bid
    {
        $r = \App\Models\Request::create([
            'user_id' => $requester->id, 'category_id' => Category::first()->id,
            'title' => 'T', 'description' => 'D', 'location' => 'L',
            'status' => RequestStatus::Completed,
        ]);
        return \App\Models\Bid::create([
            'request_id' => $r->id, 'errander_id' => $errander->id,
            'goods_amount' => 4000, 'service_fee' => 1000,
            'platform_fee' => 250, 'total_amount' => 5250,
            'status' => BidStatus::Accepted,
        ]);
    }
}
