<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\User;
use App\Models\WalletFunding;
use App\Services\FlutterwaveService;
use App\Services\PaystackService;
use App\Services\WalletFundingService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly PaystackService $paystackService,
        private readonly FlutterwaveService $flutterwaveService,
        private readonly WalletFundingService $fundingService,
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
     * A WalletFunding record is created before the provider checkout is
     * initialized so webhooks and client verification can credit the
     * wallet server-side.
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
        $provider = $validated['payment_gateway'];
        $reference = 'FUND-' . Str::upper(Str::random(12));

        $funding = WalletFunding::create([
            'user_id' => $user->id,
            'provider' => $provider,
            'provider_ref' => $reference,
            'amount' => $amount,
            'currency' => 'NGN',
            'status' => 'pending',
        ]);

        try {
            if ($provider === 'paystack') {
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
            $this->fundingService->fail($funding, $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    // ── Verify Payment ───────────────────────────────────────

    /**
     * Verify a wallet funding payment and credit the wallet exactly once.
     *
     * Re-verifies with the provider; the WalletFunding status transition
     * (pending → successful) guarantees the wallet is credited only once,
     * whether this endpoint or the provider webhook gets there first.
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

        $funding = WalletFunding::where('provider_ref', $validated['reference'])->first();

        if (! $funding) {
            return response()->json([
                'success' => false,
                'message' => 'Payment not found.',
            ], 404);
        }

        if ($funding->user_id !== $user->id && ! $user->role->isStaff()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 403);
        }

        // Already credited (by us, a webhook, or a concurrent request)
        if ($funding->isSuccessful()) {
            return response()->json([
                'success' => true,
                'message' => 'Wallet already funded.',
                'data' => [
                    'already_verified' => true,
                    'reference' => $funding->provider_ref,
                    'balance_after' => $this->walletService->getOrCreateWallet($user)->fresh()->balance,
                ],
            ]);
        }

        if ($funding->status === 'failed' || $funding->status === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' => $funding->status === 'cancelled'
                    ? 'Payment was cancelled.'
                    : 'Payment not successful.',
                'code' => $funding->status === 'cancelled' ? 'payment_cancelled' : 'payment_failed',
                'failure_reason' => $funding->failure_reason,
            ], 422);
        }

        try {
            $txn = $validated['provider'] === 'paystack'
                ? $this->paystackService->verifyTransaction($validated['reference'])
                : $this->flutterwaveService->verifyTransaction($validated['reference']);

            $providerStatus = strtolower((string) ($txn['status'] ?? ''));

            if ($validated['provider'] === 'paystack') {
                $verifiedAmount = (float) ($txn['amount'] / 100); // kobo → naira
                $transactionId = $txn['id'] ?? null;
                $isSuccess = $providerStatus === 'success';
                $isCancelled = $providerStatus === 'abandoned';
            } else {
                $verifiedAmount = (float) ($txn['amount'] ?? 0);
                $transactionId = $txn['id'] ?? null;
                $isSuccess = $providerStatus === 'successful';
                $isCancelled = $providerStatus === 'cancelled';
            }

            if ($isSuccess) {
                if (abs($verifiedAmount - $funding->amount) > 1) {
                    Log::warning('Wallet funding amount mismatch', [
                        'funding_id' => $funding->id,
                        'expected' => $funding->amount,
                        'verified' => $verifiedAmount,
                    ]);
                }

                $credited = $this->fundingService->confirm($funding, (string) $transactionId, $verifiedAmount);

                return response()->json([
                    'success' => true,
                    'message' => $credited ? 'Wallet funded successfully.' : 'Wallet already funded.',
                    'data' => [
                        'already_verified' => ! $credited,
                        'amount' => $verifiedAmount,
                        'reference' => $validated['reference'],
                        'balance_after' => $this->walletService->getOrCreateWallet($user)->fresh()->balance,
                    ],
                ]);
            }

            if ($isCancelled) {
                $this->fundingService->cancel($funding);

                return response()->json([
                    'success' => false,
                    'message' => 'Payment was cancelled.',
                    'code' => 'payment_cancelled',
                ], 422);
            }

            if (in_array($providerStatus, ['failed', 'error'], true)) {
                $this->fundingService->fail($funding, $txn['gateway_response'] ?? 'Payment failed.');

                return response()->json([
                    'success' => false,
                    'message' => 'Payment not successful.',
                    'code' => 'payment_failed',
                    'failure_reason' => $txn['gateway_response'] ?? 'Payment failed.',
                ], 422);
            }

            // Still pending with the provider
            return response()->json([
                'success' => true,
                'data' => ['status' => 'pending'],
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
     * Payouts always go to the user's saved verified bank account —
     * bank details are no longer accepted from the request body.
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

        // Payout destination: the verified bank saved during KYC
        $bank = $this->primaryBankFor($user);
        if (! $bank) {
            return response()->json([
                'success' => false,
                'message' => 'You need a verified bank account to withdraw. Add your bank account first.',
                'code' => 'no_bank_account',
            ], 422);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1000', 'max:1000000'],
            'provider' => ['nullable', 'string', 'in:paystack,flutterwave'],
            'narration' => ['nullable', 'string', 'max:255'],
        ]);

        // Inject the saved bank details for the service + gateway transfers
        $validated['bank_code'] = $bank->bank_code;
        $validated['account_number'] = $bank->account_number;
        $validated['account_name'] = $bank->account_name;

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

    // ── Payout Bank Account ──────────────────────────────────

    /**
     * Get the user's payout bank account and its change-lock state.
     *
     * The bank can only be changed once per calendar month
     * (enforced in KycService::saveBankAccount).
     *
     * GET /wallet/bank-account
     */
    public function bankAccount(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $bank = $this->primaryBankFor($user);

        $locked = $bank !== null
            && $user->bank_changed_at !== null
            && now()->isSameMonth(Carbon::parse($user->bank_changed_at));

        return response()->json([
            'success' => true,
            'data' => [
                'bank_account' => $bank ? [
                    'bank_name' => $bank->bank_name,
                    'bank_code' => $bank->bank_code,
                    'account_number' => $bank->maskedAccountNumber(),
                    'account_name' => $bank->account_name,
                ] : null,
                'change_locked' => $locked,
                'next_change_at' => $locked
                    ? now()->addMonthNoOverflow()->startOfMonth()->toDateString()
                    : null,
            ],
        ]);
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

    /**
     * The user's payout bank: their primary verified account.
     */
    private function primaryBankFor(User $user): ?BankAccount
    {
        return BankAccount::where('user_id', $user->id)
            ->where('is_verified', true)
            ->orderByDesc('is_primary')
            ->orderByDesc('created_at')
            ->first();
    }
}
