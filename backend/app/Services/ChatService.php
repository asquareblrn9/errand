<?php

declare(strict_types=1);

namespace App\Services;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;

class ChatService
{
    /**
     * Get or create a conversation for a request.
     */
    public function getOrCreateConversation(string $requestId, User $requester, User $errander): Conversation
    {
        return Conversation::firstOrCreate(
            ['request_id' => $requestId],
            [
                'requester_id' => $requester->id,
                'errander_id' => $errander->id,
                'status' => 'active',
            ]
        );
    }

    /**
     * Send a message in a conversation.
     */
    public function sendMessage(Conversation $conversation, User $sender, array $data): Message
    {
        $type = $data['type'] ?? 'text';

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $sender->id,
            'type' => $type,
            'content' => $data['content'] ?? null,
            'attachment_url' => $data['attachment_url'] ?? null,
        ]);

        // Update conversation metadata
        $preview = mb_substr($data['content'] ?? ($type === 'image' ? '📷 Image' : '📍 Location'), 0, 150);
        $conversation->update([
            'last_message_at' => now(),
            'last_message_preview' => $preview,
        ]);

        // Increment unread count for the other party
        if ($sender->id === $conversation->requester_id) {
            $conversation->increment('errander_unread_count');
        } else {
            $conversation->increment('requester_unread_count');
        }

        event(new MessageSent($message));

        return $message->load('sender');
    }

    /**
     * Mark all messages in a conversation as read for a user.
     */
    public function markAsRead(Conversation $conversation, User $user): void
    {
        Message::where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        // Reset unread count for this user
        if ($user->id === $conversation->requester_id) {
            $conversation->update(['requester_unread_count' => 0]);
        } else {
            $conversation->update(['errander_unread_count' => 0]);
        }
    }
}
