<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EscrowTransaction extends Model
{
    use HasUuid;

    protected $table = 'escrow_transactions';

    protected $fillable = [
        'bid_id',
        'request_id',
        'requester_id',
        'errander_id',
        'amount',
        'breakdown',
        'status',
        'held_at',
        'released_at',
        'release_trigger',
    ];

    protected function casts(): array
    {
        return [
            'breakdown' => 'array',
            'amount' => 'decimal:2',
            'held_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function bid(): BelongsTo
    {
        return $this->belongsTo(Bid::class);
    }

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
}
