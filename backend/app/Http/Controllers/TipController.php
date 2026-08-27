<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\User;
use App\Services\TipService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TipController extends Controller
{
    public function __construct(
        private readonly TipService $tipService,
        private readonly WalletService $walletService,
    ) {}

    /**
     * Send a wallet-funded tip to the errander of a completed errand.
     *
     * POST /bids/{bidId}/tip
     */
    public function store(Request $request, string $bidId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:100000'],
        ]);

        $bid = Bid::with('request')->findOrFail($bidId);

        if ($user->id !== $bid->request->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'Only the request owner can send a tip.',
            ], 403);
        }

        try {
            $tip = $this->tipService->sendTip($bid, $user, (float) $validated['amount']);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'code' => $this->errorCode($e->getMessage()),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Tip sent.',
            'data' => [
                'tip' => [
                    'id' => $tip->id,
                    'bid_id' => $tip->bid_id,
                    'amount' => $tip->amount,
                    'reference' => $tip->reference,
                    'created_at' => $tip->created_at->toISOString(),
                ],
                'available_balance' => $this->walletService->getOrCreateWallet($user)->available_balance,
            ],
        ], 201);
    }

    /**
     * Map a service error message to a machine-readable code.
     */
    private function errorCode(string $message): string
    {
        return match (true) {
            str_contains($message, 'already tipped') => 'already_tipped',
            str_contains($message, 'window') => 'tip_window_closed',
            str_contains($message, 'Insufficient') => 'insufficient_funds',
            default => 'tip_failed',
        };
    }
}
