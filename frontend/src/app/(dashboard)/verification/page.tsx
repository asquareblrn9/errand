"use client";

import Link from "next/link";
import {
  Shield,
  User,
  Mail,
  Phone,
  CreditCard,
  Landmark,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useKycStatus } from "@/hooks/queries/kyc/use-kyc";
import { useWalletBankAccount } from "@/hooks/queries/wallet/use-wallet";
import { ProfileSkeleton } from "@/components/shared/SkeletonLoader";
import type { KycStatus } from "@/types/api/kyc";

function statusConfig(status: KycStatus) {
  switch (status) {
    case "approved":
      return { icon: CheckCircle2, color: "text-[#10B981]", bg: "bg-[#10B981]/10", label: "Approved" };
    case "pending_review":
      return { icon: Clock, color: "text-[#F97316]", bg: "bg-[#F97316]/10", label: "Pending Review" };
    case "under_review":
      return { icon: Clock, color: "text-primary", bg: "bg-primary/10", label: "Under Review" };
    case "rejected":
      return { icon: XCircle, color: "text-[#EF4444]", bg: "bg-[#EF4444]/10", label: "Rejected" };
    case "requires_resubmission":
      return { icon: RefreshCw, color: "text-[#F97316]", bg: "bg-[#F97316]/10", label: "Resubmit" };
    case "draft":
    default:
      return { icon: AlertTriangle, color: "text-muted-foreground", bg: "bg-muted", label: "Pending" };
  }
}

const VERIFICATION_STEPS = [
  { key: "profile" as const, label: "Profile Information", icon: User, description: "Full name, date of birth, address" },
  { key: "phone" as const, label: "Phone Verification", icon: Phone, description: "Verify with OTP" },
  { key: "email" as const, label: "Email Verification", icon: Mail, description: "Verify email address" },
  { key: "identity" as const, label: "Identity Verification", icon: CreditCard, description: "Government ID upload" },
  { key: "bank" as const, label: "Bank Account", icon: Landmark, description: "Verified account for payouts" }
];

export default function VerificationPage() {
  const { data: kyc, isLoading } = useKycStatus();
  const { data: bankStatus } = useWalletBankAccount();

  if (isLoading) return <ProfileSkeleton />;

  const progress = kyc?.progress ?? 0;
  const canSubmit = kyc && !["pending_review", "under_review", "approved"].includes(kyc.kyc_status);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Verification Center</h1>
        <p className="text-base text-muted-foreground mt-1">
          Complete verification to unlock all features and build trust.
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Profile Completion</span>
            <span className="text-sm font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Verification Cards */}
      <div className="space-y-3">
        {VERIFICATION_STEPS.map((step) => {
          const isComplete = kyc?.steps[step.key] ?? false;
          const verification = kyc?.verifications.find(
            (v) =>
              (step.key === "identity" && v.type === "identity") ||
              (step.key === "bank" && v.type === "bank")
          );
          const status = verification?.status ?? (isComplete ? "approved" : "draft");
          const cfg = statusConfig(status as KycStatus);

          const isBank = step.key === "bank";
          const bank = bankStatus?.bank_account;
          const bankLocked = isBank && !!bankStatus?.change_locked;

          return (
            <Card key={step.key} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <step.icon className={`w-5 h-5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{step.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isBank && bank
                      ? `${bank.bank_name} · ${bank.account_number} · ${bank.account_name}`
                      : step.description}
                    {verification?.rejection_reason && (
                      <span className="text-[#EF4444] ml-2">— {verification.rejection_reason}</span>
                    )}
                  </p>
                  {bankLocked && (
                    <p className="mt-1 text-xs font-medium text-[#B24E00]">
                      You can change your bank again on {bankStatus?.next_change_at}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge
                    variant={
                      status === "approved" ? "success"
                      : status === "rejected" ? "destructive"
                      : status === "pending_review" || status === "under_review" || status === "requires_resubmission"
                        ? "warning"
                        : "secondary"
                    }
                  >
                    {cfg.label}
                  </Badge>
                  {isBank ? (
                    bankLocked ? (
                      <Button variant="ghost" size="sm" disabled>
                        Change
                      </Button>
                    ) : (
                      <Link href="/verification/start">
                        <Button variant="ghost" size="sm">
                          {bank ? "Change" : "Add"} <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    )
                  ) : (
                    !isComplete && (
                      <Link
                        href={
                          step.key === "phone" || step.key === "email"
                            ? "/settings?tab=security"
                            : `/verification/${step.key === "profile" ? "profile" : "start"}`
                        }
                      >
                        <Button variant="ghost" size="sm">
                          {status === "requires_resubmission" ? "Resubmit" : "Verify"} <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Submit Button */}
      {canSubmit && (
        <div className="flex justify-end">
          <Link href="/verification/submit">
            <Button size="lg">
              <Shield className="w-4 h-4 mr-2" />
              Submit for Review
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
