<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    /**
     * Platform analytics dashboard.
     *
     * GET /admin/dashboard
     */
    public function index(): JsonResponse
    {
        $totalUsers = User::count();
        $activeUsers = User::where('status', 'active')->count();
        $totalRequesters = User::where('role', 'requester')->count();
        $totalErranders = User::where('role', 'errander')->count();

        $totalRequests = DB::table('requests')->count();
        $completedRequests = DB::table('requests')->where('status', 'completed')->count();
        $pendingDisputes = DB::table('disputes')->whereIn('status', ['open', 'under_review'])->count();

        $totalPayments = DB::table('payments')->where('status', 'successful')->sum('amount') ?? 0;
        $platformRevenue = DB::table('payments')->where('status', 'successful')->sum('amount') * 0.05;

        return response()->json([
            'success' => true,
            'data' => [
                'users' => ['total' => $totalUsers, 'active' => $activeUsers, 'requesters' => $totalRequesters, 'erranders' => $totalErranders],
                'requests' => ['total' => $totalRequests, 'completed' => $completedRequests, 'completion_rate' => $totalRequests > 0 ? round(($completedRequests / $totalRequests) * 100, 1) : 0],
                'disputes' => ['pending' => $pendingDisputes],
                'finances' => ['total_payments' => $totalPayments, 'platform_revenue' => $platformRevenue],
            ],
        ]);
    }

    /**
     * KYC pending review queue.
     *
     * GET /admin/kyc/pending
     */
    public function kycPending(): JsonResponse
    {
        $pending = User::where('kyc_tier', '>=', 1)
            ->where('status', 'active')
            ->where(function ($q) {
                $q->whereNull('email_verified_at')->orWhereNull('phone_verified_at');
            })
            ->orderBy('created_at')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $pending->map(fn (User $u) => [
                'id' => $u->id, 'name' => $u->name, 'email' => $u->email,
                'kyc_tier' => $u->kyc_tier,
                'email_verified' => $u->email_verified_at !== null,
                'phone_verified' => $u->phone_verified_at !== null,
            ]),
            'meta' => ['current_page' => $pending->currentPage(), 'total' => $pending->total()],
        ]);
    }

    /**
     * Approve KYC tier upgrade.
     *
     * POST /admin/kyc/{id}/approve
     */
    public function kycApprove(string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->update(['kyc_tier' => min(3, $user->kyc_tier + 1)]);

        return response()->json(['success' => true, 'message' => 'KYC tier upgraded.', 'data' => ['kyc_tier' => $user->kyc_tier]]);
    }
}
