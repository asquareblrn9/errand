<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $bid_id
 * @property string $request_id
 * @property string $errander_id
 * @property string|null $otp_hash
 * @property bool   $confirmed
 * @property \Carbon\Carbon|null $confirmed_at
 * @property \Carbon\Carbon|null $dispute_window_closes_at
 * @property int    $dispute_window_hours
 */
class Delivery extends Model
{
    use HasUuid;

    protected $table = 'deliveries';

    protected $fillable = [
        'bid_id', 'request_id', 'errander_id',
        'otp_hash', 'otp_generated_at', 'otp_expires_at',
        'otp_attempts', 'max_otp_attempts',
        'confirmed', 'confirmed_at', 'confirmed_by',
        'started_at', 'completed_at',
        'sla_minutes', 'late_fee_per_hour', 'late_fee_max',
        'grace_period_minutes', 'late_fee_accrued', 'deadline_at',
        'dispute_window_hours', 'dispute_window_closes_at',
        'proof_photo_path', 'proof_photo_url', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'confirmed' => 'boolean',
            'otp_generated_at' => 'datetime',
            'otp_expires_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'dispute_window_closes_at' => 'datetime',
            'otp_attempts' => 'integer',
            'max_otp_attempts' => 'integer',
            'dispute_window_hours' => 'integer',
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

    public function errander(): BelongsTo
    {
        return $this->belongsTo(User::class, 'errander_id');
    }

    public function updates(): HasMany
    {
        return $this->hasMany(DeliveryUpdate::class);
    }

    public function isDisputeWindowOpen(): bool
    {
        return $this->confirmed && $this->dispute_window_closes_at?->isFuture();
    }

    public function isLate(): bool
    {
        return $this->deadline_at && now() > $this->deadline_at;
    }

    public function minutesRemaining(): int
    {
        if (!$this->deadline_at) return 0;
        return max(0, (int) now()->diffInMinutes($this->deadline_at, false));
    }
}
