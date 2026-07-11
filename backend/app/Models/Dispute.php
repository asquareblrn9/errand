<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dispute extends Model
{
    use HasUuid;

    protected $table = 'disputes';

    protected $fillable = [
        'delivery_id', 'bid_id', 'request_id', 'raised_by',
        'errander_id', 'reason', 'description', 'status',
        'errander_response', 'resolution_note', 'resolved_by',
        'resolved_at', 'is_appeal', 'parent_dispute_id',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
            'is_appeal' => 'boolean',
        ];
    }

    public function delivery(): BelongsTo { return $this->belongsTo(Delivery::class); }
    public function bid(): BelongsTo { return $this->belongsTo(Bid::class); }
    public function request(): BelongsTo { return $this->belongsTo(Request::class); }
    public function raiser(): BelongsTo { return $this->belongsTo(User::class, 'raised_by'); }
    public function errander(): BelongsTo { return $this->belongsTo(User::class, 'errander_id'); }
    public function resolver(): BelongsTo { return $this->belongsTo(User::class, 'resolved_by'); }
    public function evidence(): HasMany { return $this->hasMany(DisputeEvidence::class); }
    public function messages(): HasMany { return $this->hasMany(DisputeMessage::class); }

    public function isOpen(): bool
    {
        return in_array($this->status, ['open', 'errander_response_pending', 'under_review'], true);
    }
}
