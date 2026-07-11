<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\UserAddress
 *
 * @property string       $id
 * @property string       $user_id
 * @property string       $label           'home', 'work', 'other'
 * @property string       $address_line_1
 * @property string|null  $address_line_2
 * @property string       $city
 * @property string       $state
 * @property string|null  $postal_code
 * @property string       $country
 * @property float|null   $latitude
 * @property float|null   $longitude
 * @property bool         $is_default
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 *
 * @property-read User $user
 */
class UserAddress extends Model
{
    use HasUuid;

    protected $table = 'user_addresses';

    protected $fillable = [
        'user_id',
        'label',
        'address_line_1',
        'address_line_2',
        'city',
        'state',
        'postal_code',
        'country',
        'latitude',
        'longitude',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    */

    public function scopeForUser($query, User $user)
    {
        return $query->where('user_id', $user->id);
    }

    /*
    |--------------------------------------------------------------------------
    | Boot
    |--------------------------------------------------------------------------
    */

    protected static function boot(): void
    {
        parent::boot();

        // When setting a new default, clear other defaults for the user
        static::saving(function (UserAddress $address): void {
            if ($address->is_default) {
                static::where('user_id', $address->user_id)
                    ->where('id', '!=', $address->id)
                    ->update(['is_default' => false]);
            }
        });
    }
}
