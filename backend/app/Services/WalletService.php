<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\WalletTransactionType;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
     *
     * @param  string|null  $reference  Provider reference to store on the
     *                                  transaction (enables idempotency checks);
     *                                  defaults to a generated DEP reference.
     */
    public function fund(Wallet $wallet, float $amount, string $description = 'Wallet funding', ?string $reference = null): WalletTransaction
    {
        return DB::transaction(function () use ($wallet, $amount, $description, $reference): WalletTransaction {
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
                'reference' => $reference ?? $this->generateReference('DEP'),
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
     * Settle locked escrow OUT of a wallet (release-to-errander flows).
     *
     * Unlike unlock(), which returns escrow to the available balance, this
     * permanently removes the funds from the requester's wallet so they can
     * be paid to the errander. Using unlock() here would hand the money back
     * to the requester AND credit the errander — minting funds from nothing.
     *
     * Returns null (no-op) when nothing is locked — e.g. card payments,
     * where the money never sat in the requester's wallet.
     */
    public function consumeEscrow(Wallet $wallet, float $amount, string $reference): ?WalletTransaction
    {
        return DB::transaction(function () use ($wallet, $amount, $reference): ?WalletTransaction {
            $wallet = $wallet->fresh();
            $consume = min((float) $wallet->locked_balance, $amount);

            if ($consume <= 0) {
                return null;
            }

            $balanceBefore = $wallet->balance;
            $balanceAfter = $balanceBefore - $consume;

            $wallet->update([
                'balance' => $balanceAfter,
                'locked_balance' => max(0, $wallet->locked_balance - $consume),
            ]);

            return WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $wallet->user_id,
                'type' => WalletTransactionType::Payment,
                'amount' => -$consume,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'reference' => $reference,
                'description' => 'Escrow settled to errander',
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

            // Escrow locks live on the requester's wallet, not the errander's —
            // credit the errander's available balance directly.
            $wallet->update(['balance' => $balanceAfter]);

            $txn = WalletTransaction::create([
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

            // Notify the errander AFTER the transaction commits. A failure in
            // FCM or mail must never roll back the wallet credit.
            DB::afterCommit(function () use ($txn, $amount): void {
                try {
                    $user = $txn->wallet?->user;
                    if ($user) {
                        \App\Models\AuditLog::log('payment.released', $user, $txn);

                        app(FcmService::class)->notifyUser(
                            userId: $user->id,
                            title: 'Payment Released 💸',
                            body: "₦{$amount} has been credited to your wallet.",
                            data: ['type' => 'payment_released', 'amount' => $amount],
                        );

                        \Illuminate\Support\Facades\Mail::to($user)->queue(
                            new \App\Mail\PaymentReleasedMail(
                                user: $user,
                                amount: number_format($amount),
                            )
                        );
                    }
                } catch (\Throwable $e) {
                    Log::error('Payout notification failed', [
                        'transaction_id' => $txn->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            });

            return $txn;
        });
    }

    /**
     * Transfer a tip from a requester's wallet to an errander's wallet.
     *
     * Debits the requester's available balance and credits the errander
     * atomically, recording both sides of the ledger.
     */
    public function transferTip(string $fromUserId, string $toUserId, float $amount, string $reference): void
    {
        if ($amount <= 0) {
            return;
        }

        DB::transaction(function () use ($fromUserId, $toUserId, $amount, $reference): void {
            $from = $this->getOrCreateWallet(User::findOrFail($fromUserId));
            $to = $this->getOrCreateWallet(User::findOrFail($toUserId));

            if ($from->available_balance < $amount) {
                throw new \InvalidArgumentException('Insufficient wallet balance to send this tip.');
            }

            // Debit requester
            $fromBefore = $from->balance;
            $from->update(['balance' => $from->balance - $amount]);
            WalletTransaction::create([
                'wallet_id' => $from->id,
                'user_id' => $fromUserId,
                'type' => WalletTransactionType::Payment,
                'amount' => -$amount,
                'balance_before' => $fromBefore,
                'balance_after' => $from->balance,
                'reference' => $reference . '-OUT',
                'description' => 'Tip sent to errander',
                'status' => 'completed',
            ]);

            // Credit errander
            $toBefore = $to->balance;
            $to->update(['balance' => $to->balance + $amount]);
            WalletTransaction::create([
                'wallet_id' => $to->id,
                'user_id' => $toUserId,
                'type' => WalletTransactionType::Payout,
                'amount' => $amount,
                'balance_before' => $toBefore,
                'balance_after' => $to->balance,
                'reference' => $reference . '-IN',
                'description' => 'Tip received from requester',
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
