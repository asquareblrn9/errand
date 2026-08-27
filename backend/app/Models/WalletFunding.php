<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\WalletFunding
 *
 * A wallet top-up initiated via Paystack/Flutterwave. Created when the
 * checkout is initialized and transitioned to a terminal status when the
 * provider confirms the transaction (webhook or client verification).
 *
 * @property string       $id
 * @property string       $user_id
 * @property string       $provider         'paystack' | 'flutterwave'
 * @property string       $provider_ref     Provider checkout reference (FUND-...)
 * @property float        $amount
 * @property string       $currency
 * @property string       $status           'pending' | 'successful' | 'failed' | 'cancelled'
 * @property \Carbon\Carbon|null $verified_at
 * @property \Carbon\Carbon|null $failed_at
 * @property string|null  $failure_reason
 *
 * @property-read User $user
 */
class WalletFunding extends Model
{
    use HasUuid;

    protected $table = 'wallet_fundings';

    protected $fillable = [
        'user_id',
        'provider',
        'provider_ref',
        'amount',
        'currency',
        'status',
        'verified_at',
        'failed_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'verified_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isSuccessful(): bool
    {
        return $this->status === 'successful';
    }
}
