<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErranderStats extends Model
{
    use HasUuid;

    protected $table = 'errander_stats';

    protected $fillable = [
        'user_id', 'total_bids_submitted', 'total_bids_accepted',
        'completed_orders', 'cancelled_orders', 'on_time_deliveries',
        'late_deliveries', 'disputes_received', 'disputes_lost',
        'completion_rate', 'average_rating', 'on_time_percentage',
        'trust_score', 'total_value_handled', 'average_response_time_seconds',
        'last_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'completion_rate' => 'float', 'average_rating' => 'float',
            'on_time_percentage' => 'float', 'trust_score' => 'float',
            'total_value_handled' => 'float', 'last_completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
