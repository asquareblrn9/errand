<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use App\Enums\RequestStatus;
use Database\Factories\RequestFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * App\Models\Request
 *
 * Core marketplace entity. A requester posts a request;
 * erranders bid on it.
 *
 * @property string        $id
 * @property string        $user_id
 * @property string        $category_id
 * @property string|null   $company_id
 * @property string        $title
 * @property string        $description
 * @property string        $location
 * @property float|null    $latitude
 * @property float|null    $longitude
 * @property float|null    $budget_hint
 * @property RequestStatus $status
 * @property bool          $is_urgent
 * @property float         $urgent_fee
 * @property string|null   $accepted_bid_id
 * @property \Carbon\Carbon|null $delivery_confirmed_at
 * @property \Carbon\Carbon|null $completed_at
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null   $cancellation_reason
 * @property array         $metadata
 *
 * @property-read User            $requester
 * @property-read Category        $category
 * @property-read \Illuminate\Database\Eloquent\Collection<RequestPhoto> $photos
 * @property-read \Illuminate\Database\Eloquent\Collection<Bid>          $bids
 * @property-read Bid|null        $acceptedBid
 */
class Request extends Model
{
    /** @use HasFactory<RequestFactory> */
    use HasFactory;
    use HasUuid;

    protected $table = 'requests';

    protected $fillable = [
        'user_id',
        'category_id',
        'company_id',
        'title',
        'description',
        'location',
        'latitude',
        'longitude',
        'budget_hint',
        'status',
        'is_urgent',
        'urgent_fee',
        'accepted_bid_id',
        'delivery_confirmed_at',
        'completed_at',
        'cancelled_at',
        'cancellation_reason',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'status' => RequestStatus::class,
            'is_urgent' => 'boolean',
            'budget_hint' => 'float',
            'urgent_fee' => 'float',
            'latitude' => 'float',
            'longitude' => 'float',
            'delivery_confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(RequestPhoto::class)->orderBy('sort_order');
    }

    public function bids(): HasMany
    {
        return $this->hasMany(Bid::class, 'request_id');
    }

    public function acceptedBid(): HasOne
    {
        return $this->hasOne(Bid::class, 'id', 'accepted_bid_id');
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    */

    public function scopeOpen($query)
    {
        return $query->where('status', RequestStatus::Open);
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', [
            RequestStatus::Open,
            RequestStatus::Assigned,
            RequestStatus::InProgress,
        ]);
    }

    public function scopeByCategory($query, string $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    public function scopeUrgent($query)
    {
        return $query->where('is_urgent', true);
    }

    public function scopeNearby($query, float $lat, float $lng, int $radiusKm = 10)
    {
        // Haversine formula for nearby requests
        return $query->selectRaw("
            *,
            ( 6371 * acos( cos( radians(?) ) * cos( radians( latitude ) )
            * cos( radians( longitude ) - radians(?) )
            + sin( radians(?) ) * sin( radians( latitude ) ) ) ) AS distance
        ", [$lat, $lng, $lat])
            ->having('distance', '<=', $radiusKm)
            ->orderBy('distance');
    }

    /*
    |--------------------------------------------------------------------------
    | State Transitions
    |--------------------------------------------------------------------------
    */

    public function transitionTo(RequestStatus $newStatus): void
    {
        if (! in_array($newStatus, $this->status->allowedTransitions(), true)) {
            throw new \InvalidArgumentException(
                "Cannot transition request from {$this->status->value} to {$newStatus->value}"
            );
        }

        $this->update(['status' => $newStatus]);
    }

    public function publish(): void
    {
        $this->transitionTo(RequestStatus::Open);
    }

    public function markCancelled(?string $reason = null): void
    {
        $this->update([
            'status' => RequestStatus::Cancelled,
            'cancelled_at' => now(),
            'cancellation_reason' => $reason,
        ]);
    }

    public function markCompleted(): void
    {
        $this->update([
            'status' => RequestStatus::Completed,
            'completed_at' => now(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    public function isOwnedBy(User $user): bool
    {
        return $this->user_id === $user->id;
    }

    public function hasAcceptedBid(): bool
    {
        return $this->accepted_bid_id !== null;
    }

    public function bidsCount(): int
    {
        return $this->bids()->count();
    }
}
