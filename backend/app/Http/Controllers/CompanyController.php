<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CompanyController extends Controller
{
    /**
     * Create a company profile.
     *
     * POST /companies
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'industry' => ['nullable', 'string', 'max:100'],
            'rc_number' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $company = Company::create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']) . '-' . Str::random(6),
            'industry' => $validated['industry'] ?? null,
            'rc_number' => $validated['rc_number'] ?? null,
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        // Add owner as company admin
        CompanyUser::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'role' => 'admin',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $user->assignRole('company_admin');

        return response()->json([
            'success' => true,
            'message' => 'Company created.',
            'data' => ['id' => $company->id, 'name' => $company->name, 'slug' => $company->slug],
        ], 201);
    }

    /**
     * Get company profile.
     *
     * GET /companies/{id}
     */
    public function show(string $id): JsonResponse
    {
        $company = Company::with('owner:id,name')->withCount('members')->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $company->id, 'name' => $company->name, 'slug' => $company->slug,
                'industry' => $company->industry, 'email' => $company->email,
                'owner' => $company->owner ? ['id' => $company->owner->id, 'name' => $company->owner->name] : null,
                'members_count' => $company->members_count,
                'status' => $company->status,
                'created_at' => $company->created_at->toISOString(),
            ],
        ]);
    }

    /**
     * List company members.
     *
     * GET /companies/{id}/members
     */
    public function members(string $id): JsonResponse
    {
        $company = Company::findOrFail($id);
        $members = $company->members()->with('user:id,name,email')->get();

        return response()->json([
            'success' => true,
            'data' => $members->map(fn (CompanyUser $cu) => [
                'id' => $cu->id, 'user_id' => $cu->user_id,
                'name' => $cu->user?->name, 'email' => $cu->user?->email,
                'role' => $cu->role, 'department' => $cu->department,
                'spending_limit' => $cu->spending_limit,
                'status' => $cu->status,
            ]),
        ]);
    }

    /**
     * Invite a team member.
     *
     * POST /companies/{id}/invite
     */
    public function invite(Request $request, string $id): JsonResponse
    {
        $company = Company::findOrFail($id);
        /** @var User $user */
        $user = $request->user();

        if ($company->owner_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Only the company owner can invite members.'], 403);
        }

        $validated = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
            'role' => ['nullable', 'string', 'in:admin,member,finance,viewer'],
            'department' => ['nullable', 'string', 'max:100'],
        ]);

        $invitee = User::where('email', $validated['email'])->first();
        if ($invitee->companyUsers()->where('company_id', $company->id)->exists()) {
            return response()->json(['success' => false, 'message' => 'User is already a member.'], 422);
        }

        CompanyUser::create([
            'company_id' => $company->id,
            'user_id' => $invitee->id,
            'role' => $validated['role'] ?? 'member',
            'department' => $validated['department'] ?? null,
            'status' => 'active',
            'invited_at' => now(),
            'joined_at' => now(),
        ]);

        $invitee->assignRole('company_member');

        return response()->json(['success' => true, 'message' => 'Member added successfully.']);
    }
}
