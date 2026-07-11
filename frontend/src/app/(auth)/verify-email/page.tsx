"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OtpInput } from "@/components/shared/OtpInput";
import { useVerifyEmailMutation, useSendEmailVerificationMutation } from "@/hooks/queries/auth/use-auth-mutations";
import { useAuthStore } from "@/store/authStore";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const { user, fetchUser } = useAuthStore();
  const verifyMutation = useVerifyEmailMutation();
  const resendMutation = useSendEmailVerificationMutation();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  // If user is already verified, redirect to dashboard
  useEffect(() => {
    if (user?.email_verified) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Cooldown countdown for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) return;
    setError("");
    try {
      await verifyMutation.mutateAsync({ code, email });
      // Refresh user to get updated email_verified status
      await fetchUser();
      router.push("/dashboard");
    } catch {
      setError("Invalid or expired verification code. Please try again.");
    }
  }, [code, verifyMutation, fetchUser, router, email]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setResendMessage("");
    try {
      await resendMutation.mutateAsync();
      setResendCooldown(60);
      setResendMessage("A new verification code has been sent to your email.");
    } catch {
      setError("Failed to resend verification code. Please try again.");
    }
  };

  // Auto-verify when 6 digits are entered
  useEffect(() => {
    if (code.length === 6 && !verifyMutation.isPending) {
      handleVerify();
    }
  }, [code, handleVerify, verifyMutation.isPending]);

  const isSubmitting = verifyMutation.isPending;

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-2 text-center pb-6">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Verify your email</CardTitle>
        <CardDescription>
          We sent a 6-digit verification code to{" "}
          <span className="font-semibold text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-5">
          {error && (
            <div className="w-full p-3 text-sm rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-center">
              {error}
            </div>
          )}

          {resendMessage && !error && (
            <div className="w-full p-3 text-sm rounded-xl bg-primary/10 text-primary border border-primary/20 text-center">
              {resendMessage}
            </div>
          )}

          <OtpInput
            value={code}
            onChange={(val) => {
              setCode(val);
              setError("");
            }}
            disabled={isSubmitting}
            error={error ? "" : undefined}
          />

          <Button
            onClick={() => handleVerify()}
            disabled={code.length !== 6 || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Verifying..." : "Verify Email"}
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resendMutation.isPending}
            className="text-sm text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors disabled:no-underline disabled:text-muted-foreground/50 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : resendMutation.isPending
                ? "Sending..."
                : "Resend code"}
          </button>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center text-center text-sm">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-primary font-medium inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to login
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <Card className="shadow-lg">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify your email</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
