<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Models\EscrowTransaction;
use App\Models\Payment;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;

class AdminEscrowController extends Controller
{
    /** GET /admin/escrow — escrow summary + active holds */
    public function index(): JsonResponse
    {
        $activeEscrow = EscrowTransaction::where('status', 'held')->get();
        $totalHeld = (float) $activeEscrow->sum('amount');

        $totalLocked = (float) Wallet::sum('locked_balance');
        $paymentsTotal = (float) Payment::where('status', 'successful')->sum('amount');
        $escrowRequests = \App\Models\Request::whereIn('status', [
            RequestStatus::EscrowHold->value,
            RequestStatus::DisputeWindow->value,
        ])->count();

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => [
                    'total_held' => round($totalHeld, 2),
                    'total_locked_wallets' => round($totalLocked, 2),
                    'total_payments' => round($paymentsTotal, 2),
                    'active_escrow_count' => $escrowRequests,
                ],
                'holds' => $activeEscrow->map(fn (EscrowTransaction $e) => [
                    'id' => $e->id,
                    'bid_id' => $e->bid_id,
                    'requester' => $e->requester?->name,
                    'errander' => $e->errander?->name,
                    'amount' => $e->amount,
                    'breakdown' => $e->breakdown,
                    'status' => $e->status,
                    'held_at' => $e->held_at?->toISOString(),
                ]),
            ],
        ]);
    }
}
