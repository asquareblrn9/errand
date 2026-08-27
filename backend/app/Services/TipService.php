<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Bid;
use App\Models\Tip;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * TipService
 *
 * Wallet-funded tips from a requester to an errander. One tip per errand:
 * the bid row is locked inside the transaction so concurrent attempts
 * serialize, and the unique bid_id column on tips is the backstop.
 */
class TipService
{
    public function __construct(
        private readonly WalletService $walletService,
    ) {}

    /**
     * Send a tip for an accepted-and-confirmed errand.
     *
     * @throws \InvalidArgumentException  window closed / already tipped / insufficient funds / not the requester
     */
    public function sendTip(Bid $bid, User $requester, float $amount): Tip
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Tip amount must be greater than zero.');
        }

        return DB::transaction(function () use ($bid, $requester, $amount): Tip {
            // Serialize concurrent tip attempts for this bid
            /** @var Bid $lockedBid */
            $lockedBid = Bid::whereKey($bid->id)->lockForUpdate()->firstOrFail();

            $request = $lockedBid->request()->with('delivery')->firstOrFail();

            if ($requester->id !== $request->user_id) {
                throw new \InvalidArgumentException('Only the request owner can send a tip.');
            }

            $delivery = $request->delivery;

            if (! $delivery || ! $delivery->confirmed || ! $delivery->isDisputeWindowOpen()) {
                throw new \InvalidArgumentException('Tips can only be sent while the dispute window is open.');
            }

            if (Tip::where('bid_id', $lockedBid->id)->exists()) {
                throw new \InvalidArgumentException('You have already tipped this errand.');
            }

            $reference = 'TIP-' . Str::upper(Str::random(10));

            // Debits requester / credits errander atomically (throws on insufficient funds)
            $this->walletService->transferTip(
                fromUserId: $requester->id,
                toUserId: $lockedBid->errander_id,
                amount: $amount,
                reference: $reference,
            );

            try {
                return Tip::create([
                    'bid_id' => $lockedBid->id,
                    'request_id' => $lockedBid->request_id,
                    'requester_id' => $requester->id,
                    'errander_id' => $lockedBid->errander_id,
                    'amount' => $amount,
                    'reference' => $reference,
                ]);
            } catch (UniqueConstraintViolationException) {
                // Backstop: another path created a tip for this bid.
                // The exception rolls the transaction back, so the wallet
                // transfer above is undone — money never moves twice.
                throw new \InvalidArgumentException('You have already tipped this errand.');
            }
        });
    }
}
