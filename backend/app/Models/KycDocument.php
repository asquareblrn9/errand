<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KycDocument extends Model
{
    use HasUuid;

    protected $fillable = [
        'kyc_verification_id',
        'document_type',
        'document_number',
        'front_image_path',
        'front_image_url',
        'back_image_path',
        'back_image_url',
        'file_type',
        'file_size',
        'original_filename',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    public function verification(): BelongsTo
    {
        return $this->belongsTo(KycVerification::class, 'kyc_verification_id');
    }

    public function hasBackImage(): bool
    {
        return $this->back_image_path !== null;
    }
}
