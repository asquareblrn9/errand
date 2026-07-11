<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DisputeMessage extends Model
{
    use HasUuid;

    protected $table = 'dispute_messages';

    protected $fillable = ['dispute_id', 'sender_id', 'message', 'is_admin_note'];

    protected function casts(): array
    {
        return ['is_admin_note' => 'boolean'];
    }

    public function dispute(): BelongsTo { return $this->belongsTo(Dispute::class); }
    public function sender(): BelongsTo { return $this->belongsTo(User::class, 'sender_id'); }
}
