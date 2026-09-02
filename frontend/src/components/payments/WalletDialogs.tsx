"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { walletApi } from "@/services/api/wallet.api";
import { useWalletBankAccount } from "@/hooks/queries/wallet/use-wallet";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import type { PaymentGateway } from "@/types/api/wallet";

// ── Fund Dialog ────────────────────────────────────────────

export function FundDialog() {
  const [amount, setAmount] = useState("");
  const [gateway, setGateway] = useState<PaymentGateway>("paystack");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFund = async () => {
    if (!amount || parseFloat(amount) < 1000) return;
    setLoading(true);
    try {
      const result = await walletApi.fund({ amount: parseFloat(amount), payment_gateway: gateway });
      window.location.href = result.authorization_url;
    } catch (err) {
      handleApiError(err, "Failed to initialize payment.");
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="rounded-[11px] bg-[#00A86B] font-heading text-xs font-bold text-white hover:bg-[#008554]">
        <ArrowDown className="mr-1.5 h-4 w-4" />Fund Wallet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" min="1000" max="500000" />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setGateway("paystack")}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${gateway === "paystack" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}>
                  <div className="flex items-center justify-center gap-2">{gateway === "paystack" && <Check className="w-4 h-4" />} Paystack</div>
                  <span className="text-xs text-muted-foreground">Card, Bank, USSD</span>
                </button>
                <button type="button" onClick={() => setGateway("flutterwave")}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${gateway === "flutterwave" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}>
                  <div className="flex items-center justify-center gap-2">{gateway === "flutterwave" && <Check className="w-4 h-4" />} Flutterwave</div>
                  <span className="text-xs text-muted-foreground">Card, Bank, USSD</span>
                </button>
              </div>
            </div>
            <Button className="w-full" disabled={loading || !amount || parseFloat(amount) < 1000} onClick={handleFund}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Initializing...</> : "Continue to Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Withdraw Dialog ─────────────────────────────────────────

export function WithdrawDialog() {
  const { data: bankStatus, isLoading: bankLoading } = useWalletBankAccount();
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noBankError, setNoBankError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [withdrawProvider, setWithdrawProvider] = useState<PaymentGateway>("paystack");

  const bank = bankStatus?.bank_account;

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) < 1000) {
      setValidationErrors({ amount: "Minimum ₦1,000" });
      return;
    }
    setValidationErrors({});
    setLoading(true);
    try {
      await walletApi.withdraw({
        amount: parseFloat(amount),
        provider: withdrawProvider,
      });
      toast.success("Withdrawal initiated", "Funds will arrive within 24 hours.");
      setOpen(false);
      setAmount("");
      setNoBankError("");
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "no_bank_account") {
        setNoBankError("You need a verified bank account to withdraw. Add your bank account first.");
      } else {
        handleApiError(err, "Failed to withdraw.");
      }
    } finally { setLoading(false); }
  };

  const isReady = !!bank && !!amount && parseFloat(amount) >= 1000 && !loading;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="rounded-[11px] font-heading text-xs font-bold"
      >
        <ArrowUp className="mr-1.5 h-4 w-4" />Withdraw
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setValidationErrors({}); setNoBankError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw to Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Provider */}
            <div className="space-y-2">
              <Label>Payment Provider</Label>
              <div className="flex rounded-xl border border-input p-1 bg-muted/50">
                <button type="button" onClick={() => setWithdrawProvider("paystack")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${withdrawProvider === "paystack" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Paystack
                </button>
                <button type="button" onClick={() => setWithdrawProvider("flutterwave")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${withdrawProvider === "flutterwave" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Flutterwave
                </button>
              </div>
            </div>

            {/* Payout destination — the verified bank saved during KYC */}
            <div className="space-y-2">
              <Label>Payout Account</Label>
              {bankLoading ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Loading your bank account…
                </div>
              ) : bank ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{bank.bank_name}</span>
                    <span className="font-mono text-foreground">{bank.account_number}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{bank.account_name} · Payouts go to your verified bank account</p>
                </div>
              ) : (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="text-destructive">No verified bank account yet.</p>
                  <Link href="/verification" className="mt-1 inline-block text-xs font-bold text-[#00A86B] hover:text-[#008554]">
                    Add your bank account →
                  </Link>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setValidationErrors((prev) => ({ ...prev, amount: "" }));
                }}
                placeholder="5000"
                min="1000"
              />
              {validationErrors.amount && <p className="text-sm text-destructive">{validationErrors.amount}</p>}
              {/* Fee breakdown */}
              {amount && parseFloat(amount) >= 1000 && (
                <div className="p-3 rounded-xl bg-muted/30 text-xs space-y-1">
                  {(() => {
                    const amt = parseFloat(amount);
                    const fee = Math.min(amt * 0.015, 200);
                    return (
                      <>
                        <div className="flex justify-between"><span>Amount</span><span>₦{amt.toLocaleString()}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Fee (1.5%, capped at ₦200)</span><span>-₦{fee.toFixed(2)}</span></div>
                        <div className="flex justify-between font-medium pt-1 border-t border-border"><span>You receive</span><span className="text-[#00A86B]">₦{(amt - fee).toLocaleString()}</span></div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {noBankError && <p className="text-sm text-destructive">{noBankError}</p>}

            {/* Fee notice */}
            <div className="bg-muted rounded-xl p-3 text-xs text-muted-foreground space-y-0.5">
              <p>• Withdrawal fee: 1.5% (cap ₦200)</p>
              <p>• Funds arrive within 24 hours</p>
              <p>• Minimum withdrawal: ₦1,000</p>
            </div>

            <Button className="w-full" disabled={!isReady} onClick={handleWithdraw}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
              ) : (
                `Withdraw ₦${amount ? parseFloat(amount).toLocaleString() : "0"}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
