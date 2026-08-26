<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Create an admin or super_admin account.
 *
 * Interactive by default — run it directly:
 *
 *   php artisan db:seed --class=CreateAdminSeeder
 *
 * You'll be prompted for the role, name, email, phone and password
 * (leave the password blank to auto-generate one). The credentials are
 * printed at the end. When run non-interactively (e.g. from a script),
 * it falls back to the defaults below.
 */
class CreateAdminSeeder extends Seeder
{
    /**
     * Defaults used when running non-interactively.
     */
    private const DEFAULT_ROLE = UserRole::Admin;
    private const DEFAULT_NAME = 'Platform Admin';
    private const DEFAULT_EMAIL = 'admin@errandboy.ng';
    private const DEFAULT_PHONE = '+2348000000000';

    public function run(): void
    {
        if ($this->command) {
            $defaultRoleIndex = self::DEFAULT_ROLE === UserRole::Admin ? 0 : 1;
            $role = UserRole::from(
                $this->command->choice('Role', ['admin', 'super_admin'], $defaultRoleIndex)
            );
            $name = $this->command->ask('Full name', self::DEFAULT_NAME);
            $email = $this->command->ask('Email', self::DEFAULT_EMAIL);
            $phone = $this->command->ask('Phone (E.164 format)', self::DEFAULT_PHONE);
            $password = $this->command->secret('Password (leave blank to generate)');
            $password = ($password !== null && $password !== '') ? $password : Str::password(16);
        } else {
            $role = self::DEFAULT_ROLE;
            $name = self::DEFAULT_NAME;
            $email = self::DEFAULT_EMAIL;
            $phone = self::DEFAULT_PHONE;
            $password = Str::password(16);
        }

        // Roles must exist before assignment (first run on a fresh database)
        $this->call(RoleAndPermissionSeeder::class);

        if (User::where('email', $email)->exists()) {
            $this->command?->error("A user with the email {$email} already exists — nothing was created.");

            return;
        }

        if (User::where('phone', $phone)->exists()) {
            $this->command?->error("A user with the phone {$phone} already exists — nothing was created.");

            return;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'password' => $password, // 'hashed' cast handles hashing
            'role' => $role,
            'status' => UserStatus::Active,
            'kyc_tier' => 3,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);

        // Spatie role is the source of truth for authorization
        $user->assignRole($role->value);

        $this->command?->info("{$role->label()} account created.");
        $this->command?->table(
            ['Email', 'Role', 'Password'],
            [[$email, $role->value, $password]],
        );
    }
}
