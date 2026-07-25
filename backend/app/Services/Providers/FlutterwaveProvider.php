<?php

declare(strict_types=1);

namespace App\Services\Providers;

use App\Models\Payment;
use App\Models\User;
use App\Services\FlutterwaveService;
use App\Services\PaymentProviderInterface;
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
            'failed' => 'failed',
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
            return; // Idempotent
        }

        if ($status === 'successful') {
            $payment->update([
                'status' => 'successful',
                'paid_at' => now(),
                'metadata' => array_merge($payment->metadata ?? [], [
                    'provider_transaction_id' => $transactionId,
                ]),
            ]);

            app(\App\Services\PaymentGatewayService::class)->confirmPayment($payment);
        } else {
            $payment->update([
                'status' => 'failed',
                'failed_at' => now(),
                'failure_reason' => $payload['tx_ref'] ?? 'Payment failed',
            ]);
        }
    }

    public function name(): string
    {
        return 'flutterwave';
    }
}
