<?php

declare(strict_types=1);

namespace App\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Trait HasUuid
 *
 * Provides UUID v4 primary key generation for Eloquent models.
 * Replaces auto-incrementing integer IDs with ordered UUIDs.
 *
 * Ordered UUIDs (UUID v4 with timestamp prefix) are used because:
 * - They are globally unique — safe for distributed systems.
 * - They are non-sequential — no ID enumeration attacks.
 * - Ordered UUIDs are index-friendly in PostgreSQL (less B-tree fragmentation).
 *
 * @mixin Model
 */
trait HasUuid
{
    /**
     * Boot the trait.
     */
    protected static function bootHasUuid(): void
    {
        static::creating(function (Model $model): void {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::orderedUuid();
            }
        });
    }

    /**
     * Disable auto-incrementing — UUIDs are string keys.
     */
    public function getIncrementing(): bool
    {
        return false;
    }

    /**
     * Tell Eloquent the primary key is a string, not an integer.
     */
    public function getKeyType(): string
    {
        return 'string';
    }
}
