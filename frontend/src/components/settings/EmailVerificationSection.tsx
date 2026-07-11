"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OtpInput } from "@/components/shared/OtpInput";
import { useSendEmailVerificationMutation, useVerifyEmailMutation } from "@/hooks/queries/auth/use-auth-mutations";
import { Mail } from "lucide-react";

export function EmailVerificationSection() {
  const { user, fetchUser } = useAuthStore();
  const sendMutation = useSendEmailVerificationMutation();
  const verifyMutation = useVerifyEmailMutation();

  const [showOtp, setShowOtp] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");

  const isVerified = user?.email_verified ?? false;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((p) => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSend = async () => {
    if (cooldown > 0) return;
    setError("");
    setMessage("");
    try {
      await sendMutation.mutateAsync();
      setCooldown(60);
      setShowOtp(true);
      setMessage("Verification code sent to your email.");
    } catch {
      setError("Failed to send code. Please try again.");
    }
  };

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) return;
    setError("");
    try {
      await verifyMutation.mutateAsync({ code, email: user?.email });
      await fetchUser();
      setShowOtp(false);
      setCode("");
      setMessage("Email verified successfully!");
    } catch {
      setError("Invalid or expired code.");
    }
  }, [code, verifyMutation, fetchUser, user?.email]);

  useEffect(() => {
    if (code.length === 6 && !verifyMutation.isPending) {
      handleVerify();
    }
  }, [code, handleVerify, verifyMutation.isPending]);

  return (
    <div className="rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Email Verification</h3>
            <p className="text-sm text-muted-foreground">
              {isVerified
                ? "Your email address is verified."
                : "Verify your email address to secure your account."}
            </p>
          </div>
        </div>
        {isVerified ? (
          <Badge variant="success" className="text-xs">Verified</Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">Not Verified</Badge>
        )}
      </div>

      <p className="text-sm font-medium">{user?.email}</p>

      {message && (
        <p className={`text-sm ${error ? "text-destructive" : "text-primary"}`}>{message}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!isVerified && (
        <>
          {!showOtp ? (
            <Button
              variant="outline"
              onClick={handleSend}
              disabled={cooldown > 0 || sendMutation.isPending}
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : sendMutation.isPending
                  ? "Sending..."
                  : "Send Verification Code"}
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <OtpInput
                value={code}
                onChange={(val) => { setCode(val); setError(""); }}
                disabled={verifyMutation.isPending}
              />
              <Button
                onClick={handleVerify}
                disabled={code.length !== 6 || verifyMutation.isPending}
              >
                {verifyMutation.isPending ? "Verifying..." : "Verify"}
              </Button>
              <button
                onClick={handleSend}
                disabled={cooldown > 0 || sendMutation.isPending}
                className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:text-muted-foreground/50 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
