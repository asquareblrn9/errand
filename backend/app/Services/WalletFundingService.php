<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\WalletFunding;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * WalletFundingService
 *
 * Idempotent status transitions + wallet crediting for wallet top-ups.
 * Every terminal transition is a conditional UPDATE guarded on the
 * funding still being 'pending', so concurrent webhook + client
 * verification can never credit the wallet twice.
 */
class WalletFundingService
{
    public function __construct(
        private readonly WalletService $walletService,
    ) {}

    /**
     * Confirm a funding and credit the wallet exactly once.
     *
     * @return bool True if this call performed the credit.
     */
    public function confirm(WalletFunding $funding, ?string $providerTransactionId = null, ?float $verifiedAmount = null): bool
    {
        return DB::transaction(function () use ($funding, $providerTransactionId, $verifiedAmount): bool {
            $updated = WalletFunding::whereKey($funding->id)
                ->where('status', 'pending')
                ->update([
                    'status' => 'successful',
                    'verified_at' => now(),
                    'failure_reason' => null,
                ]);

            if ($updated === 0) {
                return false; // Already processed by a concurrent caller
            }

            $amount = $verifiedAmount ?? $funding->amount;
            $wallet = $this->walletService->getOrCreateWallet($funding->user);

            // The WalletTransaction keeps the provider reference so the
            // historical idempotency check can't be defeated by retries.
            $this->walletService->fund(
                $wallet,
                $amount,
                "Wallet funding via {$funding->provider} ({$funding->provider_ref})",
                $funding->provider_ref,
            );

            Log::info('Wallet funding confirmed', [
                'funding_id' => $funding->id,
                'provider_ref' => $funding->provider_ref,
                'amount' => $amount,
                'provider_transaction_id' => $providerTransactionId,
            ]);

            return true;
        });
    }

    /**
     * Mark a funding as failed.
     */
    public function fail(WalletFunding $funding, string $reason): bool
    {
        return WalletFunding::whereKey($funding->id)
            ->where('status', 'pending')
            ->update([
                'status' => 'failed',
                'failed_at' => now(),
                'failure_reason' => $reason,
            ]) > 0;
    }

    /**
     * Mark a funding as cancelled by the customer.
     */
    public function cancel(WalletFunding $funding): bool
    {
        return WalletFunding::whereKey($funding->id)
            ->where('status', 'pending')
            ->update([
                'status' => 'cancelled',
                'failed_at' => now(),
                'failure_reason' => 'Payment cancelled by customer.',
            ]) > 0;
    }
}
