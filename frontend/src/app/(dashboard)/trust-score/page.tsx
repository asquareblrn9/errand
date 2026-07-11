"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Shield,
  CheckCircle2,
  Clock,
  Award,
  Mail,
  Phone,
  Zap,
} from "lucide-react";

/** Compute a trust score percentage from available user metrics. */
function computeTrustScore(user: {
  kyc_tier: number;
  email_verified: boolean;
  phone_verified: boolean;
  two_factor_enabled: boolean;
  completed_orders: number;
}): number {
  let score = 0;

  // KYC verification (up to 40 points)
  score += Math.min(user.kyc_tier, 3) * 13.34;

  // Email verified (15 points)
  if (user.email_verified) score += 15;

  // Phone verified (15 points)
  if (user.phone_verified) score += 15;

  // 2FA enabled (10 points)
  if (user.two_factor_enabled) score += 10;

  // Completed orders (up to 20 points — 2 per order, max 20)
  score += Math.min(user.completed_orders * 2, 20);

  return Math.round(Math.min(score, 100));
}

function getTrustLevel(score: number): { label: string; color: string; icon: typeof Star } {
  if (score >= 80) return { label: "Excellent", color: "text-[#10B981]", icon: Star };
  if (score >= 60) return { label: "Good", color: "text-primary", icon: Star };
  if (score >= 40) return { label: "Fair", color: "text-[#F97316]", icon: Star };
  return { label: "Building", color: "text-muted-foreground", icon: Clock };
}

export default function TrustScorePage() {
  const user = useAuthStore((s) => s.user);

  const score = useMemo(() => {
    if (!user) return 0;
    return computeTrustScore(user);
  }, [user]);

  const level = getTrustLevel(score);

  if (!user) return null;

  const factors = [
    {
      icon: Shield,
      label: "KYC Verification",
      status: user.kyc_tier >= 1 ? "complete" as const : "pending" as const,
      detail:
        user.kyc_tier >= 1
          ? `Tier ${user.kyc_tier} verified`
          : "Complete identity verification",
    },
    {
      icon: Mail,
      label: "Email Verified",
      status: user.email_verified ? ("complete" as const) : ("pending" as const),
      detail: user.email_verified ? "Verified" : "Verify your email address",
    },
    {
      icon: Phone,
      label: "Phone Verified",
      status: user.phone_verified ? ("complete" as const) : ("pending" as const),
      detail: user.phone_verified ? "Verified" : "Verify your phone number",
    },
    {
      icon: Zap,
      label: "Two-Factor Auth",
      status: user.two_factor_enabled ? ("complete" as const) : ("pending" as const),
      detail: user.two_factor_enabled ? "Enabled" : "Enable for extra security",
    },
    {
      icon: Award,
      label: "Completed Orders",
      status: user.completed_orders > 0 ? ("complete" as const) : ("pending" as const),
      detail:
        user.completed_orders > 0
          ? `${user.completed_orders} order${user.completed_orders !== 1 ? "s" : ""} completed`
          : "Complete your first errand",
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Trust Score</h1>
        <p className="text-base text-muted-foreground mt-1">
          Your reputation on Errand Boy. A higher score helps you win more bids.
        </p>
      </div>

      {/* Score Card */}
      <Card className="text-center">
        <CardContent className="pt-8 pb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted mb-4">
            <span className={`text-4xl font-bold ${level.color}`}>{score}</span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <level.icon className={`w-5 h-5 ${level.color}`} />
            <h2 className={`text-xl font-bold ${level.color}`}>{level.label}</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {score >= 80
              ? "You're a top-rated errander. Requesters trust you for fast, reliable deliveries."
              : score >= 60
                ? "You're building a solid reputation. Keep completing orders to improve your score."
                : score >= 40
                  ? "You're on the right track. Complete your profile and take on more errands."
                  : "Complete your profile verifications and start running errands to build your score."}
          </p>
        </CardContent>
      </Card>

      {/* Score Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Score Factors</CardTitle>
          <CardDescription>
            These factors contribute to your overall trust score
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {factors.map((factor) => (
            <div
              key={factor.label}
              className="flex items-center gap-3 p-3 rounded-xl border border-border"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  factor.status === "complete"
                    ? "bg-[#10B981]/10"
                    : "bg-muted"
                }`}
              >
                <factor.icon
                  className={`w-4 h-4 ${
                    factor.status === "complete"
                      ? "text-[#10B981]"
                      : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{factor.label}</p>
                <p className="text-xs text-muted-foreground">{factor.detail}</p>
              </div>
              <Badge variant={factor.status === "complete" ? "success" : "secondary"}>
                {factor.status === "complete" ? "Done" : "Pending"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
