<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Withdrawal extends Model
{
    use HasUuid;

    protected $table = 'withdrawals';

    protected $fillable = [
        'user_id', 'wallet_transaction_id', 'amount', 'fee', 'net_amount',
        'bank_code', 'account_number', 'account_name', 'narration',
        'status', 'provider', 'provider_ref', 'completed_at',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
