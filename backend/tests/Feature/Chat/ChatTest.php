<?php

declare(strict_types=1);

namespace Tests\Feature\Chat;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Conversation;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
        $this->seed(CategorySeeder::class);
    }

    #[Test]
    public function participant_can_send_message(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $conversation = $this->createConversation($requester, $errander);

        $token = $requester->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson("/api/v1/conversations/{$conversation->id}/messages", [
                'content' => 'Hello, when will you deliver?',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.content', 'Hello, when will you deliver?');

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'sender_id' => $requester->id,
        ]);
    }

    #[Test]
    public function non_participant_cannot_send_message(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $conversation = $this->createConversation($requester, $errander);

        $outsider = User::factory()->requester()->create([
            'email' => 'outsider@test.com', 'phone' => '+2348090000099',
        ]);
        $outsider->assignRole('requester');

        $token = $outsider->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/conversations/{$conversation->id}/messages", [
                'content' => 'Hacked!',
            ])
            ->assertForbidden();
    }

    #[Test]
    public function participant_can_list_conversations(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $this->createConversation($requester, $errander);

        $token = $requester->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/conversations');

        $response->assertOk()->assertJsonCount(1, 'data');
    }

    #[Test]
    public function participant_can_view_messages(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $conversation = $this->createConversation($requester, $errander);

        $conversation->messages()->create([
            'sender_id' => $requester->id, 'content' => 'Hi there',
        ]);

        $token = $requester->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/v1/conversations/{$conversation->id}/messages")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    #[Test]
    public function participant_can_mark_messages_as_read(): void
    {
        $requester = $this->createRequester();
        $errander = $this->createErrander();
        $conversation = $this->createConversation($requester, $errander);

        $conversation->messages()->create([
            'sender_id' => $errander->id, 'content' => 'I will deliver soon',
        ]);
        $conversation->update(['requester_unread_count' => 1]);

        $token = $requester->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/conversations/{$conversation->id}/read")
            ->assertOk();

        $this->assertDatabaseHas('conversations', [
            'id' => $conversation->id,
            'requester_unread_count' => 0,
        ]);
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

    private function createConversation(User $requester, User $errander): Conversation
    {
        $request = \App\Models\Request::create([
            'user_id' => $requester->id, 'category_id' => Category::first()->id,
            'title' => 'T', 'description' => 'D', 'location' => 'L',
            'status' => RequestStatus::InProgress,
        ]);

        return Conversation::create([
            'request_id' => $request->id,
            'requester_id' => $requester->id,
            'errander_id' => $errander->id,
        ]);
    }
}
