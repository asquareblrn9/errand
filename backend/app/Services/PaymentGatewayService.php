<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Models\Bid;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * PaymentGatewayService
 *
 * Handles payment initiation through Flutterwave (primary) and
 * Paystack (backup). Also manages webhook processing and
 * payment status reconciliation.
 */
class PaymentGatewayService
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly DeliveryService $deliveryService,
    ) {}

    /**
     * Initiate payment for an accepted bid.
     *
     * @param  string  $method  'wallet' | 'card' | 'bank_transfer'
     * @return array{payment: Payment, payment_url: string|null, provider_ref: string}
     *
     * @throws \InvalidArgumentException
     */
    public function initiate(User $requester, Bid $bid, string $method = 'wallet'): array
    {
        if ($bid->status !== BidStatus::Accepted) {
            throw new \InvalidArgumentException('Payment can only be made for accepted bids.');
        }

        // Prevent double payment
        $existing = Payment::where('bid_id', $bid->id)
            ->where('status', 'successful')
            ->exists();
        if ($existing) {
            throw new \InvalidArgumentException('This bid has already been paid for.');
        }

        $providerRef = $this->generateProviderRef();

        if ($method === 'wallet') {
            return $this->processWalletPayment($requester, $bid, $providerRef);
        }

        return $this->processGatewayPayment($requester, $bid, $method, $providerRef);
    }

    /**
     * Handle Flutterwave webhook callback.
     */
    public function handleFlutterwaveWebhook(array $payload): void
    {
        $status = $payload['status'] ?? '';
        $providerRef = $payload['tx_ref'] ?? '';
        $transactionId = $payload['id'] ?? null;

        Log::info('Flutterwave webhook received', [
            'status' => $status,
            'tx_ref' => $providerRef,
            'transaction_id' => $transactionId,
        ]);

        $payment = Payment::where('provider_ref', $providerRef)->first();
        if (! $payment) {
            Log::warning('Flutterwave webhook: payment not found', ['tx_ref' => $providerRef]);
            return;
        }

        if ($payment->isSuccessful()) {
            return; // Idempotent — already processed
        }

        if ($status === 'successful') {
            $this->confirmPayment($payment, $transactionId);
        } else {
            $payment->update([
                'status' => 'failed',
                'failed_at' => now(),
                'failure_reason' => $payload['tx_ref'] ?? 'Payment failed',
            ]);
        }
    }

    /**
     * Handle Paystack webhook callback.
     */
    public function handlePaystackWebhook(array $payload): void
    {
        $event = $payload['event'] ?? '';
        $data = $payload['data'] ?? [];
        $providerRef = $data['reference'] ?? '';

        Log::info('Paystack webhook received', [
            'event' => $event,
            'reference' => $providerRef,
        ]);

        $payment = Payment::where('provider_ref', $providerRef)->first();
        if (! $payment || $payment->isSuccessful()) {
            return;
        }

        if ($event === 'charge.success') {
            $this->confirmPayment($payment, $data['id'] ?? null);
        } else {
            $payment->update([
                'status' => 'failed',
                'failed_at' => now(),
                'failure_reason' => $data['gateway_response'] ?? 'Payment failed',
            ]);
        }
    }

    /**
     * Confirm a payment — update status and transition request to in_progress.
     */
    private function confirmPayment(Payment $payment, mixed $providerTransactionId = null): void
    {
        DB::transaction(function () use ($payment, $providerTransactionId): void {
            $payment->update([
                'status' => 'successful',
                'paid_at' => now(),
                'metadata' => array_merge($payment->metadata ?? [], [
                    'provider_transaction_id' => $providerTransactionId,
                ]),
            ]);

            // Transition request: assigned → in_progress
            $request = $payment->bid->request;
            if ($request && $request->status === RequestStatus::Assigned) {
                $request->transitionTo(RequestStatus::InProgress);

                // Start delivery
                $this->deliveryService->startDelivery($payment->bid);
            }

            Log::info('Payment confirmed', [
                'payment_id' => $payment->id,
                'bid_id' => $payment->bid_id,
                'request_id' => $payment->request_id,
            ]);
        });
    }

    /**
     * Process payment directly from wallet balance.
     */
    private function processWalletPayment(User $requester, Bid $bid, string $providerRef): array
    {
        return DB::transaction(function () use ($requester, $bid, $providerRef): array {
            $wallet = $this->walletService->getOrCreateWallet($requester);
            $amount = $bid->total_amount;

            // Lock funds + debit
            $this->walletService->lock($wallet, $amount, $providerRef);
            $wallet->update(['balance' => $wallet->balance - $amount]);

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

            // Auto-confirm wallet payments
            $request = $bid->request;
            if ($request && $request->status === RequestStatus::Assigned) {
                $request->transitionTo(RequestStatus::InProgress);
            }

            return [
                'payment' => $payment,
                'payment_url' => null,
                'provider_ref' => $providerRef,
            ];
        });
    }

    /**
     * Process payment through external gateway (Flutterwave or Paystack).
     */
    private function processGatewayPayment(User $requester, Bid $bid, string $method, string $providerRef): array
    {
        $payment = Payment::create([
            'bid_id' => $bid->id,
            'request_id' => $bid->request_id,
            'user_id' => $requester->id,
            'provider' => 'flutterwave', // Primary
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

        // Generate checkout URL using the configured gateway base URL
        $flutterwaveBase = config('services.flutterwave.base_url', 'https://api.flutterwave.com/v3');
        $checkoutUrl = "{$flutterwaveBase}/hosted/pay/{$providerRef}";

        return [
            'payment' => $payment,
            'payment_url' => $checkoutUrl,
            'provider_ref' => $providerRef,
        ];
    }

    private function generateProviderRef(): string
    {
        return 'EB-' . Str::upper(Str::random(10));
    }
}
