<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * User account status.
 *
 * Stored as a string in the users.status column.
 * The CHECK constraint on the table enforces valid values at the DB level.
 */
enum UserStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    case Banned = 'banned';
    case Deleted = 'deleted';

    /**
     * Whether the user can authenticate.
     */
    public function canLogin(): bool
    {
        return $this === self::Active;
    }

    /**
     * Whether the account has been permanently restricted.
     */
    public function isRestricted(): bool
    {
        return in_array($this, [self::Banned, self::Deleted], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Suspended => 'Suspended',
            self::Banned => 'Banned',
            self::Deleted => 'Deleted',
        };
    }
}
