<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\RequestStatus;
use App\Models\Request;
use App\Services\ErrandStateMachine;
use App\Services\WalletService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReleaseExpiredEscrow extends Command
{
    protected $signature = 'errand:release-expired-escrow';
    protected $description = 'Release escrow funds for deliveries whose dispute window has expired.';

    public function handle(WalletService $walletService): int
    {
        $requests = Request::where('status', RequestStatus::EscrowHold->value)
            ->whereHas('delivery', function ($q) {
                $q->whereNotNull('dispute_window_closes_at')
                  ->where('dispute_window_closes_at', '<=', now());
            })
            ->with(['delivery', 'delivery.bid', 'delivery.bid.errander'])
            ->get();

        $stateMachine = app(ErrandStateMachine::class);
        $count = 0;

        foreach ($requests as $request) {
            try {
                $this->release($request, $walletService, $stateMachine);
                $count++;
            } catch (\Throwable $e) {
                // One broken request must not stop the rest of the batch.
                Log::error('Escrow release failed', [
                    'request_id' => $request->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Released escrow for {$count} deliveries.");

        return self::SUCCESS;
    }

    /**
     * Release a single request's escrow: settle the locked funds out of the
     * requester's wallet, pay the errander (after platform fee), then move
     * the request through funds_released → completed. All in one transaction
     * so a failure can never leave the money unlocked-but-unpaid.
     */
    private function release(Request $request, WalletService $walletService, ErrandStateMachine $stateMachine): void
    {
        DB::transaction(function () use ($request, $walletService, $stateMachine): void {
            $delivery = $request->delivery;
            $bid = $delivery?->bid;

            if (! $bid || ! $bid->errander || ! $request->requester) {
                return;
            }

            $amount = (float) $bid->total_amount;
            $payoutRef = 'PAYOUT-' . $delivery->id . '-' . now()->format('Ymd');

            // Platform fee on errander earnings
            $feePct = (float) \App\Models\PlatformSetting::get('platform_fee_pct', 10);
            $platformFee = round($amount * ($feePct / 100), 2);
            $erranderPayout = $amount - $platformFee;

            // Skip if already paid out (idempotent)
            $alreadyPaid = \App\Models\WalletTransaction::where('reference', 'like', 'PAYOUT-' . $delivery->id . '%')
                ->where('type', 'payout')
                ->exists();

            if (! $alreadyPaid) {
                // Settle the escrow out of the requester's locked balance
                // (card payments have no wallet lock — consumeEscrow no-ops)
                $requesterWallet = $walletService->getOrCreateWallet($request->requester);
                $walletService->consumeEscrow($requesterWallet, $amount, 'SETTLE-' . $delivery->id);

                // Payout to errander (after platform fee)
                $erranderWallet = $walletService->getOrCreateWallet($bid->errander);
                $walletService->creditPayout($erranderWallet, $erranderPayout, $payoutRef);
            }

            $stateMachine->transition($request, RequestStatus::FundsReleased);

            // Update escrow
            \App\Models\EscrowTransaction::where('bid_id', $bid->id)
                ->where('status', 'held')
                ->update([
                    'status' => 'released',
                    'released_at' => now(),
                    'release_trigger' => 'auto',
                ]);

            // Auto-complete
            $stateMachine->transition($request, RequestStatus::Completed);
        });
    }
}
