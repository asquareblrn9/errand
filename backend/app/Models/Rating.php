<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Rating extends Model
{
    use HasUuid;

    protected $table = 'ratings';

    protected $fillable = [
        'request_id', 'bid_id', 'reviewer_id', 'reviewee_id',
        'rating', 'review', 'aspects', 'is_visible', 'response',
        'responded_at', 'submitted_at', 'visible_at',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'is_visible' => 'boolean',
            'aspects' => 'array',
            'submitted_at' => 'datetime',
            'visible_at' => 'datetime',
            'responded_at' => 'datetime',
        ];
    }

    public function reviewer(): BelongsTo { return $this->belongsTo(User::class, 'reviewer_id'); }
    public function reviewee(): BelongsTo { return $this->belongsTo(User::class, 'reviewee_id'); }
    public function request(): BelongsTo { return $this->belongsTo(Request::class); }
    public function bid(): BelongsTo { return $this->belongsTo(Bid::class); }

    public function scopeVisible($query) { return $query->where('is_visible', true); }
}
