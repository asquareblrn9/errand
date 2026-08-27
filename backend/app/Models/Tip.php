<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\Tip
 *
 * A wallet-funded tip from a requester to an errander after an errand.
 * One tip per bid — enforced by the unique bid_id column and TipService.
 *
 * @property string  $id
 * @property string  $bid_id
 * @property string  $request_id
 * @property string  $requester_id
 * @property string  $errander_id
 * @property float   $amount
 * @property string  $reference      Tip wallet-transfer reference (TIP-...)
 *
 * @property-read Bid $bid
 * @property-read Request $request
 * @property-read User $requester
 * @property-read User $errander
 */
class Tip extends Model
{
    use HasUuid;

    protected $table = 'tips';

    protected $fillable = [
        'bid_id',
        'request_id',
        'requester_id',
        'errander_id',
        'amount',
        'reference',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
        ];
    }

    public function bid(): BelongsTo
    {
        return $this->belongsTo(Bid::class);
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(Request::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function errander(): BelongsTo
    {
        return $this->belongsTo(User::class, 'errander_id');
    }
}
