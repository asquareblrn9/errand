<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    use HasUuid;

    protected $table = 'subscriptions';

    protected $fillable = [
        'user_id', 'plan_id', 'status', 'billing_cycle',
        'started_at', 'expires_at', 'cancelled_at', 'auto_renew',
        'payment_provider', 'provider_subscription_id',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime', 'expires_at' => 'datetime',
            'cancelled_at' => 'datetime', 'auto_renew' => 'boolean',
        ];
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function plan(): BelongsTo { return $this->belongsTo(Plan::class); }

    public function scopeActive($query)
    {
        return $query->where('status', 'active')->where('expires_at', '>', now());
    }

    public function isActive(): bool
    {
        return $this->status === 'active' && $this->expires_at->isFuture();
    }
}
