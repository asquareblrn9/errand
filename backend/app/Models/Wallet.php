<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $user_id
 * @property float  $balance        Total balance including locked
 * @property float  $locked_balance Funds held in escrow
 * @property string $currency
 * @property string $status
 *
 * @property-read float $available_balance  balance - locked_balance
 * @property-read \Illuminate\Database\Eloquent\Collection<WalletTransaction> $transactions
 */
class Wallet extends Model
{
    use HasUuid;

    protected $table = 'wallets';

    protected $fillable = ['user_id', 'balance', 'locked_balance', 'currency', 'status'];

    protected function casts(): array
    {
        return [
            'balance' => 'float',
            'locked_balance' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class)->orderByDesc('created_at');
    }

    /** Available balance = total - locked (escrow) */
    public function getAvailableBalanceAttribute(): float
    {
        return $this->balance - $this->locked_balance;
    }
}
