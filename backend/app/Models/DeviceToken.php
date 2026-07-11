<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\DeviceToken
 *
 * @property string       $id
 * @property string       $user_id
 * @property string       $token       FCM registration token
 * @property string|null  $device_type  'android', 'ios', 'web'
 * @property string|null  $device_name  Human-readable device label
 * @property \Carbon\Carbon|null $last_used_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 *
 * @property-read User $user
 */
class DeviceToken extends Model
{
    use HasUuid;

    protected $table = 'device_tokens';

    protected $fillable = [
        'user_id',
        'token',
        'device_type',
        'device_name',
        'last_used_at',
    ];

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    */

    /**
     * Scope to tokens that have been used recently (active devices).
     */
    public function scopeActive($query, int $days = 30)
    {
        return $query->where('last_used_at', '>=', now()->subDays($days));
    }
}
