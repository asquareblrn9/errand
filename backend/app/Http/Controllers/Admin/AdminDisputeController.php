<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dispute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminDisputeController extends Controller
{
    /** GET /admin/disputes — list all disputes */
    public function index(Request $request): JsonResponse
    {
        $query = Dispute::with(['raiser', 'errander'])
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $disputes = $query->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $disputes->map(fn (Dispute $d) => [
                'id' => $d->id,
                'delivery_id' => $d->delivery_id,
                'request_id' => $d->request_id,
                'raiser' => $d->raiser ? ['id' => $d->raiser->id, 'name' => $d->raiser->name] : null,
                'errander' => $d->errander ? ['id' => $d->errander->id, 'name' => $d->errander->name] : null,
                'reason' => $d->reason,
                'status' => $d->status,
                'resolution_note' => $d->resolution_note,
                'resolved_at' => $d->resolved_at?->toISOString(),
                'created_at' => $d->created_at->toISOString(),
            ]),
            'meta' => [
                'current_page' => $disputes->currentPage(),
                'per_page' => $disputes->perPage(),
                'total' => $disputes->total(),
                'last_page' => $disputes->lastPage(),
            ],
        ]);
    }
}
