<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\WalletTransactionType;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WalletService
{
    /**
     * Get or create a wallet for the user.
     */
    public function getOrCreateWallet(User $user): Wallet
    {
        return Wallet::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'locked_balance' => 0, 'currency' => 'NGN', 'status' => 'active']
        );
    }

    /**
     * Fund a wallet (deposit). In production, this is called after
     * Flutterwave/Paystack webhook confirms payment.
     */
    public function fund(Wallet $wallet, float $amount, string $description = 'Wallet funding'): WalletTransaction
    {
        return DB::transaction(function () use ($wallet, $amount, $description): WalletTransaction {
            $balanceBefore = $wallet->balance;
            $balanceAfter = $wallet->balance + $amount;

            $wallet->update(['balance' => $balanceAfter]);

            return WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $wallet->user_id,
                'type' => WalletTransactionType::Deposit,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'reference' => $this->generateReference('DEP'),
                'description' => $description,
                'status' => 'completed',
            ]);
        });
    }

    /**
     * Lock funds for escrow (payment for a request).
     * Moves from available → locked balance.
     */
    public function lock(Wallet $wallet, float $amount, string $reference): WalletTransaction
    {
        return DB::transaction(function () use ($wallet, $amount, $reference): WalletTransaction {
            if ($wallet->available_balance < $amount) {
                throw new \InvalidArgumentException('Insufficient available balance.');
            }

            $wallet->update(['locked_balance' => $wallet->locked_balance + $amount]);

            return WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $wallet->user_id,
                'type' => WalletTransactionType::Lock,
                'amount' => $amount,
                'balance_before' => $wallet->balance,
                'balance_after' => $wallet->balance, // total unchanged
                'reference' => $reference,
                'description' => 'Funds locked for escrow',
                'status' => 'completed',
            ]);
        });
    }

    /**
     * Unlock escrow funds back to available balance (refund).
     */
    public function unlock(Wallet $wallet, float $amount, string $reference): WalletTransaction
    {
        return DB::transaction(function () use ($wallet, $amount, $reference): WalletTransaction {
            $wallet->update(['locked_balance' => max(0, $wallet->locked_balance - $amount)]);

            return WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $wallet->user_id,
                'type' => WalletTransactionType::Unlock,
                'amount' => $amount,
                'balance_before' => $wallet->balance,
                'balance_after' => $wallet->balance,
                'reference' => $reference,
                'description' => 'Escrow funds released',
                'status' => 'completed',
            ]);
        });
    }

    /**
     * Credit payout to an errander's wallet.
     */
    public function creditPayout(Wallet $wallet, float $amount, string $reference): WalletTransaction
    {
        return DB::transaction(function () use ($wallet, $amount, $reference): WalletTransaction {
            $balanceBefore = $wallet->balance;
            $balanceAfter = $wallet->balance + $amount;

            // Unlock + credit in one operation
            $wallet->update([
                'balance' => $balanceAfter,
                'locked_balance' => max(0, $wallet->locked_balance - $amount),
            ]);

            return WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $wallet->user_id,
                'type' => WalletTransactionType::Payout,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'reference' => $reference,
                'description' => 'Earnings from completed request',
                'status' => 'completed',
            ]);
        });
    }

    /**
     * Withdraw funds from wallet to bank account.
     */
    public function withdraw(Wallet $wallet, float $amount, array $bankDetails): array
    {
        $feePercentage = (float) config('errandboy.withdrawal_fee_percentage', 1.5);
        $feeCap = (float) config('errandboy.withdrawal_fee_cap', 200);
        $fee = min(round($amount * ($feePercentage / 100), 2), $feeCap);
        $netAmount = $amount - $fee;

        if ($wallet->available_balance < $amount) {
            throw new \InvalidArgumentException('Insufficient available balance.');
        }

        if ($amount < 1000) {
            throw new \InvalidArgumentException('Minimum withdrawal amount is ₦1,000.');
        }

        return DB::transaction(function () use ($wallet, $amount, $fee, $netAmount, $bankDetails): array {
            $balanceBefore = $wallet->balance;
            $balanceAfter = $wallet->balance - $amount;

            $wallet->update(['balance' => $balanceAfter]);

            $txn = WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $wallet->user_id,
                'type' => WalletTransactionType::Withdrawal,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'reference' => $this->generateReference('WTH'),
                'description' => "Withdrawal to {$bankDetails['account_number']}",
                'status' => 'completed',
            ]);

            $withdrawal = \App\Models\Withdrawal::create([
                'user_id' => $wallet->user_id,
                'wallet_transaction_id' => $txn->id,
                'amount' => $amount,
                'fee' => $fee,
                'net_amount' => $netAmount,
                'bank_code' => $bankDetails['bank_code'],
                'account_number' => $bankDetails['account_number'],
                'account_name' => $bankDetails['account_name'],
                'narration' => $bankDetails['narration'] ?? 'Errand Boy earnings withdrawal',
                'status' => 'pending',
            ]);

            return ['transaction' => $txn, 'withdrawal' => $withdrawal];
        });
    }

    private function generateReference(string $prefix): string
    {
        return strtoupper("{$prefix}-" . now()->format('Ymd') . '-' . Str::random(6));
    }
}
