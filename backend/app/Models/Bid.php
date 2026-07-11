<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use App\Enums\BidStatus;
use Database\Factories\BidFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string    $id
 * @property string    $request_id
 * @property string    $errander_id
 * @property float     $goods_amount
 * @property float     $service_fee
 * @property float     $platform_fee
 * @property float     $total_amount
 * @property string|null $note
 * @property \Carbon\Carbon|null $delivery_at
 * @property BidStatus $status
 *
 * @property-read Request $request
 * @property-read User    $errander
 */
class Bid extends Model
{
    /** @use HasFactory<BidFactory> */
    use HasFactory;
    use HasUuid;

    protected $table = 'bids';

    protected $fillable = [
        'request_id', 'errander_id',
        'goods_amount', 'service_fee', 'platform_fee', 'total_amount',
        'note', 'delivery_at', 'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => BidStatus::class,
            'goods_amount' => 'float',
            'service_fee' => 'float',
            'platform_fee' => 'float',
            'total_amount' => 'float',
            'delivery_at' => 'datetime',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(Request::class);
    }

    public function errander(): BelongsTo
    {
        return $this->belongsTo(User::class, 'errander_id');
    }

    public function scopePending($query)
    {
        return $query->where('status', BidStatus::Pending);
    }
}
