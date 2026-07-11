<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Models\Category
 *
 * @property string $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property string|null $icon
 * @property int    $dispute_window_hours
 * @property int    $sla_target_minutes
 * @property int    $sort_order
 * @property bool   $is_active
 *
 * @property-read \Illuminate\Database\Eloquent\Collection<Request> $requests
 */
class Category extends Model
{
    /** @use HasFactory<CategoryFactory> */
    use HasFactory;
    use HasUuid;
    use SoftDeletes;

    protected $table = 'categories';

    protected $fillable = [
        'name', 'slug', 'description', 'icon',
        'dispute_window_hours', 'sla_target_minutes',
        'sort_order', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'dispute_window_hours' => 'integer',
            'sla_target_minutes' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function requests(): HasMany
    {
        return $this->hasMany(Request::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    */

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }
}
