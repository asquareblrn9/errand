<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankAccount extends Model
{
    use HasUuid;

    protected $fillable = [
        'user_id',
        'kyc_verification_id',
        'bank_name',
        'bank_code',
        'account_number',
        'account_name',
        'is_verified',
        'paystack_recipient_code',
        'is_primary',
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'is_primary' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function verification(): BelongsTo
    {
        return $this->belongsTo(KycVerification::class, 'kyc_verification_id');
    }

    public function maskedAccountNumber(): string
    {
        return str_repeat('*', max(0, strlen($this->account_number) - 4))
            . substr($this->account_number, -4);
    }
}
