<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryUpdate extends Model
{
    use HasUuid;

    protected $table = 'delivery_updates';

    protected $fillable = [
        'delivery_id', 'request_id', 'user_id',
        'type', 'message', 'latitude', 'longitude',
        'photo_url', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'metadata' => 'array',
        ];
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
