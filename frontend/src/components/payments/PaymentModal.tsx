"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Wallet,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { paymentsApi } from "@/services/api/payments.api";
import { useInitiatePaymentMutation } from "@/hooks/queries/payments/use-payments";
import { useWallet } from "@/hooks/queries/wallet/use-wallet";
import type { PaymentProvidersResponse } from "@/services/api/payments.api";

// ── Types ────────────────────────────────────────────────────

interface BidPaymentInfo {
  id: string;
  goods_amount: number;
  service_fee: number;
  platform_fee: number;
  total_amount: number;
  status: string;
}

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  bid: BidPaymentInfo;
  onSuccess: () => void;
}

type PaymentStep = "select" | "processing" | "success" | "failed";

// ── Component ────────────────────────────────────────────────

export function PaymentModal({ open, onClose, bid, onSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState<"wallet" | "card">("wallet");
  const [cardProvider, setCardProvider] = useState<string>("");
  const [step, setStep] = useState<PaymentStep>("select");
  const [error, setError] = useState<string | null>(null);

  const { data: wallet } = useWallet();
  const initiatePayment = useInitiatePaymentMutation();

  const { data: providersData } = useQuery({
    queryKey: ["payment-providers"],
    queryFn: () => paymentsApi.getProviders() as Promise<PaymentProvidersResponse>,
    staleTime: 5 * 60 * 1000,
    enabled: open && method === "card",
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep("select");
      setError(null);
      setMethod("wallet");
    }
  }, [open]);

  // Set default card provider when data loads
  useEffect(() => {
    if (providersData && !cardProvider) {
      setCardProvider(providersData.default);
    }
  }, [providersData, cardProvider]);

  const total = bid.total_amount;
  const canAffordWallet = (wallet?.available_balance ?? 0) >= total;

  // ── Handlers ──────────────────────────────────────────────

  const handlePayWallet = async () => {
    setError(null);
    setStep("processing");
    try {
      const result = await initiatePayment.mutateAsync({
        bid_id: bid.id,
        payment_method: "wallet",
      });
      if (result.status === "successful") {
        setStep("success");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setStep("failed");
        setError("Wallet payment could not be completed.");
      }
    } catch (err: any) {
      setStep("failed");
      setError(err?.response?.data?.message ?? err?.message ?? "Payment failed");
    }
  };

  const handlePayCard = async () => {
    setError(null);
    setStep("processing");
    try {
      const result = await initiatePayment.mutateAsync({
        bid_id: bid.id,
        payment_method: "card",
        provider: cardProvider,
      });
      if (result.payment_url) {
        // Redirect the user to the payment page in the same tab.
        // After payment, the provider redirects back to the request page.
        // The webhook updates the bid status in the background.
        window.location.href = result.payment_url;
      } else {
        setStep("failed");
        setError("No payment URL returned from provider.");
      }
    } catch (err: any) {
      setStep("failed");
      setError(err?.response?.data?.message ?? err?.message ?? "Payment failed");
    }
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Total: <span className="font-semibold text-foreground">₦{total.toLocaleString()}</span>
          </DialogDescription>
        </DialogHeader>

        {/* ── Select method ──────────────────────────────── */}
        {step === "select" && (
          <div className="space-y-4">
            {/* Method toggle */}
            <div className="flex rounded-xl border border-input p-1 bg-muted/50">
              <button
                type="button"
                onClick={() => setMethod("wallet")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  method === "wallet"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wallet className="w-4 h-4" />
                Wallet
              </button>
              <button
                type="button"
                onClick={() => setMethod("card")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  method === "card"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <CreditCard className="w-4 h-4" />
                Card
              </button>
            </div>

            {/* Wallet flow */}
            {method === "wallet" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <span className="text-sm text-muted-foreground">Wallet Balance</span>
                  <span className="text-sm font-semibold">
                    ₦{(wallet?.available_balance ?? 0).toLocaleString()}
                  </span>
                </div>
                {!canAffordWallet && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F97316]/10 border border-[#F97316]/20">
                    <AlertTriangle className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-[#F97316]">Insufficient Balance</p>
                      <p className="text-muted-foreground mt-1">
                        You need ₦{(total - (wallet?.available_balance ?? 0)).toLocaleString()} more.
                      </p>
                      <Link
                        href="/wallet"
                        target="_blank"
                        className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-2 hover:underline"
                      >
                        Fund Wallet <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
                <Button
                  className="w-full"
                  disabled={!canAffordWallet}
                  onClick={handlePayWallet}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Pay ₦{total.toLocaleString()} from Wallet
                </Button>
              </div>
            )}

            {/* Card flow */}
            {method === "card" && (
              <div className="space-y-3">
                {providersData && providersData.providers.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Payment Provider</p>
                    <div className="flex rounded-xl border border-input p-1 bg-muted/50">
                      {providersData.providers.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCardProvider(p)}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200",
                            cardProvider === p
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={handlePayCard}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay via {cardProvider || "Card"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Processing ──────────────────────────────────── */}
        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-4">
            {method === "card" ? (
              <>
                <ExternalLink className="w-8 h-8 text-primary animate-pulse" />
                <p className="text-sm font-medium">Redirecting to {cardProvider || "payment provider"}...</p>
                <p className="text-xs text-muted-foreground text-center">
                  You will complete your payment securely on their page and be returned here automatically.
                </p>
              </>
            ) : (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Processing payment...</p>
              </>
            )}
          </div>
        )}

        {/* ── Success ─────────────────────────────────────── */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="w-12 h-12 text-[#10B981]" />
            <p className="text-lg font-semibold">Payment Successful!</p>
            <p className="text-sm text-muted-foreground">
              The errander can now start your errand.
            </p>
          </div>
        )}

        {/* ── Failed ──────────────────────────────────────── */}
        {step === "failed" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <XCircle className="w-12 h-12 text-destructive" />
            <p className="text-lg font-semibold">Payment Failed</p>
            {error && (
              <p className="text-sm text-muted-foreground text-center">{error}</p>
            )}
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("select")}
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={onClose}
              >
                Pay Later
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
