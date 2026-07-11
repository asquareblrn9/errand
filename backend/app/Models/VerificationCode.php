<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use App\Enums\VerificationCodeType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\VerificationCode
 *
 * @property string              $id
 * @property string              $user_id
 * @property VerificationCodeType $type
 * @property string              $code        6-digit OTP
 * @property \Carbon\Carbon      $expires_at
 * @property \Carbon\Carbon|null $used_at
 * @property \Carbon\Carbon      $created_at
 * @property \Carbon\Carbon      $updated_at
 *
 * @property-read User $user
 */
class VerificationCode extends Model
{
    use HasUuid;

    protected $table = 'verification_codes';

    protected $fillable = [
        'user_id',
        'type',
        'code',
        'expires_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => VerificationCodeType::class,
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
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
     * Scope to unused, unexpired codes.
     */
    public function scopeValid($query)
    {
        return $query->whereNull('used_at')
            ->where('expires_at', '>', now());
    }

    /**
     * Scope to codes of a specific type.
     */
    public function scopeOfType($query, VerificationCodeType $type)
    {
        return $query->where('type', $type);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    public function isValid(): bool
    {
        return $this->used_at === null && $this->expires_at->isFuture();
    }

    public function markUsed(): void
    {
        $this->update(['used_at' => now()]);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
