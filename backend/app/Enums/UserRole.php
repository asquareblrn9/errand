<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * User roles within the Errand Boy platform.
 *
 * These map directly to Spatie Permission roles.
 * The string values are stored in the roles table 'name' column.
 */
enum UserRole: string
{
    case Requester = 'requester';
    case Errander = 'errander';
    case CompanyAdmin = 'company_admin';
    case CompanyMember = 'company_member';
    case Admin = 'admin';
    case SuperAdmin = 'super_admin';

    /**
     * Get a human-readable label for the role.
     */
    public function label(): string
    {
        return match ($this) {
            self::Requester => 'Requester',
            self::Errander => 'Errander',
            self::CompanyAdmin => 'Company Admin',
            self::CompanyMember => 'Company Member',
            self::Admin => 'Admin',
            self::SuperAdmin => 'Super Admin',
        };
    }

    /**
     * Roles that are considered platform staff.
     */
    public function isStaff(): bool
    {
        return in_array($this, [self::Admin, self::SuperAdmin], true);
    }

    /**
     * Roles that can post requests.
     */
    public function canCreateRequests(): bool
    {
        return in_array($this, [
            self::Requester,
            self::CompanyAdmin,
            self::CompanyMember,
        ], true);
    }

    /**
     * Roles that can fulfil requests (submit bids).
     */
    public function canBidOnRequests(): bool
    {
        return $this === self::Errander;
    }
}
