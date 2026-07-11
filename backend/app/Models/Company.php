<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    use HasUuid;

    protected $table = 'companies';

    protected $fillable = [
        'name', 'slug', 'industry', 'rc_number', 'tax_id',
        'email', 'phone', 'website', 'logo_path', 'logo_url',
        'address_line_1', 'address_line_2', 'city', 'state',
        'postal_code', 'country', 'owner_id', 'status', 'settings',
    ];

    protected function casts(): array
    {
        return ['settings' => 'array'];
    }

    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function members(): HasMany { return $this->hasMany(CompanyUser::class); }
}
