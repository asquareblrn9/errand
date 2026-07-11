<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    /**
     * Create the default super admin and admin users.
     */
    public function run(): void
    {
        // ── Super Admin ────────────────────────────────────────
        $superAdmin = User::firstOrCreate(
            ['email' => 'superadmin@errandboy.ng'],
            [
                'name' => 'Super Admin',
                'phone' => '+2348000000001',
                'password' => bcrypt('SuperAdmin1!'),
                'role' => UserRole::SuperAdmin,
                'status' => UserStatus::Active,
                'kyc_tier' => 3,
                'email_verified_at' => now(),
                'phone_verified_at' => now(),
            ]
        );
        $superAdmin->assignRole('super_admin');

        // ── Admin ──────────────────────────────────────────────
        $admin = User::firstOrCreate(
            ['email' => 'admin@errandboy.ng'],
            [
                'name' => 'Platform Admin',
                'phone' => '+2348000000002',
                'password' => bcrypt('AdminPass1!'),
                'role' => UserRole::Admin,
                'status' => UserStatus::Active,
                'kyc_tier' => 3,
                'email_verified_at' => now(),
                'phone_verified_at' => now(),
            ]
        );
        $admin->assignRole('admin');

        // ── Test Requester ─────────────────────────────────────
        $requester = User::firstOrCreate(
            ['email' => 'requester@errandboy.ng'],
            [
                'name' => 'Adeola Requester',
                'phone' => '+2348000000003',
                'password' => bcrypt('Password1!'),
                'role' => UserRole::Requester,
                'status' => UserStatus::Active,
                'kyc_tier' => 1,
                'email_verified_at' => now(),
                'phone_verified_at' => now(),
            ]
        );
        $requester->assignRole('requester');

        // ── Test Errander ──────────────────────────────────────
        $errander = User::firstOrCreate(
            ['email' => 'errander@errandboy.ng'],
            [
                'name' => 'John Errander',
                'phone' => '+2348000000004',
                'password' => bcrypt('Password1!'),
                'role' => UserRole::Errander,
                'status' => UserStatus::Active,
                'kyc_tier' => 1,
                'email_verified_at' => now(),
                'phone_verified_at' => now(),
            ]
        );
        $errander->assignRole('errander');

        $this->command?->info('Admin and test users seeded successfully.');
        $this->command?->table(
            ['Email', 'Role', 'Password'],
            [
                ['superadmin@errandboy.ng', 'super_admin', 'SuperAdmin1!'],
                ['admin@errandboy.ng', 'admin', 'AdminPass1!'],
                ['requester@errandboy.ng', 'requester', 'Password1!'],
                ['errander@errandboy.ng', 'errander', 'Password1!'],
            ]
        );
    }
}
