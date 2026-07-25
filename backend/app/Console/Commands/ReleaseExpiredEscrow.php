<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\RequestStatus;
use App\Services\ErrandStateMachine;
use App\Services\WalletService;
use Illuminate\Console\Command;

class ReleaseExpiredEscrow extends Command
{
    protected $signature = 'errand:release-expired-escrow';
    protected $description = 'Release escrow funds for deliveries whose dispute window has expired.';

    public function handle(WalletService $walletService): int
    {
        $requests = \App\Models\Request::where('status', RequestStatus::EscrowHold->value)
            ->whereHas('delivery', function ($q) {
                $q->whereNotNull('dispute_window_closes_at')
                  ->where('dispute_window_closes_at', '<=', now());
            })
            ->with(['delivery', 'delivery.bid', 'delivery.bid.errander'])
            ->get();

        $stateMachine = app(ErrandStateMachine::class);
        $count = 0;

        foreach ($requests as $request) {
            $delivery = $request->delivery;
            $bid = $delivery?->bid;

            if (! $bid || ! $bid->errander) continue;

            $stateMachine->transition($request, RequestStatus::FundsReleased);

            // Payout to errander
            $wallet = $walletService->getOrCreateWallet($bid->errander);
            $walletService->creditPayout($wallet, (float) $bid->total_amount, 'PAYOUT-' . $delivery->id);

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

            $count++;
        }

        $this->info("Released escrow for {$count} deliveries.");

        return self::SUCCESS;
    }
}
