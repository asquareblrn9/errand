<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\WalletTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminTransactionController extends Controller
{
    /** GET /admin/transactions — rich transaction listing with search, filters, export */
    public function index(Request $request): JsonResponse
    {
        $query = WalletTransaction::with(['wallet.user'])
            ->orderByDesc('created_at');

        // Search by transaction ID, user name, payment reference
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'ilike', "%{$search}%")
                  ->orWhere('id', 'ilike', "%{$search}%")
                  ->orWhereHas('wallet.user', fn ($u) => $u->where('name', 'ilike', "%{$search}%"));
            });
        }

        // Filter by type
        if ($type = $request->input('type')) {
            $types = explode(',', $type);
            $query->whereIn('type', $types);
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Date range
        if ($from = $request->input('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $query->where('created_at', '<=', $to . ' 23:59:59');
        }

        // Export
        if ($format = $request->input('format')) {
            if ($format === 'csv') {
                return $this->exportCsv($query->get());
            }
            return $this->exportJson($query->get());
        }

        $perPage = min((int) $request->input('per_page', 25), 100);
        $transactions = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $transactions->map(fn (WalletTransaction $t) => $this->format($t)),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
                'last_page' => $transactions->lastPage(),
            ],
        ]);
    }

    /** GET /admin/transactions/{id} — single transaction detail */
    public function show(string $id): JsonResponse
    {
        $t = WalletTransaction::with(['wallet.user'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->format($t, detailed: true),
        ]);
    }

    // ── Formatting ──────────────────────────────────────────

    private function format(WalletTransaction $t, bool $detailed = false): array
    {
        // Compute platform fee for payout transactions
        $platformFee = 0;
        $netAmount = $t->amount;
        if ($t->type->value === 'payout') {
            $feePct = (float) \App\Models\PlatformSetting::get('platform_fee_pct', 10);
            $platformFee = round($t->amount * ($feePct / 100), 2);
            $netAmount = $t->amount - $platformFee;
        }

        $data = [
            'id' => $t->id,
            'reference' => $t->reference,
            'type' => $t->type->value,
            'amount' => round((float) $t->amount, 2),
            'platform_fee' => $platformFee,
            'net_amount' => round($netAmount, 2),
            'user' => $t->wallet?->user ? [
                'id' => $t->wallet->user->id,
                'name' => $t->wallet->user->name,
                'role' => $t->wallet->user->role->value,
            ] : null,
            'balance_before' => round((float) $t->balance_before, 2),
            'balance_after' => round((float) $t->balance_after, 2),
            'status' => $t->status,
            'description' => $t->description,
            'created_at' => $t->created_at->toISOString(),
        ];

        if ($detailed) {
            $data['metadata'] = $t->metadata;
            $data['related_transaction_id'] = $t->related_transaction_id;
        }

        return $data;
    }

    // ── Export ──────────────────────────────────────────────

    private function exportCsv($transactions): \Illuminate\Http\Response
    {
        $headers = ['Transaction ID', 'Reference', 'Type', 'User', 'Role', 'Amount', 'Platform Fee', 'Net Amount', 'Status', 'Description', 'Date'];

        $rows = $transactions->map(function (WalletTransaction $t) {
            $data = $this->format($t);
            return [
                $data['id'], $data['reference'], $data['type'],
                $data['user']['name'] ?? '', $data['user']['role'] ?? '',
                $data['amount'], $data['platform_fee'], $data['net_amount'],
                $data['status'], $data['description'] ?? '',
                $data['created_at'],
            ];
        });

        $csv = fopen('php://temp', 'r+');
        fputcsv($csv, $headers);
        foreach ($rows as $row) {
            fputcsv($csv, $row);
        }
        rewind($csv);
        $content = stream_get_contents($csv);
        fclose($csv);

        return response($content, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="transactions-' . now()->format('Ymd-His') . '.csv"',
        ]);
    }

    private function exportJson($transactions): JsonResponse
    {
        $rows = $transactions->map(fn (WalletTransaction $t) => $this->format($t));

        return response()->json([
            'success' => true,
            'data' => $rows,
            'export' => [
                'format' => 'json',
                'total' => $rows->count(),
                'generated_at' => now()->toISOString(),
            ],
        ]);
    }
}
