<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\User;
use App\Services\ChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function __construct(
        private readonly ChatService $chatService,
    ) {}

    /**
     * List the authenticated user's conversations.
     *
     * GET /conversations
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $conversations = Conversation::where(function ($q) use ($user) {
            $q->where('requester_id', $user->id)
                ->orWhere('errander_id', $user->id);
        })
            ->with(['request:id,title', 'requester:id,name,avatar_url', 'errander:id,name,avatar_url'])
            ->orderByDesc('last_message_at')
            ->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $conversations->map(fn (Conversation $c) => [
                'id' => $c->id,
                'request_id' => $c->request_id,
                'request_title' => $c->request?->title,
                'other_user' => $user->id === $c->requester_id
                    ? ['id' => $c->errander->id, 'name' => $c->errander->name, 'avatar_url' => $c->errander->avatar_url]
                    : ['id' => $c->requester->id, 'name' => $c->requester->name, 'avatar_url' => $c->requester->avatar_url],
                'last_message' => [
                    'preview' => $c->last_message_preview,
                    'at' => $c->last_message_at?->toISOString(),
                ],
                'unread_count' => $user->id === $c->requester_id
                    ? $c->requester_unread_count
                    : $c->errander_unread_count,
                'created_at' => $c->created_at->toISOString(),
            ]),
            'meta' => [
                'current_page' => $conversations->currentPage(),
                'per_page' => $conversations->perPage(),
                'total' => $conversations->total(),
            ],
        ]);
    }

    /**
     * Get messages for a conversation (cursor-based pagination).
     *
     * GET /conversations/{id}/messages
     */
    public function messages(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $conversation = Conversation::findOrFail($id);

        if (! $conversation->hasParticipant($user)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $query = $conversation->messages()->with('sender:id,name,avatar_url');

        // Cursor-based: messages before a specific ID
        if ($beforeId = $request->input('before_id')) {
            $beforeMsg = \App\Models\Message::find($beforeId);
            if ($beforeMsg) {
                $query->where('created_at', '<', $beforeMsg->created_at);
            }
        }

        $messages = $query->orderByDesc('created_at')
            ->limit((int) $request->input('limit', 50))
            ->get()
            ->reverse()
            ->values();

        return response()->json([
            'success' => true,
            'data' => $messages->map(fn ($m) => [
                'id' => $m->id,
                'sender_id' => $m->sender_id,
                'sender_name' => $m->sender?->name,
                'type' => $m->type,
                'content' => $m->content,
                'attachment_url' => $m->attachment_url,
                'read_at' => $m->read_at?->toISOString(),
                'created_at' => $m->created_at->toISOString(),
            ]),
            'meta' => ['has_more' => $messages->count() === (int) $request->input('limit', 50)],
        ]);
    }

    /**
     * Send a message in a conversation.
     *
     * POST /conversations/{id}/messages
     */
    public function send(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $conversation = Conversation::findOrFail($id);

        if (! $conversation->hasParticipant($user)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'type' => ['nullable', 'string', 'in:text,image,location'],
            'content' => ['nullable', 'string', 'max:2000'],
        ]);

        $message = $this->chatService->sendMessage($conversation, $user, $validated);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $message->id,
                'sender_id' => $message->sender_id,
                'type' => $message->type,
                'content' => $message->content,
                'created_at' => $message->created_at->toISOString(),
            ],
        ], 201);
    }

    /**
     * Mark all messages as read in a conversation.
     *
     * POST /conversations/{id}/read
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $conversation = Conversation::findOrFail($id);

        if (! $conversation->hasParticipant($user)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $this->chatService->markAsRead($conversation, $user);

        return response()->json(['success' => true, 'message' => 'Messages marked as read.']);
    }
}
