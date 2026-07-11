<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    use HasUuid;

    protected $table = 'plans';

    protected $fillable = [
        'name', 'slug', 'description', 'monthly_price', 'annual_price',
        'features', 'limits', 'status', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'features' => 'array', 'limits' => 'array',
            'monthly_price' => 'float', 'annual_price' => 'float',
        ];
    }

    public function scopeActive($query) { return $query->where('status', 'active'); }
    public function scopeOrdered($query) { return $query->orderBy('sort_order'); }
}
