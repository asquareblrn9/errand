<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\AuditLog
 *
 * Immutable audit trail record.
 * Rows are never updated or deleted from application code.
 *
 * @property string       $id
 * @property string|null  $user_id       Nullable — set null if user deleted
 * @property string       $action        e.g. 'user.registered', 'user.login', 'admin.user_suspended'
 * @property string       $model_type    Fully qualified model class name
 * @property string|null  $model_id      UUID of the affected model
 * @property array|null   $old_values    JSONB — state before the change
 * @property array|null   $new_values    JSONB — state after the change
 * @property string|null  $ip_address    Client IP
 * @property string|null  $user_agent    Client User-Agent header
 * @property array        $metadata      JSONB — arbitrary additional context
 * @property \Carbon\Carbon $created_at
 *
 * @property-read User|null $user
 */
class AuditLog extends Model
{
    use HasUuid;

    /**
     * Indicates if the model should be timestamped.
     * We only use created_at — no updated_at for immutable records.
     */
    public const UPDATED_AT = null;

    protected $table = 'audit_logs';

    protected $fillable = [
        'user_id',
        'action',
        'model_type',
        'model_id',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'metadata' => 'array',
            'created_at' => 'datetime',
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
    | Static Factory
    |--------------------------------------------------------------------------
    */

    /**
     * Log a model event to the audit trail.
     */
    public static function log(
        string $action,
        ?User $actor,
        Model $model,
        ?array $oldValues = null,
        ?array $newValues = null,
        array $metadata = [],
    ): self {
        return static::create([
            'user_id' => $actor?->id,
            'action' => $action,
            'model_type' => get_class($model),
            'model_id' => $model->getKey(),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'metadata' => $metadata,
        ]);
    }
}
