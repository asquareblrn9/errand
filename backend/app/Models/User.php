<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * App\Models\User
 *
 * @property string       $id              UUID primary key
 * @property string       $name            Full name
 * @property string       $email           Unique email address
 * @property string|null  $phone           Unique phone number (E.164 format)
 * @property string|null  $email_verified_at
 * @property string|null  $phone_verified_at
 * @property string       $password        Bcrypt hash
 * @property UserRole     $role            Primary role (convenience; Spatie is source of truth)
 * @property UserStatus   $status          Account status
 * @property int          $kyc_tier        KYC verification level (0-3)
 * @property string|null  $avatar_path     S3 object key
 * @property string|null  $avatar_url      Public CDN URL
 * @property string|null  $fcm_token       Legacy single-device FCM token (use deviceTokens relation)
 * @property string|null  $device_type     Legacy device type
 * @property string|null  $device_name     Legacy device name
 * @property bool         $is_online       Errander online presence
 * @property \Carbon\Carbon|null $last_location_update
 * @property bool         $two_factor_enabled
 * @property string|null  $two_factor_secret
 * @property int          $completed_orders  Denormalized count for fast display
 * @property string|null  $banned_at
 * @property string|null  $ban_reason
 * @property string|null  $deleted_at        Soft delete
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 *
 * @property-read \Illuminate\Database\Eloquent\Collection<VerificationCode> $verificationCodes
 * @property-read \Illuminate\Database\Eloquent\Collection<DeviceToken>      $deviceTokens
 * @property-read \Illuminate\Database\Eloquent\Collection<RefreshToken>     $refreshTokens
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens;
    use HasFactory;
    use HasRoles;
    use HasUuid;
    use Notifiable;
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected $table = 'users';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'middle_name',
        'email',
        'phone',
        'password',
        'google_id',
        'role',
        'status',
        'kyc_tier',
        'kyc_status',
        'kyc_submitted_at',
        'kyc_approved_at',
        'kyc_reviewed_by',
        'notifications_read_at',
        'date_of_birth',
        'gender',
        'email_verified_at',
        'phone_verified_at',
        'avatar_path',
        'avatar_url',
        'residential_address',
        'state',
        'lga',
        'fcm_token',
        'device_type',
        'device_name',
        'is_online',
        'last_location_update',
        'two_factor_enabled',
        'two_factor_secret',
        'completed_orders',
        'banned_at',
        'ban_reason',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'fcm_token',
    ];

    /**
     * The attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => UserStatus::class,
            'two_factor_enabled' => 'boolean',
            'is_online' => 'boolean',
            'last_location_update' => 'datetime',
            'kyc_tier' => 'integer',
            'completed_orders' => 'integer',
            'banned_at' => 'datetime',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    */

    /**
     * Scope to only active (non-banned, non-deleted) users.
     */
    public function scopeActive($query)
    {
        return $query->where('status', UserStatus::Active);
    }

    /**
     * Scope to users who can log in.
     */
    public function scopeCanLogin($query)
    {
        return $query->where('status', UserStatus::Active);
    }

    /**
     * Scope to users with a specific role.
     */
    public function scopeWithRole($query, UserRole $role)
    {
        return $query->where('role', $role);
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * Verification codes sent to this user.
     */
    public function verificationCodes(): HasMany
    {
        return $this->hasMany(VerificationCode::class);
    }

    /**
     * Push notification device tokens — supports multiple devices.
     */
    public function deviceTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    /**
     * Refresh tokens issued to this user.
     */
    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class);
    }

    /**
     * User's saved addresses.
     */
    public function addresses(): HasMany
    {
        return $this->hasMany(UserAddress::class);
    }

    /**
     * User's default address.
     */
    public function defaultAddress()
    {
        return $this->hasOne(UserAddress::class)->where('is_default', true);
    }

    /**
     * User's wallet.
     */
    public function wallet()
    {
        return $this->hasOne(Wallet::class);
    }

    /**
     * Company memberships.
     */
    public function companyUsers()
    {
        return $this->hasMany(CompanyUser::class);
    }

    /**
     * KYC verifications.
     */
    public function kycVerifications()
    {
        return $this->hasMany(KycVerification::class);
    }

    /**
     * Bank accounts.
     */
    public function bankAccounts()
    {
        return $this->hasMany(BankAccount::class);
    }

    /**
     * Emergency contacts.
     */
    public function emergencyContacts()
    {
        return $this->hasMany(EmergencyContact::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Accessors & Mutators
    |--------------------------------------------------------------------------
    */

    /**
     * Get a display-friendly avatar URL, falling back to Gravatar.
     */
    protected function avatarUrl(): Attribute
    {
        return Attribute::get(function (?string $value): string {
            if ($value) {
                return $value;
            }

            if (empty($this->email)) {
                return 'https://www.gravatar.com/avatar/default?d=mp&s=200';
            }

            $hash = md5(strtolower(trim($this->email)));

            return "https://www.gravatar.com/avatar/{$hash}?d=mp&s=200";
        });
    }

    /**
     * How long the user has been a member (human-readable).
     */
    public function getMemberSinceAttribute(): string
    {
        return $this->created_at?->format('Y-m-d') ?? 'N/A';
    }

    /*
    |--------------------------------------------------------------------------
    | Helper Methods
    |--------------------------------------------------------------------------
    */

    /**
     * Whether the user can perform actions on the platform.
     */
    public function canLogin(): bool
    {
        return $this->status === UserStatus::Active;
    }

    /**
     * Whether the user is an errander.
     */
    public function isErrander(): bool
    {
        return $this->role === UserRole::Errander;
    }

    /**
     * Whether the user is a requester or company user.
     */
    public function isRequester(): bool
    {
        return in_array($this->role, [
            UserRole::Requester,
            UserRole::CompanyAdmin,
            UserRole::CompanyMember,
        ], true);
    }

    /**
     * Whether the user is a platform administrator.
     */
    public function isAdmin(): bool
    {
        return $this->role->isStaff();
    }

    /**
     * Whether the user is eligible to post errand requests.
     * Requires email verification, completed KYC, and an active account.
     */
    public function canPostRequest(): bool
    {
        return $this->email_verified_at !== null
            && $this->kyc_tier >= 1
            && $this->status === UserStatus::Active;
    }

    /**
     * Mark the user as online for the matching engine.
     */
    public function markOnline(): void
    {
        $this->update([
            'is_online' => true,
            'last_location_update' => now(),
        ]);
    }

    /**
     * Mark the user as offline.
     */
    public function markOffline(): void
    {
        $this->update(['is_online' => false]);
    }
}
