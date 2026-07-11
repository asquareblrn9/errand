<?php

declare(strict_types=1);

namespace Tests\Feature\Requests;

use App\Enums\RequestStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class RequestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Create Request
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function requester_can_create_request(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;
        $category = Category::first();

        $response = $this->withToken($token)->postJson('/api/v1/requests', [
            'title' => 'Buy groceries from Shoprite',
            'description' => 'Need milk, bread, eggs, butter, and sugar.',
            'category_id' => $category->id,
            'location' => 'Ikeja, Lagos',
            'latitude' => 6.6018,
            'longitude' => 3.3515,
            'budget_hint' => 5000,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.title', 'Buy groceries from Shoprite')
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.category.id', $category->id);

        $this->assertDatabaseHas('requests', [
            'title' => 'Buy groceries from Shoprite',
            'status' => 'open',
        ]);
    }

    #[Test]
    public function errander_cannot_create_request(): void
    {
        $user = $this->createErrander();
        $token = $user->createToken('test')->plainTextToken;
        $category = Category::first();

        $this->withToken($token)->postJson('/api/v1/requests', [
            'title' => 'Test',
            'description' => 'Test desc',
            'category_id' => $category->id,
            'location' => 'Lagos',
            'latitude' => 6.5,
            'longitude' => 3.3,
        ])->assertForbidden();
    }

    #[Test]
    public function create_request_validates_required_fields(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/requests', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'description', 'category_id', 'location']);
    }

    /*
    |--------------------------------------------------------------------------
    | Request Feed
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function errander_can_browse_feed(): void
    {
        $errander = $this->createErrander();
        $token = $errander->createToken('test')->plainTextToken;

        $requester = $this->createRequester();
        $category = Category::first();

        \App\Models\Request::factory()->count(3)->create([
            'user_id' => $requester->id,
            'category_id' => $category->id,
            'status' => RequestStatus::Open,
        ]);

        $response = $this->withToken($token)->getJson('/api/v1/requests');

        $response->assertOk()
            ->assertJsonCount(3, 'data');
    }

    #[Test]
    public function feed_filters_by_category(): void
    {
        $errander = $this->createErrander();
        $token = $errander->createToken('test')->plainTextToken;
        $requester = $this->createRequester();

        $food = Category::where('slug', 'food-groceries')->first();
        $electronics = Category::where('slug', 'electronics')->first();

        \App\Models\Request::factory()->create([
            'user_id' => $requester->id,
            'category_id' => $food->id,
            'status' => RequestStatus::Open,
        ]);
        \App\Models\Request::factory()->create([
            'user_id' => $requester->id,
            'category_id' => $electronics->id,
            'status' => RequestStatus::Open,
        ]);

        $response = $this->withToken($token)->getJson(
            "/api/v1/requests?category_id={$food->id}"
        );

        $response->assertOk()->assertJsonCount(1, 'data');
    }

    /*
    |--------------------------------------------------------------------------
    | View Request
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function any_authenticated_user_can_view_request(): void
    {
        $requester = $this->createRequester();
        $category = Category::first();

        $request = \App\Models\Request::factory()->create([
            'user_id' => $requester->id,
            'category_id' => $category->id,
            'status' => RequestStatus::Open,
        ]);

        $errander = $this->createErrander();
        $token = $errander->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson("/api/v1/requests/{$request->id}")
            ->assertOk()
            ->assertJsonPath('data.title', $request->title);
    }

    /*
    |--------------------------------------------------------------------------
    | Update Request
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function owner_can_update_their_open_request(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;
        $category = Category::first();

        $request = \App\Models\Request::factory()->create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'status' => RequestStatus::Open,
        ]);

        $this->withToken($token)->putJson("/api/v1/requests/{$request->id}", [
            'title' => 'Updated Title',
        ])->assertOk()
            ->assertJsonPath('data.title', 'Updated Title');
    }

    #[Test]
    public function non_owner_cannot_update_request(): void
    {
        $owner = $this->createRequester();
        $category = Category::first();

        $request = \App\Models\Request::factory()->create([
            'user_id' => $owner->id,
            'category_id' => $category->id,
            'status' => RequestStatus::Open,
        ]);

        $otherUser = User::factory()->requester()->create();
        $otherUser->assignRole('requester');
        $token = $otherUser->createToken('test')->plainTextToken;

        $this->withToken($token)->putJson("/api/v1/requests/{$request->id}", [
            'title' => 'Hacked',
        ])->assertNotFound();
    }

    /*
    |--------------------------------------------------------------------------
    | Cancel Request
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function owner_can_cancel_open_request(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;
        $category = Category::first();

        $request = \App\Models\Request::factory()->create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'status' => RequestStatus::Open,
        ]);

        $this->withToken($token)->deleteJson("/api/v1/requests/{$request->id}")
            ->assertOk();

        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'status' => 'cancelled',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | My Requests
    |--------------------------------------------------------------------------
    */

    #[Test]
    public function requester_can_view_their_requests(): void
    {
        $user = $this->createRequester();
        $token = $user->createToken('test')->plainTextToken;
        $category = Category::first();

        \App\Models\Request::factory()->count(2)->create([
            'user_id' => $user->id,
            'category_id' => $category->id,
        ]);

        $this->withToken($token)->getJson('/api/v1/my/requests')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createRequester(): User
    {
        $user = User::factory()->requester()->create([
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'kyc_tier' => 1,
        ]);
        $user->assignRole('requester');
        return $user;
    }

    private function createErrander(): User
    {
        $user = User::factory()->errander()->create([
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'kyc_tier' => 1,
        ]);
        $user->assignRole('errander');
        return $user;
    }
}
