<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPaymentController extends Controller
{
    /** GET /admin/payments — paginated payment history */
    public function index(Request $request): JsonResponse
    {
        $query = Payment::with(['bid', 'user'])
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $payments = $query->paginate((int) $request->input('per_page', 30));

        return response()->json([
            'success' => true,
            'data' => $payments->map(fn (Payment $p) => [
                'id' => $p->id,
                'bid_id' => $p->bid_id,
                'user' => $p->user ? ['id' => $p->user->id, 'name' => $p->user->name] : null,
                'provider' => $p->provider,
                'provider_ref' => $p->provider_ref,
                'amount' => $p->amount,
                'breakdown' => $p->breakdown,
                'currency' => $p->currency,
                'status' => $p->status,
                'payment_method' => $p->payment_method,
                'paid_at' => $p->paid_at?->toISOString(),
                'failed_at' => $p->failed_at?->toISOString(),
                'failure_reason' => $p->failure_reason,
                'retry_count' => $p->retry_count,
                'created_at' => $p->created_at->toISOString(),
            ]),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        ]);
    }
}
