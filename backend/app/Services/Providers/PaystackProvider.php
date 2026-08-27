<?php

declare(strict_types=1);

namespace App\Services\Providers;

use App\Models\Payment;
use App\Models\User;
use App\Models\WalletFunding;
use App\Services\PaymentGatewayService;
use App\Services\PaymentProviderInterface;
use App\Services\PaystackService;
use App\Services\WalletFundingService;
use Illuminate\Support\Facades\Log;

class PaystackProvider implements PaymentProviderInterface
{
    public function __construct(
        private readonly PaystackService $paystack,
    ) {}

    public function initializePayment(User $user, Payment $payment, string $redirectUrl, array $metadata = []): array
    {
        $result = $this->paystack->initializeFunding(
            email: $user->email,
            amount: $payment->amount,
            reference: $payment->provider_ref,
            redirectUrl: $redirectUrl,
        );

        return [
            'authorization_url' => $result['authorization_url'],
            'reference' => $result['reference'],
        ];
    }

    public function verifyPayment(string $reference): array
    {
        $data = $this->paystack->verifyTransaction($reference);

        $status = match ($data['status'] ?? '') {
            'success' => 'successful',
            'abandoned' => 'cancelled',
            'failed' => 'failed',
            default => 'pending',
        };

        return [
            'status' => $status,
            'amount' => (float) ($data['amount'] ?? 0) / 100, // Paystack returns kobo
            'reference' => $reference,
        ];
    }

    public function handleWebhook(array $payload): void
    {
        $event = $payload['event'] ?? '';
        $data = $payload['data'] ?? [];
        $providerRef = $data['reference'] ?? '';

        Log::info('Paystack webhook received', [
            'event' => $event,
            'reference' => $providerRef,
        ]);

        if ($providerRef === '') {
            Log::warning('Paystack webhook: missing reference');
            return;
        }

        $payment = Payment::where('provider_ref', $providerRef)->first();

        if ($payment) {
            $this->handlePaymentWebhook($payment, $event, $data);
            return;
        }

        // Not an errand payment — could be a wallet funding checkout
        $funding = WalletFunding::where('provider_ref', $providerRef)->first();

        if ($funding) {
            $this->handleFundingWebhook($funding, $event, $data);
            return;
        }

        Log::warning('Paystack webhook: no payment or funding found', ['reference' => $providerRef]);
    }

    /**
     * Handle a webhook for an errand (bid) payment.
     */
    private function handlePaymentWebhook(Payment $payment, string $event, array $data): void
    {
        if ($payment->isSuccessful()) {
            return; // Idempotent
        }

        $gatewayService = app(PaymentGatewayService::class);

        if ($event === 'charge.success') {
            // Re-verify with the provider before confirming — don't trust
            // the webhook payload alone.
            $verification = $this->verifyPayment($payment->provider_ref);

            if ($verification['status'] !== 'successful') {
                Log::warning('Paystack webhook: payload says success but provider verification disagrees', [
                    'payment_id' => $payment->id,
                    'verified_status' => $verification['status'],
                ]);
                return;
            }

            if (abs($verification['amount'] - $payment->amount) > 1) {
                Log::warning('Paystack webhook: amount mismatch', [
                    'payment_id' => $payment->id,
                    'expected' => $payment->amount,
                    'verified' => $verification['amount'],
                ]);
            }

            $gatewayService->confirmPayment($payment, $data['id'] ?? null);
            return;
        }

        if ($event === 'charge.failed') {
            $gatewayService->handleFailedPayment($payment, $data['gateway_response'] ?? 'Payment failed.');
            return;
        }

        // Other events (charge.pending, transfer.*, etc.) — leave payment pending
        Log::info('Paystack webhook: non-terminal event, leaving payment pending', [
            'payment_id' => $payment->id,
            'event' => $event,
        ]);
    }

    /**
     * Handle a webhook for a wallet funding checkout — credit the wallet.
     */
    private function handleFundingWebhook(WalletFunding $funding, string $event, array $data): void
    {
        if ($funding->isSuccessful()) {
            return; // Idempotent
        }

        $fundingService = app(WalletFundingService::class);

        if ($event === 'charge.success') {
            $verification = $this->verifyPayment($funding->provider_ref);

            if ($verification['status'] !== 'successful') {
                Log::warning('Paystack funding webhook: provider verification disagrees', [
                    'funding_id' => $funding->id,
                    'verified_status' => $verification['status'],
                ]);
                return;
            }

            $fundingService->confirm($funding, $data['id'] ?? null, $verification['amount']);
            return;
        }

        if ($event === 'charge.failed') {
            $fundingService->fail($funding, $data['gateway_response'] ?? 'Payment failed.');
            return;
        }

        Log::info('Paystack funding webhook: non-terminal event, leaving funding pending', [
            'funding_id' => $funding->id,
            'event' => $event,
        ]);
    }

    public function name(): string
    {
        return 'paystack';
    }
}
