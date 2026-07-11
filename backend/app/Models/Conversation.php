<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    use HasUuid;

    protected $table = 'conversations';

    protected $fillable = [
        'request_id', 'requester_id', 'errander_id',
        'last_message_at', 'last_message_preview',
        'requester_unread_count', 'errander_unread_count', 'status',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(Request::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function errander(): BelongsTo
    {
        return $this->belongsTo(User::class, 'errander_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at');
    }

    public function hasParticipant(User $user): bool
    {
        return in_array($user->id, [$this->requester_id, $this->errander_id], true);
    }
}
