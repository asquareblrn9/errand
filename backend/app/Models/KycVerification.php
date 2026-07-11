<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class KycVerification extends Model
{
    use HasUuid;

    protected $fillable = [
        'user_id',
        'type',
        'status',
        'rejection_reason',
        'rejection_category',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
        'attempt',
    ];

    protected $attributes = [
        'attempt' => 1,
        'status' => 'draft',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'attempt' => 'integer',
    ];

    // ── Relationships ───────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(KycDocument::class);
    }

    public function emergencyContact(): HasOne
    {
        return $this->hasOne(EmergencyContact::class);
    }

    public function bankAccount(): HasOne
    {
        return $this->hasOne(BankAccount::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    // ── Helpers ──────────────────────────────────────────────

    public function isPending(): bool
    {
        return in_array($this->status, ['pending_review', 'under_review']);
    }

    public function submit(): void
    {
        $this->update([
            'status' => 'pending_review',
            'attempt' => $this->attempt,
        ]);
    }

    public function approve(User $reviewer, ?string $notes = null): void
    {
        $this->update([
            'status' => 'approved',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ]);
    }

    public function reject(User $reviewer, string $reason, string $category, ?string $notes = null): void
    {
        $this->update([
            'status' => 'rejected',
            'rejection_reason' => $reason,
            'rejection_category' => $category,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ]);
    }

    public function requestResubmission(User $reviewer, string $reason, string $category, ?string $notes = null): void
    {
        $this->update([
            'status' => 'requires_resubmission',
            'rejection_reason' => $reason,
            'rejection_category' => $category,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_notes' => $notes,
            'attempt' => $this->attempt + 1,
        ]);
    }
}
