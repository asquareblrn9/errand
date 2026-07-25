<?php

declare(strict_types=1);

namespace App\Services;

use App\Services\Providers\FlutterwaveProvider;
use App\Services\Providers\PaystackProvider;

/**
 * Resolves a provider slug to its implementation.
 */
class PaymentProviderResolver
{
    /**
     * Get the provider instance for the given slug.
     */
    public function resolve(string $provider): PaymentProviderInterface
    {
        return match ($provider) {
            'flutterwave' => app(FlutterwaveProvider::class),
            'paystack' => app(PaystackProvider::class),
            default => throw new \InvalidArgumentException("Unknown payment provider: {$provider}"),
        };
    }

    /**
     * List slugs of all available card payment providers.
     *
     * @return array<int, string>
     */
    public function availableProviders(): array
    {
        return config('payment.card_providers', ['flutterwave', 'paystack']);
    }
}
