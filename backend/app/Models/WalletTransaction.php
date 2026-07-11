<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalletTransaction extends Model
{
    use HasUuid;

    public const UPDATED_AT = null;

    protected $table = 'wallet_transactions';

    protected $fillable = [
        'wallet_id', 'user_id', 'type', 'amount',
        'balance_before', 'balance_after', 'reference',
        'description', 'metadata', 'status', 'related_transaction_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'balance_before' => 'float',
            'balance_after' => 'float',
            'metadata' => 'array',
        ];
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }
}
