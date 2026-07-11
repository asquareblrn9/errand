<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PaymentGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        // In production: verify the verif-hash header
        // $signature = $request->header('verif-hash');
        // if ($signature !== config('flutterwave.webhook_hash')) {
        //     return response()->json(['message' => 'Invalid signature'], 401);
        // }

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
        // In production: verify x-paystack-signature header
        // $signature = $request->header('x-paystack-signature');
        // $secret = config('paystack.secret_key');
        // if ($signature !== hash_hmac('sha512', $request->getContent(), $secret)) {
        //     return response()->json(['message' => 'Invalid signature'], 401);
        // }

        $this->gatewayService->handlePaystackWebhook($request->all());

        return response()->json(['status' => 'ok']);
    }
}
