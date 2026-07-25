<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PaymentGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentWebhookController extends Controller
{
    public function __construct(
        private readonly PaymentGatewayService $gatewayService,
    ) {}

    /**
     * Flutterwave webhook callback.
     *
     * POST /payments/webhook/flutterwave
     *
     * No auth — verified via Flutterwave signature hash header.
     */
    public function flutterwave(Request $request): JsonResponse
    {
        // Verify Flutterwave webhook signature
        $secretHash = config('services.flutterwave.secret_hash');
        if ($secretHash) {
            $signature = $request->header('verif-hash');
            if (! $signature || ! hash_equals($secretHash, $signature)) {
                Log::warning('Flutterwave webhook: invalid signature', ['ip' => $request->ip()]);
                return response()->json(['message' => 'Invalid signature'], 401);
            }
        }

        $this->gatewayService->handleFlutterwaveWebhook($request->all());

        return response()->json(['status' => 'ok']);
    }

    /**
     * Paystack webhook callback.
     *
     * POST /payments/webhook/paystack
     *
     * No auth — verified via Paystack signature header.
     */
    public function paystack(Request $request): JsonResponse
    {
        // Verify Paystack webhook signature (HMAC-SHA512)
        $secretKey = config('services.paystack.secret_key');
        if ($secretKey) {
            $signature = $request->header('x-paystack-signature');
            $expected = hash_hmac('sha512', $request->getContent(), $secretKey);
            if (! $signature || ! hash_equals($expected, $signature)) {
                Log::warning('Paystack webhook: invalid signature', ['ip' => $request->ip()]);
                return response()->json(['message' => 'Invalid signature'], 401);
            }
        }

        $this->gatewayService->handlePaystackWebhook($request->all());

        return response()->json(['status' => 'ok']);
    }
}
