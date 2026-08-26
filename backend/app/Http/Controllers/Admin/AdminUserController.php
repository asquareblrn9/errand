<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;

class AdminUserController extends Controller
{
    /**
     * List all users with filters.
     *
     * GET /admin/users
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::query()->orderByDesc('created_at');

        if ($role = $request->input('role')) $query->where('role', $role);
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        $users = $query->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $users->map(fn (User $u) => [
                'id' => $u->id, 'name' => $u->name, 'email' => $u->email,
                'phone' => $u->phone, 'role' => $u->role->value,
                'status' => $u->status->value, 'kyc_tier' => $u->kyc_tier,
                'completed_orders' => $u->completed_orders,
                'created_at' => $u->created_at->toISOString(),
            ]),
            'meta' => ['current_page' => $users->currentPage(), 'per_page' => $users->perPage(), 'total' => $users->total()],
        ]);
    }

    /**
     * Get user details.
     *
     * GET /admin/users/{id}
     */
    public function show(string $id): JsonResponse
    {
        $user = User::with(['addresses', 'wallet'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id, 'name' => $user->name, 'email' => $user->email,
                'phone' => $user->phone, 'role' => $user->role->value,
                'status' => $user->status->value, 'kyc_tier' => $user->kyc_tier,
                'kyc_status' => $user->kyc_status,
                'email_verified' => $user->email_verified_at !== null,
                'phone_verified' => $user->phone_verified_at !== null,
                'two_factor_enabled' => $user->two_factor_enabled,
                'completed_orders' => $user->completed_orders,
                'wallet' => $user->wallet ? ['balance' => $user->wallet->balance, 'locked' => $user->wallet->locked_balance] : null,
                'created_at' => $user->created_at->toISOString(),
            ],
        ]);
    }

    /**
     * Create a new admin or super_admin staff account.
     *
     * Only a super_admin may create another super_admin account.
     * New accounts are created active and pre-verified — they log in
     * via the normal POST /auth/login flow.
     *
     * POST /admin/admins
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => [
                'required',
                'string',
                'max:20',
                'unique:users,phone',
                'regex:/^\+?[1-9]\d{6,14}$/',
            ],
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(8)
                    ->letters()
                    ->mixedCase()
                    ->numbers()
                    ->symbols(),
            ],
            'role' => ['required', 'string', 'in:admin,super_admin'],
        ]);

        $role = UserRole::from($validated['role']);

        // Only a super_admin may create another super_admin
        if ($role === UserRole::SuperAdmin && ! $request->user()->hasRole(UserRole::SuperAdmin->value)) {
            return response()->json([
                'success' => false,
                'message' => 'Only a super admin can create a super admin account.',
            ], 403);
        }

        $user = DB::transaction(function () use ($validated, $role): User {
            /** @var User $user */
            $user = User::create([
                'name' => trim($validated['first_name'].' '.$validated['last_name']),
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'],
                'password' => $validated['password'],
                'role' => $role,
                'status' => UserStatus::Active,
                'kyc_tier' => 3,
                'email_verified_at' => now(),
                'phone_verified_at' => now(),
            ]);

            // Assign Spatie role (source of truth for authorization)
            $user->assignRole($role->value);

            return $user;
        });

        AuditLog::log('admin.admin_created', $user, $request->user(), null, null, [
            'admin_id' => $request->user()->id,
            'created_role' => $role->value,
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "{$role->label()} account created successfully.",
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role->value,
                'status' => $user->status->value,
                'created_at' => $user->created_at->toISOString(),
            ],
        ], 201);
    }

    /**
     * Suspend a user.
     *
     * PUT /admin/users/{id}/suspend
     */
    public function suspend(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Cannot suspend yourself.'], 422);
        }

        $user->update(['status' => 'suspended']);

        AuditLog::log('admin.user_suspended', $user, $request->user(), null, null, [
            'admin_id' => $request->user()->id,
            'ip' => $request->ip(),
        ]);

        return response()->json(['success' => true, 'message' => 'User suspended.']);
    }

    /**
     * Activate a suspended user.
     *
     * PUT /admin/users/{id}/activate
     */
    public function activate(string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'active']);

        AuditLog::log('admin.user_activated', $user, $request->user(), null, null, [
            'admin_id' => $request->user()->id,
            'ip' => $request->ip(),
        ]);

        return response()->json(['success' => true, 'message' => 'User activated.']);
    }

    /**
     * Ban a user permanently.
     *
     * PUT /admin/users/{id}/ban
     */
    public function ban(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $reason = $request->input('reason', 'Violation of terms');

        $user->update([
            'status' => 'banned',
            'banned_at' => now(),
            'ban_reason' => $reason,
        ]);
        $user->tokens()->delete();

        AuditLog::log('admin.user_banned', $user, $request->user(), null, null, [
            'admin_id' => $request->user()->id,
            'reason' => $user->ban_reason,
            'ip' => $request->ip(),
        ]);

        return response()->json(['success' => true, 'message' => 'User banned.']);
    }

    /** POST /admin/users/{id}/reset-password — admin-triggered password reset */
    public function resetPassword(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->update(['password' => $validated['password']]);

        AuditLog::log('admin.password_reset', $user, $request->user());

        return response()->json(['success' => true, 'message' => 'Password reset successfully.']);
    }
}
