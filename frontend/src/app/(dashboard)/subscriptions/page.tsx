"use client";

import { useState } from "react";
import { Check, Loader2, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsSkeleton } from "@/components/shared/SkeletonLoader";
import { usePlans, useMySubscription, useSubscribeMutation, useCancelSubscriptionMutation } from "@/hooks/queries/subscriptions/use-subscriptions";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import type { Plan, SubscriptionData } from "@/types/api/subscriptions";

export default function SubscriptionsPage() {
  const { data: plans = [], isLoading } = usePlans();
  const { data: mySub } = useMySubscription();
  const subscribeMutation = useSubscribeMutation();
  const cancelMutation = useCancelSubscriptionMutation();

  const handleSubscribe = async (planId: string) => {
    try {
      await subscribeMutation.mutateAsync({ plan_id: planId });
      toast.success("Subscribed", "Your subscription is now active.");
    } catch (err) {
      handleApiError(err, "Subscription failed.");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      toast.success("Cancelled", "Auto-renewal has been turned off.");
    } catch (err) {
      handleApiError(err, "Failed to cancel.");
    }
  };

  if (isLoading) return <StatsSkeleton cards={3} />;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Subscription Plans</h1>
        <p className="text-base text-muted-foreground mt-1">
          Choose the right plan for your needs
        </p>
        {mySub && (
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="success">{mySub.plan.name}</Badge>
            <span className="text-sm text-muted-foreground">
              • {mySub.billing_cycle} • Expires{" "}
              {new Date(mySub.expires_at).toLocaleDateString()}
              {mySub.auto_renew ? " • Auto-renewing" : " • Not renewing"}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan: Plan) => {
          const isCurrent = mySub?.plan.slug === plan.slug;
          return (
            <Card
              key={plan.id}
              className={
                isCurrent ? "border-primary ring-2 ring-primary/20" : ""
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg font-semibold">
                  {plan.name}
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">
                    ₦{plan.monthly_price.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                {plan.annual_price > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ₦{plan.annual_price.toLocaleString()}/yr (20% off)
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2.5">
                {plan.features.map((f: string) => (
                  <div key={f} className="flex items-center gap-2.5 text-sm">
                    <div className="w-4 h-4 rounded-full bg-[#10B981]/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-[#10B981]" />
                    </div>
                    <span>{f}</span>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCancel}
                    disabled={!mySub?.auto_renew || cancelMutation.isPending}
                  >
                    Cancel Auto-Renewal
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={
                      subscribeMutation.isPending || plan.monthly_price === 0
                    }
                  >
                    {subscribeMutation.isPending && plan.id === subscribeMutation.variables?.plan_id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {plan.monthly_price === 0 ? "Current Plan" : "Subscribe"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
