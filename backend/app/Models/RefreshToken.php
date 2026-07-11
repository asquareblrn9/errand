<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\RefreshToken
 *
 * Implements refresh token rotation with family-based revocation
 * for token theft detection.
 *
 * The token_family groups all refresh tokens from a single login
 * session. If a revoked refresh token is reused, the entire family
 * is revoked — this indicates token theft.
 *
 * @property string       $id
 * @property string       $access_token_id  FK to personal_access_tokens
 * @property string       $user_id
 * @property string       $token            Hashed refresh token
 * @property string       $token_family     Groups tokens from the same login
 * @property \Carbon\Carbon $expires_at
 * @property \Carbon\Carbon|null $revoked_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 *
 * @property-read User $user
 */
class RefreshToken extends Model
{
    use HasUuid;

    protected $table = 'refresh_tokens';

    protected $fillable = [
        'access_token_id',
        'user_id',
        'token',
        'token_family',
        'expires_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
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
     * Scope to unrevoked, unexpired tokens.
     */
    public function scopeValid($query)
    {
        return $query->whereNull('revoked_at')
            ->where('expires_at', '>', now());
    }

    /**
     * Scope to tokens in the same family.
     */
    public function scopeInFamily($query, string $family)
    {
        return $query->where('token_family', $family);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    public function isValid(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }

    public function revoke(): void
    {
        $this->update(['revoked_at' => now()]);
    }

    /**
     * Revoke the entire token family — used when token theft is detected.
     * A reused revoked refresh token means an attacker may have stolen
     * the token and is trying to maintain access.
     */
    public function revokeFamily(): void
    {
        static::inFamily($this->token_family)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);
    }
}
