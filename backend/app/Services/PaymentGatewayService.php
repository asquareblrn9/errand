<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Models\Bid;
use App\Models\EscrowTransaction;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * PaymentGatewayService
 *
 * Handles payment initiation for accepted bids via wallet or card providers.
 * Card providers are resolved dynamically via PaymentProviderResolver.
 */
class PaymentGatewayService
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly DeliveryService $deliveryService,
        private readonly PaymentProviderResolver $providerResolver,
    ) {}

    /**
     * Initiate payment for an accepted bid.
     *
     * @param  string  $method   'wallet' | 'card'
     * @param  string|null  $provider  Provider slug for card payments (e.g. 'paystack')
     * @return array{payment: Payment, payment_url: string|null, provider_ref: string}
     *
     * @throws \InvalidArgumentException
     */
    public function initiate(User $requester, Bid $bid, string $method = 'wallet', ?string $provider = null, ?string $platform = null, ?string $returnScheme = null): array
    {
        if ($bid->status !== BidStatus::Accepted) {
            throw new \InvalidArgumentException('Payment can only be made for accepted bids.');
        }

        // Prevent double payment — check for any existing non-failed payment
        $existing = Payment::where('bid_id', $bid->id)
            ->whereIn('status', ['successful', 'pending'])
            ->exists();
        if ($existing) {
            throw new \InvalidArgumentException(
                $existing && Payment::where('bid_id', $bid->id)->where('status', 'successful')->exists()
                    ? 'This bid has already been paid for.'
                    : 'A payment is already in progress for this bid. Please wait or verify the existing payment.'
            );
        }

        $providerRef = $this->generateProviderRef();

        if ($method === 'wallet') {
            return $this->processWalletPayment($requester, $bid, $providerRef);
        }

        return $this->processGatewayPayment($requester, $bid, $method, $provider, $providerRef, $platform, $returnScheme);
    }

    /**
     * Confirm a payment and transition bid to PAYMENT_MADE.
     * Public so provider webhook handlers can call it.
     */
    public function confirmPayment(Payment $payment, mixed $providerTransactionId = null): void
    {
        DB::transaction(function () use ($payment, $providerTransactionId): void {
            $payment->update([
                'status' => 'successful',
                'paid_at' => now(),
                'metadata' => array_merge($payment->metadata ?? [], [
                    'provider_transaction_id' => $providerTransactionId,
                ]),
            ]);

            $bid = $payment->bid;
            $bid->update(['status' => BidStatus::PaymentMade]);

            // Record escrow
            EscrowTransaction::create([
                'bid_id' => $bid->id,
                'request_id' => $bid->request_id,
                'requester_id' => $payment->user_id,
                'errander_id' => $bid->errander_id,
                'amount' => $payment->amount,
                'breakdown' => $payment->breakdown,
                'status' => 'held',
                'held_at' => now(),
            ]);

            // Transition request: assigned → in_progress via state machine
            $request = $bid->request;
            if ($request && $request->status === RequestStatus::Assigned) {
                app(ErrandStateMachine::class)->transition(
                    $request,
                    RequestStatus::InProgress,
                    ['bid' => $bid, 'payment' => $payment],
                );
            }

            // Notify errander
            if ($bid->errander) {
                \App\Models\AuditLog::log(
                    action: 'payment.received',
                    actor: $bid->errander,
                    model: $payment,
                    metadata: [
                        'request_title' => $request?->title,
                        'amount' => $payment->amount,
                    ]
                );

                app(FcmService::class)->notifyUser(
                    userId: $bid->errander_id,
                    title: 'Payment Received 💰',
                    body: "Payment of ₦{$payment->amount} received for \"{$request?->title}\". You can now start the errand.",
                    data: ['type' => 'payment_received', 'bid_id' => $bid->id, 'request_id' => $bid->request_id],
                );

                // Queue email notification
                \Illuminate\Support\Facades\Mail::to($bid->errander)->queue(
                    new \App\Mail\PaymentReceivedMail(
                        user: $bid->errander,
                        requestTitle: $request?->title ?? 'your request',
                        amount: number_format($payment->amount),
                        requestId: $bid->request_id,
                    )
                );
            }

            Log::info('Payment confirmed', [
                'payment_id' => $payment->id,
                'bid_id' => $payment->bid_id,
                'request_id' => $payment->request_id,
            ]);
        });
    }

    /**
     * Handle a failed payment — unlock escrow if wallet, keep bid as accepted.
     */
    public function handleFailedPayment(Payment $payment, string $reason): void
    {
        DB::transaction(function () use ($payment, $reason): void {
            $payment->update([
                'status' => 'failed',
                'failed_at' => now(),
                'failure_reason' => $reason,
            ]);

            // Refund wallet lock if applicable
            if ($payment->payment_method === 'wallet') {
                $wallet = $this->walletService->getOrCreateWallet($payment->user);
                $this->walletService->unlock($wallet, $payment->amount, $payment->provider_ref);
            }

            Log::info('Payment failed', [
                'payment_id' => $payment->id,
                'reason' => $reason,
            ]);
        });
    }

    /**
     * Retry verification of a pending card payment.
     */
    public function retryCardVerification(Payment $payment): array
    {
        $payment->increment('retry_count');

        $provider = $this->providerResolver->resolve($payment->provider);

        return $provider->verifyPayment($payment->provider_ref);
    }

    // ── Webhook dispatchers ───────────────────────────────────

    /**
     * Handle Flutterwave webhook (delegates to provider).
     */
    public function handleFlutterwaveWebhook(array $payload): void
    {
        $this->providerResolver->resolve('flutterwave')->handleWebhook($payload);
    }

    /**
     * Handle Paystack webhook (delegates to provider).
     */
    public function handlePaystackWebhook(array $payload): void
    {
        $this->providerResolver->resolve('paystack')->handleWebhook($payload);
    }

    // ── Private helpers ───────────────────────────────────────

    /**
     * Process payment directly from wallet balance.
     */
    private function processWalletPayment(User $requester, Bid $bid, string $providerRef): array
    {
        return DB::transaction(function () use ($requester, $bid, $providerRef): array {
            $wallet = $this->walletService->getOrCreateWallet($requester);
            $amount = $bid->total_amount;

            // Check sufficient available balance
            if ($wallet->available_balance < $amount) {
                throw new \InvalidArgumentException(
                    "Insufficient wallet balance. Available: ₦{$wallet->available_balance}, Required: ₦{$amount}"
                );
            }

            // Lock funds in escrow (moves from available → locked)
            $this->walletService->lock($wallet, $amount, $providerRef);

            // Create payment record (wallet = instantly confirmed)
            $payment = Payment::create([
                'bid_id' => $bid->id,
                'request_id' => $bid->request_id,
                'user_id' => $requester->id,
                'provider' => 'wallet',
                'provider_ref' => $providerRef,
                'amount' => $amount,
                'breakdown' => [
                    'goods_amount' => $bid->goods_amount,
                    'service_fee' => $bid->service_fee,
                    'platform_fee' => $bid->platform_fee,
                ],
                'currency' => 'NGN',
                'status' => 'successful',
                'payment_method' => 'wallet',
                'paid_at' => now(),
            ]);

            // Transition bid + record escrow + notify errander
            $bid->update(['status' => BidStatus::PaymentMade]);

            EscrowTransaction::create([
                'bid_id' => $bid->id,
                'request_id' => $bid->request_id,
                'requester_id' => $requester->id,
                'errander_id' => $bid->errander_id,
                'amount' => $amount,
                'breakdown' => $payment->breakdown,
                'status' => 'held',
                'held_at' => now(),
            ]);

            // Transition request via state machine
            $request = $bid->request;
            if ($request && $request->status === RequestStatus::Assigned) {
                app(ErrandStateMachine::class)->transition(
                    $request,
                    RequestStatus::InProgress,
                    ['bid' => $bid, 'payment' => $payment],
                );
            }

            // Notify errander
            if ($bid->errander) {
                \App\Models\AuditLog::log(
                    action: 'payment.received',
                    actor: $bid->errander,
                    model: $payment,
                    metadata: ['request_title' => $request?->title, 'amount' => $amount]
                );

                app(FcmService::class)->notifyUser(
                    userId: $bid->errander_id,
                    title: 'Payment Received 💰',
                    body: "Payment of ₦{$amount} received for \"{$request?->title}\". You can now start the errand.",
                    data: ['type' => 'payment_received', 'bid_id' => $bid->id, 'request_id' => $bid->request_id],
                );

                // Queue email notification
                \Illuminate\Support\Facades\Mail::to($bid->errander)->queue(
                    new \App\Mail\PaymentReceivedMail(
                        user: $bid->errander,
                        requestTitle: $request?->title ?? 'your request',
                        amount: number_format($amount),
                        requestId: $bid->request_id,
                    )
                );
            }

            return [
                'payment' => $payment,
                'payment_url' => null,
                'provider_ref' => $providerRef,
                'wallet_balance' => $wallet->fresh()->available_balance,
            ];
        });
    }

    /**
     * Process payment through external gateway (config-driven provider).
     */
    private function processGatewayPayment(User $requester, Bid $bid, string $method, ?string $providerSlug, string $providerRef, ?string $platform = null, ?string $returnScheme = null): array
    {
        $providerSlug = $providerSlug ?: config('payment.default_card_provider', 'flutterwave');

        $provider = $this->providerResolver->resolve($providerSlug);

        $payment = Payment::create([
            'bid_id' => $bid->id,
            'request_id' => $bid->request_id,
            'user_id' => $requester->id,
            'provider' => $provider->name(),
            'provider_ref' => $providerRef,
            'amount' => $bid->total_amount,
            'breakdown' => [
                'goods_amount' => $bid->goods_amount,
                'service_fee' => $bid->service_fee,
                'platform_fee' => $bid->platform_fee,
            ],
            'currency' => 'NGN',
            'status' => 'pending',
            'payment_method' => $method,
        ]);

        // Platform-aware redirect URL
        $redirectUrl = $this->buildRedirectUrl($bid->request_id, $providerRef, $platform, $returnScheme);

        $result = $provider->initializePayment($requester, $payment, $redirectUrl);

        return [
            'payment' => $payment,
            'payment_url' => $result['authorization_url'],
            'provider_ref' => $providerRef,
        ];
    }

    /**
     * Build a platform-aware redirect URL for payment providers.
     */
    private function buildRedirectUrl(string $requestId, string $providerRef, ?string $platform = null, ?string $returnScheme = null): string
    {
        return config('app.url') . "/api/v1/payments/complete/{$providerRef}";
    }

    private function generateProviderRef(): string
    {
        return 'EB-' . Str::upper(Str::random(10));
    }
}
