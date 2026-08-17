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
                // Release funds from requester's locked balance (escrow)
                $requesterWallet = $walletService->getOrCreateWallet($request->requester);
                if ($requesterWallet->locked_balance >= $amount) {
                    $walletService->unlock($requesterWallet, $amount, 'UNLOCK-' . $delivery->id);
                }

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

            $count++;
        }

        $this->info("Released escrow for {$count} deliveries.");

        return self::SUCCESS;
    }
}
