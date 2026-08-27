<?php

declare(strict_types=1);

namespace App\Services\Providers;

use App\Models\Payment;
use App\Models\User;
use App\Models\WalletFunding;
use App\Services\FlutterwaveService;
use App\Services\PaymentGatewayService;
use App\Services\PaymentProviderInterface;
use App\Services\WalletFundingService;
use Illuminate\Support\Facades\Log;

class FlutterwaveProvider implements PaymentProviderInterface
{
    public function __construct(
        private readonly FlutterwaveService $flutterwave,
    ) {}

    public function initializePayment(User $user, Payment $payment, string $redirectUrl, array $metadata = []): array
    {
        $result = $this->flutterwave->initializeFunding(
            email: $user->email,
            amount: $payment->amount,
            reference: $payment->provider_ref,
            customerName: $user->name,
            customerPhone: $user->phone ?? '',
            redirectUrl: $redirectUrl,
        );

        return [
            'authorization_url' => $result['link'],
            'reference' => $result['tx_ref'],
        ];
    }

    public function verifyPayment(string $reference): array
    {
        $data = $this->flutterwave->verifyTransaction($reference);

        $status = match ($data['status'] ?? '') {
            'successful' => 'successful',
            'failed', 'error' => 'failed',
            'cancelled' => 'cancelled',
            default => 'pending',
        };

        return [
            'status' => $status,
            'amount' => (float) ($data['amount'] ?? 0),
            'reference' => $reference,
        ];
    }

    public function handleWebhook(array $payload): void
    {
        $status = strtolower((string) ($payload['status'] ?? ''));
        $providerRef = $payload['tx_ref'] ?? '';
        $transactionId = $payload['id'] ?? null;

        Log::info('Flutterwave webhook received', [
            'status' => $status,
            'tx_ref' => $providerRef,
            'transaction_id' => $transactionId,
        ]);

        if ($providerRef === '') {
            Log::warning('Flutterwave webhook: missing tx_ref');
            return;
        }

        $payment = Payment::where('provider_ref', $providerRef)->first();

        if ($payment) {
            $this->handlePaymentWebhook($payment, $status, $transactionId, $payload['message'] ?? 'Payment failed.');
            return;
        }

        // Not an errand payment — could be a wallet funding checkout
        $funding = WalletFunding::where('provider_ref', $providerRef)->first();

        if ($funding) {
            $this->handleFundingWebhook($funding, $status, $transactionId);
            return;
        }

        Log::warning('Flutterwave webhook: no payment or funding found', ['tx_ref' => $providerRef]);
    }

    /**
     * Handle a webhook for an errand (bid) payment.
     */
    private function handlePaymentWebhook(Payment $payment, string $status, ?int $transactionId, string $failureReason): void
    {
        if ($payment->isSuccessful()) {
            return; // Idempotent
        }

        $gatewayService = app(PaymentGatewayService::class);

        if ($status === 'successful') {
            // Re-verify with the provider before confirming — don't trust
            // the webhook payload alone.
            $verification = $this->verifyPayment($payment->provider_ref);

            if ($verification['status'] !== 'successful') {
                Log::warning('Flutterwave webhook: payload says successful but provider verification disagrees', [
                    'payment_id' => $payment->id,
                    'verified_status' => $verification['status'],
                ]);
                return;
            }

            if (abs($verification['amount'] - $payment->amount) > 1) {
                Log::warning('Flutterwave webhook: amount mismatch', [
                    'payment_id' => $payment->id,
                    'expected' => $payment->amount,
                    'verified' => $verification['amount'],
                ]);
            }

            $gatewayService->confirmPayment($payment, $transactionId);
            return;
        }

        if ($status === 'cancelled') {
            $gatewayService->handleCancelledPayment($payment);
            return;
        }

        if ($status === 'failed') {
            $gatewayService->handleFailedPayment($payment, $failureReason);
            return;
        }

        // Anything else (e.g. a pre-auth event) — leave the payment pending
        Log::info('Flutterwave webhook: non-terminal status, leaving payment pending', [
            'payment_id' => $payment->id,
            'status' => $status,
        ]);
    }

    /**
     * Handle a webhook for a wallet funding checkout — credit the wallet.
     */
    private function handleFundingWebhook(WalletFunding $funding, string $status, ?int $transactionId): void
    {
        if ($funding->isSuccessful()) {
            return; // Idempotent
        }

        $fundingService = app(WalletFundingService::class);

        if ($status === 'successful') {
            $verification = $this->verifyPayment($funding->provider_ref);

            if ($verification['status'] !== 'successful') {
                Log::warning('Flutterwave funding webhook: provider verification disagrees', [
                    'funding_id' => $funding->id,
                    'verified_status' => $verification['status'],
                ]);
                return;
            }

            $fundingService->confirm($funding, (string) $transactionId, $verification['amount']);
            return;
        }

        if ($status === 'cancelled') {
            $fundingService->cancel($funding);
            return;
        }

        if ($status === 'failed') {
            $fundingService->fail($funding, 'Payment failed.');
            return;
        }

        Log::info('Flutterwave funding webhook: non-terminal status, leaving funding pending', [
            'funding_id' => $funding->id,
            'status' => $status,
        ]);
    }

    public function name(): string
    {
        return 'flutterwave';
    }
}
