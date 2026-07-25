<?php

declare(strict_types=1);

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\PaymentProviderResolver;
use Illuminate\Http\JsonResponse;

class PaymentProviderController extends Controller
{
    public function __construct(
        private readonly PaymentProviderResolver $resolver,
    ) {}

    /**
     * List available card payment providers.
     *
     * GET /payments/providers
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'providers' => $this->resolver->availableProviders(),
                'default' => config('payment.default_card_provider', 'flutterwave'),
            ],
        ]);
    }
}
