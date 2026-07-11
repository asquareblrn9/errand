<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmergencyContact extends Model
{
    use HasUuid;

    protected $fillable = [
        'user_id',
        'kyc_verification_id',
        'full_name',
        'phone_number',
        'relationship',
        'other_relationship',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function verification(): BelongsTo
    {
        return $this->belongsTo(KycVerification::class, 'kyc_verification_id');
    }
}
