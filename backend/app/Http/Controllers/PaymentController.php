<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Bid;
use App\Models\Payment;
use App\Models\User;
use App\Services\PaymentGatewayService;
use App\Services\PaymentProviderResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        private readonly PaymentGatewayService $gatewayService,
        private readonly PaymentProviderResolver $providerResolver,
    ) {}

    /**
     * Initiate payment for an accepted bid.
     *
     * POST /payments/initiate
     */
    public function initiate(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'bid_id' => ['required', 'uuid', 'exists:bids,id'],
            'payment_method' => ['nullable', 'string', 'in:wallet,card,bank_transfer'],
            'provider' => ['nullable', 'string'],
        ]);

        $bid = Bid::with('request')->findOrFail($validated['bid_id']);

        if (! $bid->request->isOwnedBy($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Only the request owner can initiate payment.',
            ], 403);
        }

        // Guard: only accepted bids can be paid for
        if ($bid->status !== \App\Enums\BidStatus::Accepted) {
            return response()->json([
                'success' => false,
                'message' => $bid->status === \App\Enums\BidStatus::PaymentMade
                    ? 'Payment has already been made for this bid.'
                    : 'This bid cannot be paid for in its current status.',
                'code' => 'invalid_bid_status',
            ], 422);
        }

        try {
            $result = $this->gatewayService->initiate(
                $user,
                $bid,
                $validated['payment_method'] ?? 'wallet',
                $validated['provider'] ?? null,
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment initiated.',
            'data' => [
                'payment_id' => $result['payment']->id,
                'provider_ref' => $result['provider_ref'],
                'payment_url' => $result['payment_url'],
                'amount' => $result['payment']->amount,
                'breakdown' => $result['payment']->breakdown,
                'status' => $result['payment']->status,
            ],
        ], 201);
    }

    /**
     * Verify and confirm a card payment by provider reference.
     * Called when the user returns from the provider's payment page.
     *
     * GET /payments/verify/{providerRef}
     */
    public function verifyByRef(Request $request, string $providerRef): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $payment = Payment::where('provider_ref', $providerRef)->first();

        if (! $payment) {
            return response()->json([
                'success' => false,
                'message' => 'Payment not found.',
            ], 404);
        }

        if ($payment->user_id !== $user->id && ! $user->role->isStaff()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 403);
        }

        // Already confirmed
        if ($payment->isSuccessful()) {
            return response()->json([
                'success' => true,
                'message' => 'Payment already confirmed.',
                'data' => ['status' => 'successful'],
            ]);
        }

        // Already failed
        if ($payment->status === 'failed') {
            return response()->json([
                'success' => true,
                'data' => ['status' => 'failed', 'failure_reason' => $payment->failure_reason],
            ]);
        }

        // Verify with the provider
        try {
            $provider = $this->providerResolver->resolve($payment->provider);
            $verification = $provider->verifyPayment($providerRef);

            if ($verification['status'] === 'successful') {
                $this->gatewayService->confirmPayment($payment);
                return response()->json([
                    'success' => true,
                    'message' => 'Payment confirmed.',
                    'data' => ['status' => 'successful'],
                ]);
            }

            if ($verification['status'] === 'failed') {
                $this->gatewayService->handleFailedPayment($payment, 'Provider verification returned failed status.');
                return response()->json([
                    'success' => true,
                    'data' => ['status' => 'failed', 'failure_reason' => 'Payment was not successful.'],
                ]);
            }

            // Still pending
            return response()->json([
                'success' => true,
                'data' => ['status' => 'pending'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Could not verify payment. Please try again.',
            ], 502);
        }
    }

    /**
     * Get payment details.
     *
     * GET /payments/{id}
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $payment = Payment::with('bid')->findOrFail($id);

        // Only the requester who paid or admin can view
        if ($payment->user_id !== $user->id && ! $user->role->isStaff()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $payment->id,
                'bid_id' => $payment->bid_id,
                'provider' => $payment->provider,
                'provider_ref' => $payment->provider_ref,
                'amount' => $payment->amount,
                'breakdown' => $payment->breakdown,
                'status' => $payment->status,
                'payment_method' => $payment->payment_method,
                'paid_at' => $payment->paid_at?->toISOString(),
                'created_at' => $payment->created_at->toISOString(),
            ],
        ]);
    }

    /**
     * List authenticated user's payment history.
     *
     * GET /my/payments
     */
    public function myPayments(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = Payment::where('user_id', $user->id)
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $payments = $query->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $payments->map(fn (Payment $p) => [
                'id' => $p->id,
                'bid_id' => $p->bid_id,
                'provider' => $p->provider,
                'amount' => $p->amount,
                'breakdown' => $p->breakdown,
                'status' => $p->status,
                'paid_at' => $p->paid_at?->toISOString(),
            ]),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
            ],
        ]);
    }
}
