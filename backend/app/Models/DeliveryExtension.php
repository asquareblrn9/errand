<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryExtension extends Model
{
    use HasUuid;

    protected $table = 'delivery_extensions';

    protected $fillable = [
        'delivery_id', 'request_id', 'requested_by',
        'additional_minutes', 'reason',
        'status', 'decided_by', 'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'additional_minutes' => 'integer',
            'decided_at' => 'datetime',
        ];
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
