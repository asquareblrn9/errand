<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyUser extends Model
{
    use HasUuid;

    protected $table = 'company_users';

    protected $fillable = [
        'company_id', 'user_id', 'role', 'department',
        'spending_limit', 'requires_approval_for_above', 'status',
        'invited_at', 'joined_at',
    ];

    public function company(): BelongsTo { return $this->belongsTo(Company::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
