<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;

class SubscriptionService
{
    /**
     * Subscribe a user to a plan.
     */
    public function subscribe(User $user, Plan $plan, string $billingCycle = 'monthly'): Subscription
    {
        // Cancel any existing active subscription
        Subscription::where('user_id', $user->id)
            ->where('status', 'active')
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $duration = $billingCycle === 'annual' ? 365 : 30;

        return Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'billing_cycle' => $billingCycle,
            'started_at' => now(),
            'expires_at' => now()->addDays($duration),
            'auto_renew' => true,
            'payment_provider' => 'flutterwave',
        ]);
    }

    /**
     * Cancel auto-renewal for a subscription.
     */
    public function cancel(Subscription $subscription): void
    {
        $subscription->update([
            'auto_renew' => false,
            'cancelled_at' => now(),
        ]);
    }

    /**
     * Check if a user has an active subscription with a specific feature.
     */
    public function hasFeature(User $user, string $feature): bool
    {
        $sub = Subscription::active()->where('user_id', $user->id)->first();
        if (! $sub) return false;

        $features = $sub->plan->features ?? [];
        return in_array($feature, $features, true);
    }

    /**
     * Get the user's current active subscription.
     */
    public function currentSubscription(User $user): ?Subscription
    {
        return Subscription::active()
            ->where('user_id', $user->id)
            ->with('plan')
            ->first();
    }
}
