<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

/**
 * App\Models\PersonalAccessToken
 *
 * Custom Sanctum PersonalAccessToken that uses UUID primary keys.
 * Overrides the default auto-incrementing integer ID with UUID v4.
 */
class PersonalAccessToken extends SanctumPersonalAccessToken
{
    /**
     * Indicates if the IDs are auto-incrementing.
     */
    public $incrementing = false;

    /**
     * The "type" of the primary key ID.
     */
    protected $keyType = 'string';

    /**
     * Boot the model — generate UUID on creation.
     */
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Model $model): void {
            if (empty($model->getKey())) {
                $model->setAttribute($model->getKeyName(), (string) Str::orderedUuid());
            }
        });
    }
}
