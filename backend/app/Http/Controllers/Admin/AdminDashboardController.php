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
     * List active errands with SLA and escrow info.
     *
     * GET /admin/errands
     */
    public function errands(): JsonResponse
    {
        $errands = \App\Models\Request::with(['requester', 'bids.errander', 'category', 'delivery'])
            ->whereIn('status', ['assigned', 'in_progress', 'disputed'])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $errands->map(function ($r) {
                $activeBid = $r->bids->firstWhere('status', 'accepted')
                    ?? $r->bids->firstWhere('status', 'payment_made')
                    ?? $r->bids->firstWhere('status', 'in_progress');
                $delivery = $r->delivery;
                $lateThreshold = (int) \App\Models\PlatformSetting::get('delivery_late_threshold_pct', 40);

                return [
                    'id' => $r->id,
                    'title' => $r->title,
                    'status' => $r->status->value,
                    'requester' => $r->requester?->name,
                    'errander' => $activeBid?->errander?->name,
                    'category' => $r->category?->name,
                    'amount' => $activeBid?->total_amount,
                    'bid_status' => $activeBid?->status?->value,
                    'sla_minutes' => $delivery?->sla_minutes,
                    'started_at' => $delivery?->started_at?->toISOString(),
                    'deadline_at' => $delivery?->deadline_at?->toISOString(),
                    'minutes_remaining' => $delivery?->minutesRemaining(),
                    'is_late' => $delivery?->isLate() ?? false,
                    'is_over_threshold' => $delivery && $delivery->started_at && $delivery->deadline_at
                        ? (($delivery->started_at->diffInMinutes(now()) / max(1, $delivery->started_at->diffInMinutes($delivery->deadline_at))) * 100 >= $lateThreshold)
                        : false,
                    'late_fee_accrued' => $delivery?->late_fee_accrued,
                    'created_at' => $r->created_at->toISOString(),
                ];
            }),
            'meta' => ['current_page' => $errands->currentPage(), 'total' => $errands->total()],
        ]);
    }

    /**
     * Platform analytics dashboard.
     *
     * GET /admin/dashboard
     */
    public function index(): JsonResponse
    {
        $totalUsers = User::count();
        $activeUsers = User::where('status', 'active')->count();
        $suspendedUsers = User::where('status', 'suspended')->count();
        $totalRequesters = User::where('role', 'requester')->count();
        $totalErranders = User::where('role', 'errander')->count();

        $totalRequests = DB::table('requests')->count();
        $activeJobs = DB::table('requests')->whereIn('status', ['assigned', 'in_progress'])->count();
        $pendingJobs = DB::table('requests')->where('status', 'open')->count();
        $completedJobs = DB::table('requests')->where('status', 'completed')->count();
        $cancelledJobs = DB::table('requests')->whereIn('status', ['cancelled', 'expired'])->count();
        $disputedJobs = DB::table('disputes')->whereNotIn('status', ['completed'])->count();

        $totalPayments = (float) (DB::table('payments')->where('status', 'successful')->sum('amount') ?? 0);
        $totalPayouts = (float) (DB::table('wallet_transactions')->where('type', 'payout')->sum('amount') ?? 0);
        // Tips are recorded as payout transactions but aren't escrow payouts —
        // exclude them from escrow-vs-payout fee math.
        $escrowPayouts = (float) (DB::table('wallet_transactions')
            ->where('type', 'payout')
            ->where('reference', 'not like', 'TIP-%')
            ->sum('amount') ?? 0);

        // Requester-side commission is charged at bid time and stored on the
        // payment breakdown — sum the ACTUAL fee, not a percentage estimate.
        $requesterCommissionPct = (float) \App\Models\PlatformSetting::get('platform_commission_pct', 5);
        $requesterCommission = (float) \App\Models\Payment::where('status', 'successful')
            ->get()
            ->sum(fn (\App\Models\Payment $p) => (float) ($p->breakdown['platform_fee'] ?? 0));

        // Escrow rows are created at payment time AND at OTP confirmation, so
        // sums must deduplicate by bid_id to avoid double-counting.
        $releasedEscrow = \App\Models\EscrowTransaction::where('status', 'released')->get();
        $releasedBids = $releasedEscrow->unique('bid_id');
        $totalEscrowReleased = (float) $releasedBids->sum('amount');

        // Errander-side platform fee = escrow that was paid out minus what the
        // errander actually received. Only count triggers where the money went
        // to the errander (refunds/cancellations are not fees).
        $erranderFeePct = (float) \App\Models\PlatformSetting::get('platform_fee_pct', 10);
        $payoutEscrow = (float) $releasedBids
            ->whereIn('release_trigger', ['auto', 'funds_released', 'manual_fix'])
            ->sum('amount');
        $erranderFees = round(max(0, $payoutEscrow - $escrowPayouts), 2);
        $platformFees = round($requesterCommission + $erranderFees, 2);

        $totalWithdrawals = DB::table('withdrawals')->count();
        $successfulTxns = DB::table('wallet_transactions')->where('status', 'completed')->count();
        $failedTxns = DB::table('wallet_transactions')->where('status', 'failed')->count();

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    ['key' => 'total_revenue', 'label' => 'Total Revenue (Requesters)', 'value' => round($totalPayments, 2), 'format' => 'currency', 'route' => '/admin/payments'],
                    ['key' => 'total_earnings', 'label' => 'Total Errander Earnings', 'value' => round($totalPayouts, 2), 'format' => 'currency', 'route' => '/admin/payments'],
                    ['key' => 'platform_fees', 'label' => 'Platform Fees Collected', 'value' => round($platformFees, 2), 'format' => 'currency', 'route' => '/admin/payments'],
                    ['key' => 'completed_jobs', 'label' => 'Completed Jobs', 'value' => $completedJobs, 'format' => 'number', 'route' => '/admin/errands'],
                    ['key' => 'active_jobs', 'label' => 'Active Jobs', 'value' => $activeJobs, 'format' => 'number', 'route' => '/admin/errands'],
                    ['key' => 'pending_jobs', 'label' => 'Pending Jobs', 'value' => $pendingJobs, 'format' => 'number', 'route' => '/admin/errands'],
                    ['key' => 'cancelled_jobs', 'label' => 'Cancelled Jobs', 'value' => $cancelledJobs, 'format' => 'number', 'route' => '/admin/errands'],
                    ['key' => 'total_requesters', 'label' => 'Registered Requesters', 'value' => $totalRequesters, 'format' => 'number', 'route' => '/admin/users'],
                    ['key' => 'total_erranders', 'label' => 'Registered Erranders', 'value' => $totalErranders, 'format' => 'number', 'route' => '/admin/users'],
                    ['key' => 'active_users', 'label' => 'Active Users', 'value' => $activeUsers, 'format' => 'number', 'route' => '/admin/users'],
                    ['key' => 'suspended_users', 'label' => 'Suspended Users', 'value' => $suspendedUsers, 'format' => 'number', 'route' => '/admin/users'],
                    ['key' => 'disputed_jobs', 'label' => 'Disputed Jobs', 'value' => $disputedJobs, 'format' => 'number', 'route' => '/admin/disputes'],
                    ['key' => 'total_withdrawals', 'label' => 'Total Withdrawals', 'value' => $totalWithdrawals, 'format' => 'number', 'route' => '/admin/payments'],
                    ['key' => 'successful_txns', 'label' => 'Successful Transactions', 'value' => $successfulTxns, 'format' => 'number', 'route' => '/admin/payments'],
                    ['key' => 'failed_txns', 'label' => 'Failed Transactions', 'value' => $failedTxns, 'format' => 'number', 'route' => '/admin/payments'],
                ],
                'rates' => [
                    'completion_rate' => $totalRequests > 0 ? round(($completedJobs / $totalRequests) * 100, 1) : 0,
                    'requester_commission_pct' => $requesterCommissionPct,
                    'errander_fee_pct' => $erranderFeePct,
                    'escrow_held' => round((float) (\App\Models\EscrowTransaction::where('status', 'held')->sum('amount') ?? 0), 2),
                ],
            ],
        ]);
    }

    /**
     * Errander earnings summary.
     *
     * GET /admin/errander-earnings
     */
    public function erranderEarnings(): JsonResponse
    {
        $erranders = User::where('role', 'errander')
            ->with('wallet')
            ->get()
            ->map(function (User $u) {
                $payoutTotal = \App\Models\WalletTransaction::where('user_id', $u->id)
                    ->where('type', 'payout')
                    ->sum('amount');
                $payoutTotal = (float) $payoutTotal;
                $completedOrders = \App\Models\Bid::where('errander_id', $u->id)
                    ->where('status', 'completed')
                    ->count();

                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'completed_orders' => $completedOrders,
                    'total_earned' => round((float) $payoutTotal, 2),
                    'wallet_balance' => round((float) ($u->wallet?->balance ?? 0), 2),
                    'locked_balance' => round((float) ($u->wallet?->locked_balance ?? 0), 2),
                    'kyc_tier' => $u->kyc_tier,
                    'status' => $u->status->value,
                    'is_online' => $u->is_online,
                ];
            })
            ->sortByDesc('total_earned')
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'erranders' => $erranders,
                'summary' => [
                    'total_erranders' => $erranders->count(),
                    'active_erranders' => $erranders->where('status', 'active')->count(),
                    'total_paid_out' => round((float) $erranders->sum('total_earned'), 2),
                    'total_in_escrow' => round((float) $erranders->sum('locked_balance'), 2),
                ],
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
