"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OtpInput } from "@/components/shared/OtpInput";
import {
  useEnable2FAMutation,
  useVerify2FAMutation,
  useDisable2FAMutation,
} from "@/hooks/queries/auth/use-auth-mutations";
import { Shield, Loader2 } from "lucide-react";

export function TwoFactorSection() {
  const { user } = useAuthStore();
  const enableMutation = useEnable2FAMutation();
  const verifyMutation = useVerify2FAMutation();
  const disableMutation = useDisable2FAMutation();

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const isEnabled = user?.two_factor_enabled ?? false;

  const handleEnable = async () => {
    setError("");
    setMessage("");
    try {
      const result = await enableMutation.mutateAsync();
      setQrCode(result.qr_code_url);
      setSecret(result.secret);
      setShowSetup(true);
    } catch {
      setError("Failed to enable 2FA. Please try again.");
    }
  };

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) return;
    setError("");
    try {
      await verifyMutation.mutateAsync({ code });
      setShowSetup(false);
      setQrCode(null);
      setSecret(null);
      setCode("");
      setMessage("Two-factor authentication enabled successfully!");
    } catch {
      setError("Invalid verification code.");
    }
  }, [code, verifyMutation]);

  useEffect(() => {
    if (code.length === 6 && !verifyMutation.isPending) {
      handleVerify();
    }
  }, [code, handleVerify, verifyMutation.isPending]);

  const handleDisable = async () => {
    setError("");
    setMessage("");
    try {
      await disableMutation.mutateAsync();
      setMessage("Two-factor authentication has been disabled.");
    } catch {
      setError("Failed to disable 2FA.");
    }
  };

  const isProcessing = enableMutation.isPending || verifyMutation.isPending || disableMutation.isPending;

  return (
    <div className="rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Two-Factor Authentication</h3>
            <p className="text-sm text-muted-foreground">
              {isEnabled
                ? "2FA is enabled. Your account is more secure."
                : "Add an extra layer of security to your account."}
            </p>
          </div>
        </div>
        {isEnabled ? (
          <Badge variant="success" className="text-xs">Enabled</Badge>
        ) : (
          <Badge variant="outline" className="text-xs">Disabled</Badge>
        )}
      </div>

      {message && <p className="text-sm text-primary">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {showSetup && qrCode && (
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
          <div className="bg-white p-3 rounded-xl inline-block">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
              alt="2FA QR Code"
              className="w-40 h-40"
            />
          </div>
          {secret && (
            <p className="text-xs text-muted-foreground break-all">
              Or enter this key manually: <code className="font-mono bg-muted px-1.5 py-0.5 rounded-lg">{secret}</code>
            </p>
          )}
          <div className="flex flex-col items-center gap-3">
            <OtpInput
              value={code}
              onChange={(val) => { setCode(val); setError(""); }}
              disabled={isProcessing}
            />
            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || isProcessing}
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Verify & Enable"
              )}
            </Button>
          </div>
        </div>
      )}

      {isEnabled ? (
        <Button
          variant="destructive"
          onClick={handleDisable}
          disabled={isProcessing}
        >
          {disableMutation.isPending ? "Disabling..." : "Disable 2FA"}
        </Button>
      ) : !showSetup ? (
        <Button
          variant="outline"
          onClick={handleEnable}
          disabled={isProcessing}
        >
          {enableMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Setting up...
            </>
          ) : (
            "Enable 2FA"
          )}
        </Button>
      ) : null}
    </div>
  );
}
