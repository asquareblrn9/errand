<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function __construct(
        private readonly SubscriptionService $subscriptionService,
    ) {}

    /**
     * List available plans (public).
     *
     * GET /plans
     */
    public function index(): JsonResponse
    {
        $plans = Plan::active()->ordered()->get();

        return response()->json([
            'success' => true,
            'data' => $plans->map(fn (Plan $p) => [
                'id' => $p->id, 'name' => $p->name, 'slug' => $p->slug,
                'description' => $p->description,
                'monthly_price' => $p->monthly_price,
                'annual_price' => $p->annual_price,
                'features' => $p->features,
                'limits' => $p->limits,
            ]),
        ]);
    }

    /**
     * Subscribe to a plan.
     *
     * POST /subscriptions
     */
    public function subscribe(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'plan_id' => ['required', 'uuid', 'exists:plans,id'],
            'billing_cycle' => ['nullable', 'string', 'in:monthly,annual'],
        ]);

        $plan = Plan::active()->findOrFail($validated['plan_id']);
        $cycle = $validated['billing_cycle'] ?? 'monthly';

        $subscription = $this->subscriptionService->subscribe($user, $plan, $cycle);

        return response()->json([
            'success' => true,
            'message' => 'Subscribed successfully.',
            'data' => [
                'id' => $subscription->id,
                'plan' => $plan->name,
                'billing_cycle' => $cycle,
                'amount' => $cycle === 'annual' ? $plan->annual_price : $plan->monthly_price,
                'starts_at' => $subscription->started_at->toISOString(),
                'expires_at' => $subscription->expires_at->toISOString(),
            ],
        ], 201);
    }

    /**
     * Get current subscription.
     *
     * GET /my/subscription
     */
    public function current(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $sub = $this->subscriptionService->currentSubscription($user);

        if (! $sub) {
            return response()->json([
                'success' => true,
                'data' => null,
                'message' => 'No active subscription.',
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $sub->id,
                'plan' => ['id' => $sub->plan->id, 'name' => $sub->plan->name, 'slug' => $sub->plan->slug],
                'status' => $sub->status,
                'billing_cycle' => $sub->billing_cycle,
                'started_at' => $sub->started_at->toISOString(),
                'expires_at' => $sub->expires_at->toISOString(),
                'auto_renew' => $sub->auto_renew,
                'features' => $sub->plan->features,
            ],
        ]);
    }

    /**
     * Cancel auto-renewal.
     *
     * POST /subscriptions/cancel
     */
    public function cancel(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $sub = $this->subscriptionService->currentSubscription($user);

        if (! $sub) {
            return response()->json(['success' => false, 'message' => 'No active subscription.'], 422);
        }

        $this->subscriptionService->cancel($sub);

        return response()->json(['success' => true, 'message' => 'Subscription will not auto-renew.']);
    }
}
