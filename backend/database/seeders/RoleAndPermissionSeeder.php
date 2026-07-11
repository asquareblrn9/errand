<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleAndPermissionSeeder extends Seeder
{
    /**
     * All platform permissions grouped by domain.
     *
     * @var array<string, array<int, string>>
     */
    private const PERMISSIONS = [
        'request' => [
            'request.create',
            'request.read',
            'request.update',
            'request.delete',
        ],
        'bid' => [
            'bid.create',
            'bid.read',
            'bid.delete',
        ],
        'payment' => [
            'payment.initiate',
            'payment.read',
        ],
        'delivery' => [
            'delivery.generate_otp',
            'delivery.confirm',
            'delivery.read',
        ],
        'dispute' => [
            'dispute.create',
            'dispute.read',
            'dispute.respond',
        ],
        'wallet' => [
            'wallet.fund',
            'wallet.withdraw',
            'wallet.read',
        ],
        'chat' => [
            'chat.send',
            'chat.read',
        ],
        'kyc' => [
            'kyc.submit',
            'kyc.read',
        ],
        'rating' => [
            'rating.create',
            'rating.read',
        ],
        'business' => [
            'business.manage',
            'business.invite',
        ],
        'subscription' => [
            'subscription.manage',
        ],
        'analytics' => [
            'analytics.view',
        ],
        'admin' => [
            'admin.users',
            'admin.disputes',
            'admin.payments',
            'admin.settings',
            'admin.categories',
        ],
    ];

    /**
     * Role → Permission mapping.
     *
     * 'super_admin' gets all permissions (including destructive).
     * 'admin' gets everything except destructive operations.
     *
     * @var array<string, array<int, string>>
     */
    private const ROLE_PERMISSIONS = [
        'requester' => [
            'request.create', 'request.read', 'request.update', 'request.delete',
            'bid.read',
            'payment.initiate', 'payment.read',
            'delivery.confirm', 'delivery.read',
            'dispute.create', 'dispute.read',
            'wallet.fund', 'wallet.read',
            'chat.send', 'chat.read',
            'kyc.submit', 'kyc.read',
            'rating.create', 'rating.read',
            'subscription.manage',
        ],
        'errander' => [
            'request.read',
            'bid.create', 'bid.read', 'bid.delete',
            'delivery.generate_otp', 'delivery.read',
            'dispute.read', 'dispute.respond',
            'wallet.withdraw', 'wallet.read',
            'chat.send', 'chat.read',
            'kyc.submit', 'kyc.read',
            'rating.create', 'rating.read',
        ],
        'company_admin' => [
            'request.create', 'request.read',
            'bid.read',
            'payment.initiate', 'payment.read',
            'delivery.confirm', 'delivery.read',
            'business.manage', 'business.invite',
            'analytics.view',
        ],
        'company_member' => [
            'request.create', 'request.read',
            'bid.read',
            'payment.initiate', 'payment.read',
            'delivery.confirm', 'delivery.read',
        ],
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ── Create all permissions ──────────────────────────
        foreach (self::PERMISSIONS as $permissions) {
            foreach ($permissions as $permission) {
                Permission::firstOrCreate(
                    ['name' => $permission, 'guard_name' => 'web']
                );
            }
        }

        // ── Create roles and assign permissions ─────────────
        foreach (self::ROLE_PERMISSIONS as $roleName => $permissions) {
            /** @var Role $role */
            $role = Role::firstOrCreate(
                ['name' => $roleName, 'guard_name' => 'web']
            );
            $role->syncPermissions($permissions);
        }

        // ── Admin: all non-destructive permissions ──────────
        $adminRole = Role::firstOrCreate(
            ['name' => 'admin', 'guard_name' => 'web']
        );
        $adminRole->syncPermissions(
            Permission::where('name', 'not like', '%.delete-force')
                ->where('name', 'not like', 'admin.users.delete')
                ->pluck('name')
                ->toArray()
        );

        // ── Super Admin: all permissions ────────────────────
        $superAdminRole = Role::firstOrCreate(
            ['name' => 'super_admin', 'guard_name' => 'web']
        );
        $superAdminRole->syncPermissions(
            Permission::all()->pluck('name')->toArray()
        );

        $this->command?->info('Roles and permissions seeded successfully.');
    }
}
