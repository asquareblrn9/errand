<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\FlutterwaveService;
use App\Services\PaystackService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly PaystackService $paystackService,
        private readonly FlutterwaveService $flutterwaveService,
    ) {}

    // ── Wallet Balance ───────────────────────────────────────

    /**
     * Get authenticated user's wallet balance.
     *
     * GET /wallet
     */
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $wallet = $this->walletService->getOrCreateWallet($user);

        // Pending earnings from escrow (errander only)
        $pendingEarnings = 0;
        if ($user->role->value === 'errander') {
            $pendingEarnings = \App\Models\EscrowTransaction::where('errander_id', $user->id)
                ->where('status', 'held')
                ->sum('amount') ?? 0;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $wallet->id,
                'balance' => $wallet->balance,
                'locked_balance' => $wallet->locked_balance,
                'available_balance' => $wallet->available_balance,
                'pending_earnings' => round((float) $pendingEarnings, 2),
                'currency' => $wallet->currency,
                'status' => $wallet->status,
            ],
        ]);
    }

    // ── Bank Verification ────────────────────────────────────

    /**
     * Resolve bank account details (verify account number → get account name).
     *
     * POST /wallet/resolve-account
     */
    public function resolveAccount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'account_number' => ['required', 'string', 'size:10'],
            'bank_code' => ['required', 'string', 'max:10'],
            'provider' => ['nullable', 'string', 'in:paystack,flutterwave'],
        ]);

        $provider = $validated['provider'] ?? 'paystack';

        try {
            if ($provider === 'flutterwave') {
                $result = $this->flutterwaveService->resolveAccount(
                    $validated['account_number'],
                    $validated['bank_code'],
                );
            } else {
                $result = $this->paystackService->resolveAccount(
                    $validated['account_number'],
                    $validated['bank_code'],
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'Account resolved successfully.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get list of supported banks.
     *
     * GET /wallet/banks
     */
    public function banks(Request $request): JsonResponse
    {
        $provider = $request->input('provider', 'paystack');

        $banks = $provider === 'flutterwave'
            ? $this->flutterwaveService->getBanks()
            : $this->paystackService->getBanks();

        return response()->json([
            'success' => true,
            'data' => $banks,
        ]);
    }

    // ── Wallet Funding ───────────────────────────────────────

    /**
     * Fund wallet — initialize payment via Paystack or Flutterwave.
     *
     * POST /wallet/fund
     */
    public function fund(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1000', 'max:500000'],
            'payment_gateway' => ['required', 'string', 'in:paystack,flutterwave'],
        ]);

        $amount = (float) $validated['amount'];
        $reference = 'FUND-' . Str::upper(Str::random(12));

        try {
            if ($validated['payment_gateway'] === 'paystack') {
                $result = $this->paystackService->initializeFunding(
                    email: $user->email,
                    amount: $amount,
                    reference: $reference,
                );

                return response()->json([
                    'success' => true,
                    'message' => 'Payment initialized. Redirect to complete payment.',
                    'data' => [
                        'reference' => $result['reference'],
                        'authorization_url' => $result['authorization_url'],
                        'access_code' => $result['access_code'],
                        'provider' => 'paystack',
                    ],
                ], 201);
            }

            // Flutterwave
            $result = $this->flutterwaveService->initializeFunding(
                email: $user->email,
                amount: $amount,
                reference: $reference,
                customerName: $user->name,
                customerPhone: $user->phone ?? '',
            );

            return response()->json([
                'success' => true,
                'message' => 'Payment initialized. Redirect to complete payment.',
                'data' => [
                    'reference' => $result['tx_ref'],
                    'authorization_url' => $result['link'],
                    'provider' => 'flutterwave',
                ],
            ], 201);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    // ── Verify Payment ───────────────────────────────────────

    /**
     * Verify a wallet funding payment and credit the wallet.
     *
     * POST /wallet/verify-payment
     */
    public function verifyPayment(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'reference' => ['required', 'string'],
            'provider' => ['required', 'string', 'in:paystack,flutterwave'],
        ]);

        $wallet = $this->walletService->getOrCreateWallet($user);

        // Idempotency: check if this reference has already been processed
        $alreadyProcessed = \App\Models\WalletTransaction::where('reference', $validated['reference'])
            ->where('wallet_id', $wallet->id)
            ->exists();
        if ($alreadyProcessed) {
            return response()->json([
                'success' => false,
                'message' => 'This payment has already been credited.',
                'code' => 'duplicate_reference',
            ], 422);
        }

        try {
            if ($validated['provider'] === 'paystack') {
                $txn = $this->paystackService->verifyTransaction($validated['reference']);

                if (($txn['status'] ?? '') !== 'success') {
                    return response()->json([
                        'success' => false,
                        'message' => 'Payment not successful.',
                    ], 422);
                }

                $amount = (float) ($txn['amount'] / 100); // Convert from kobo
                $this->walletService->fund(
                    $wallet,
                    $amount,
                    "Wallet funding via Paystack ({$validated['reference']})"
                );

                return response()->json([
                    'success' => true,
                    'message' => 'Wallet funded successfully.',
                    'data' => [
                        'amount' => $amount,
                        'reference' => $validated['reference'],
                        'balance_after' => $wallet->fresh()->balance,
                    ],
                ]);
            }

            // Flutterwave
            $txn = $this->flutterwaveService->verifyTransaction($validated['reference']);

            if (($txn['status'] ?? '') !== 'successful') {
                return response()->json([
                    'success' => false,
                    'message' => 'Payment not successful.',
                ], 422);
            }

            $amount = (float) $txn['amount'];
            $this->walletService->fund(
                $wallet,
                $amount,
                "Wallet funding via Flutterwave ({$validated['reference']})"
            );

            return response()->json([
                'success' => true,
                'message' => 'Wallet funded successfully.',
                'data' => [
                    'amount' => $amount,
                    'reference' => $validated['reference'],
                    'balance_after' => $wallet->fresh()->balance,
                ],
            ]);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    // ── Withdrawal ───────────────────────────────────────────

    /**
     * Withdraw funds to bank account via Paystack or Flutterwave.
     *
     * POST /wallet/withdraw
     */
    public function withdraw(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // Guard: cannot withdraw funds that are still in escrow
        $activeEscrow = \App\Models\Bid::where('errander_id', $user->id)
            ->whereHas('request', fn ($q) => $q->whereIn('status', [
                \App\Enums\RequestStatus::EscrowHold->value,
                \App\Enums\RequestStatus::DisputeWindow->value,
            ]))
            ->exists();

        if ($activeEscrow) {
            return response()->json([
                'success' => false,
                'message' => 'You have funds in escrow. They will be available after the dispute window closes or an administrator releases them.',
                'code' => 'escrow_active',
            ], 422);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1000', 'max:1000000'],
            'bank_code' => ['required', 'string', 'max:10'],
            'account_number' => ['required', 'string', 'size:10'],
            'account_name' => ['required', 'string', 'max:200'],
            'provider' => ['nullable', 'string', 'in:paystack,flutterwave'],
            'narration' => ['nullable', 'string', 'max:255'],
        ]);

        $wallet = $this->walletService->getOrCreateWallet($user);
        $provider = $validated['provider'] ?? 'paystack';

        try {
            // Debit the wallet
            $result = $this->walletService->withdraw(
                $wallet,
                (float) $validated['amount'],
                $validated,
            );

            // Initiate transfer via payment gateway
            $transferRef = 'TRF-' . Str::upper(Str::random(12));

            if ($provider === 'flutterwave') {
                $this->flutterwaveService->initiateTransfer(
                    accountBank: $validated['bank_code'],
                    accountNumber: $validated['account_number'],
                    amount: (float) $result['withdrawal']->net_amount,
                    narration: $validated['narration'] ?? 'Errand Boy earnings withdrawal',
                    reference: $transferRef,
                );
            } else {
                // Paystack: create recipient + initiate transfer
                $recipientCode = $this->paystackService->createTransferRecipient(
                    name: $validated['account_name'],
                    accountNumber: $validated['account_number'],
                    bankCode: $validated['bank_code'],
                );

                $this->paystackService->initiateTransfer(
                    recipientCode: $recipientCode,
                    amount: (float) $result['withdrawal']->net_amount,
                    reason: $validated['narration'] ?? 'Errand Boy earnings withdrawal',
                    reference: $transferRef,
                );
            }

            // Update withdrawal with gateway reference
            $result['withdrawal']->update([
                'gateway_reference' => $transferRef,
                'gateway' => $provider,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal initiated. Funds will arrive within 24 hours.',
                'data' => [
                    'withdrawal_id' => $result['withdrawal']->id,
                    'amount' => $result['withdrawal']->amount,
                    'fee' => $result['withdrawal']->fee,
                    'net_amount' => $result['withdrawal']->net_amount,
                    'reference' => $transferRef,
                    'provider' => $provider,
                ],
            ], 201);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    // ── Transaction History ──────────────────────────────────

    /**
     * Get wallet transaction history.
     *
     * GET /wallet/transactions
     */
    public function transactions(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $wallet = $this->walletService->getOrCreateWallet($user);

        $query = $wallet->transactions();

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        $transactions = $query->orderBy('created_at', 'desc')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $transactions->map(fn ($t) => [
                'id' => $t->id,
                'type' => $t->type,
                'amount' => $t->amount,
                'balance_before' => $t->balance_before,
                'balance_after' => $t->balance_after,
                'reference' => $t->reference,
                'description' => $t->description,
                'status' => $t->status,
                'created_at' => $t->created_at->toISOString(),
            ]),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }
}
