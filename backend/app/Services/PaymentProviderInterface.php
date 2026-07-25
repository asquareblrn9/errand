<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Payment;
use App\Models\User;

/**
 * Contract that every card payment provider must implement.
 */
interface PaymentProviderInterface
{
    /**
     * Initialize a payment transaction with the provider.
     *
     * @param  string  $redirectUrl  Where the provider should redirect after payment
     * @return array{authorization_url: string, reference: string}
     */
    public function initializePayment(User $user, Payment $payment, string $redirectUrl, array $metadata = []): array;

    /**
     * Verify the status of a previously initiated payment.
     *
     * @return array{status: string, amount: float, reference: string}
     */
    public function verifyPayment(string $reference): array;

    /**
     * Handle an incoming webhook notification from the provider.
     */
    public function handleWebhook(array $payload): void;

    /**
     * The provider's machine-readable slug (matches config/payment.php keys).
     */
    public function name(): string;
}
