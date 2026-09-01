"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Mail, Phone, Zap, Award, Star } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useErranderTrustScore } from "@/hooks/queries/errander/use-errander-home";
import { Amount } from "@/components/design";

const tierStyles: Record<string, string> = {
  Platinum: "text-[#10B981]",
  Gold: "text-[#F59E0B]",
  Silver: "text-[#64748B]",
  Bronze: "text-[#F97316]",
  "At Risk": "text-[#EF4444]",
};

export default function TrustScorePage() {
  const user = useAuthStore((s) => s.user);
  const isErrander = user?.role === "errander";

  // The platform's authoritative score (role-guarded endpoint)
  const { data: trust } = useErranderTrustScore(isErrander);

  if (!user) return null;

  const tierColor = trust ? (tierStyles[trust.tier] ?? "text-muted-foreground") : "text-muted-foreground";

  const verification = [
    {
      icon: Shield,
      label: "KYC Verification",
      complete: user.kyc_tier >= 1,
      detail: user.kyc_tier >= 1 ? `Tier ${user.kyc_tier} verified` : "Complete identity verification",
    },
    {
      icon: Mail,
      label: "Email Verified",
      complete: user.email_verified,
      detail: user.email_verified ? "Verified" : "Verify your email address",
    },
    {
      icon: Phone,
      label: "Phone Verified",
      complete: user.phone_verified,
      detail: user.phone_verified ? "Verified" : "Verify your phone number",
    },
    {
      icon: Zap,
      label: "Two-Factor Auth",
      complete: user.two_factor_enabled,
      detail: user.two_factor_enabled ? "Enabled" : "Enable for extra security",
    },
  ];

  const stats = trust
    ? [
        { label: "Errands completed", value: String(trust.completed_orders) },
        { label: "Average rating", value: trust.average_rating.toFixed(1) },
        { label: "Completion rate", value: `${trust.completion_rate}%` },
        { label: "On-time", value: `${trust.on_time_percentage}%` },
        { label: "Accept rate", value: `${trust.accept_rate}%` },
        { label: "Value handled", value: <Amount value={trust.total_value_handled} /> },
      ]
    : [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Trust Score</h1>
        <p className="text-base text-muted-foreground mt-1">
          Your reputation on Errand Boy. A higher score helps you win more bids.
        </p>
      </div>

      {/* Score Card — platform truth for erranders */}
      {isErrander ? (
        trust ? (
          <Card className="text-center">
            <CardContent className="pt-8 pb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted mb-4">
                <span className={`text-4xl font-bold ${tierColor}`}>
                  {trust.trust_score.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className={`w-5 h-5 ${tierColor}`} />
                <h2 className={`text-xl font-bold ${tierColor}`}>{trust.tier}</h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Based on your completion rate, ratings, on-time deliveries and dispute record.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-8 pb-8 text-center text-sm text-muted-foreground">
              Loading your trust score…
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-sm text-muted-foreground">
            Trust scores apply to erranders. Post an errand and rate your errander
            to build the community&apos;s reputation.
          </CardContent>
        </Card>
      )}

      {/* Performance stats (erranders) */}
      {isErrander && trust && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Performance</CardTitle>
            <CardDescription>Your lifetime errander stats</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border p-3">
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Account verification — identity checklist, separate from the score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Account Verification</CardTitle>
          <CardDescription>
            Verify your identity to unlock withdrawals and higher-value errands
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verification.map((factor) => (
            <div
              key={factor.label}
              className="flex items-center gap-3 p-3 rounded-xl border border-border"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  factor.complete ? "bg-[#10B981]/10" : "bg-muted"
                }`}
              >
                <factor.icon
                  className={`w-4 h-4 ${
                    factor.complete ? "text-[#10B981]" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{factor.label}</p>
                <p className="text-xs text-muted-foreground">{factor.detail}</p>
              </div>
              <Badge variant={factor.complete ? "success" : "secondary"}>
                {factor.complete ? "Done" : "Pending"}
              </Badge>
            </div>
          ))}
          {user.role === "errander" && (
            <div
              className={`flex items-center gap-3 p-3 rounded-xl border border-border ${
                user.completed_orders > 0 ? "" : "opacity-60"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  user.completed_orders > 0 ? "bg-[#10B981]/10" : "bg-muted"
                }`}
              >
                <Award
                  className={`w-4 h-4 ${
                    user.completed_orders > 0 ? "text-[#10B981]" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Completed Orders</p>
                <p className="text-xs text-muted-foreground">
                  {user.completed_orders > 0
                    ? `${user.completed_orders} order${user.completed_orders !== 1 ? "s" : ""} completed`
                    : "Complete your first errand"}
                </p>
              </div>
              <Badge variant={user.completed_orders > 0 ? "success" : "secondary"}>
                {user.completed_orders > 0 ? "Done" : "Pending"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
