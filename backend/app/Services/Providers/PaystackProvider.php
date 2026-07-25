<?php

declare(strict_types=1);

namespace App\Services\Providers;

use App\Models\Payment;
use App\Models\User;
use App\Services\PaymentProviderInterface;
use App\Services\PaystackService;
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
            'failed', 'abandoned' => 'failed',
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

        $payment = Payment::where('provider_ref', $providerRef)->first();

        if (! $payment || $payment->isSuccessful()) {
            return; // Not found or already processed
        }

        if ($event === 'charge.success') {
            $payment->update([
                'status' => 'successful',
                'paid_at' => now(),
                'metadata' => array_merge($payment->metadata ?? [], [
                    'provider_transaction_id' => $data['id'] ?? null,
                ]),
            ]);

            app(\App\Services\PaymentGatewayService::class)->confirmPayment($payment);
        } else {
            $payment->update([
                'status' => 'failed',
                'failed_at' => now(),
                'failure_reason' => $data['gateway_response'] ?? 'Payment failed',
            ]);
        }
    }

    public function name(): string
    {
        return 'paystack';
    }
}
