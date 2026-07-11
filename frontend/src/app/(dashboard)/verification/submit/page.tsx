"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useKycStatus, useSubmitKyc } from "@/hooks/queries/kyc/use-kyc";
import { toast } from "@/store/toastStore";
import Link from "next/link";

export default function KycSubmitPage() {
  const router = useRouter();
  const { data: kyc } = useKycStatus();
  const submitMutation = useSubmitKyc();

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync();
      toast.success("Submitted", "Your verification documents have been submitted for review.");
      router.push("/verification");
    } catch {
      toast.error("Error", "Failed to submit for review.");
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/verification">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Submit for Review</h1>
          <p className="text-base text-muted-foreground mt-1">Review your information before submitting</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Verification Summary</CardTitle>
          <CardDescription>
            The following items will be submitted for admin review. Please ensure all information is accurate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {[
              { label: "Profile Information", done: kyc?.steps.profile },
              { label: "Phone Verified", done: kyc?.steps.phone },
              { label: "Email Verified", done: kyc?.steps.email },
              { label: "Identity Documents", done: kyc?.steps.identity },
              { label: "Selfie Photo", done: kyc?.steps.selfie },
              { label: "Bank Account", done: kyc?.steps.bank },
              { label: "Emergency Contact", done: kyc?.steps.emergency_contact },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{item.label}</span>
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                ) : (
                  <span className="text-xs text-muted-foreground">Pending</span>
                )}
              </div>
            ))}
          </div>

          <div className="bg-[#F97316]/10 rounded-xl p-4 text-sm text-[#F97316]">
            <strong>Important:</strong> Once submitted, your verification cannot be edited until an admin reviews it. This process typically takes 24-48 hours.
          </div>

          <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="w-full" size="lg">
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
            ) : (
              <><Shield className="w-4 h-4 mr-2" /> Submit for Review</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
