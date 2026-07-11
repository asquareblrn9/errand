<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $bid_id
 * @property string $request_id
 * @property string $user_id
 * @property string $provider     'flutterwave' | 'paystack' | 'wallet'
 * @property string|null $provider_ref
 * @property float  $amount
 * @property array  $breakdown
 * @property string $currency
 * @property string $status      'pending' | 'successful' | 'failed' | 'refunded'
 * @property string|null $payment_method
 */
class Payment extends Model
{
    use HasUuid;

    protected $table = 'payments';

    protected $fillable = [
        'bid_id', 'request_id', 'user_id', 'provider', 'provider_ref',
        'amount', 'breakdown', 'currency', 'status', 'payment_method',
        'paid_at', 'failed_at', 'failure_reason', 'metadata', 'retry_count',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'breakdown' => 'array',
            'metadata' => 'array',
            'paid_at' => 'datetime',
            'failed_at' => 'datetime',
            'retry_count' => 'integer',
        ];
    }

    public function bid(): BelongsTo
    {
        return $this->belongsTo(Bid::class);
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
