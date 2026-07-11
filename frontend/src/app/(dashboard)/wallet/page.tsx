"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet, ArrowDown, ArrowUp, History, Loader2, Check, ChevronDown, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatsSkeleton, ListSkeleton } from "@/components/shared/SkeletonLoader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWallet, useTransactions } from "@/hooks/queries/wallet/use-wallet";
import { walletApi } from "@/services/api/wallet.api";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import type { WalletTransaction, PaymentGateway, Bank } from "@/types/api/wallet";

const typeBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success"> = {
  deposit: "success", payout: "success", refund: "success",
  withdrawal: "destructive", payment: "secondary", lock: "outline", unlock: "outline",
};

function WalletContent() {
  const searchParams = useSearchParams();
  const { data: wallet, isLoading } = useWallet();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();

  useEffect(() => {
    const funded = searchParams.get("funded");
    if (funded !== "true") return;

    const provider = (searchParams.get("provider") as PaymentGateway | null) ?? "paystack";

    // Paystack returns `reference` or `trxref`; Flutterwave returns `tx_ref` or `transaction_id`
    const reference =
      searchParams.get("trxref") ||
      searchParams.get("reference") ||
      searchParams.get("tx_ref") ||
      searchParams.get("transaction_id");

    // Flutterwave also passes `status` directly — if not successful, skip
    const flutterwaveStatus = searchParams.get("status");
    if (provider === "flutterwave" && flutterwaveStatus && flutterwaveStatus !== "successful") {
      toast.error("Payment failed", "The payment was not completed successfully.");
      window.history.replaceState({}, "", "/wallet");
      return;
    }

    if (reference) {
      walletApi.verifyPayment({ reference, provider })
        .then(() => {
          toast.success("Wallet funded", "Your wallet has been credited.");
          window.history.replaceState({}, "", "/wallet");
        })
        .catch(() => {
          toast.error("Verification failed", "Could not verify payment. Contact support.");
        });
    }
  }, [searchParams]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Wallet</h1>
        <p className="text-base text-muted-foreground mt-1">
          Manage your funds, deposits, and withdrawals
        </p>
      </div>

      {isLoading ? (
        <StatsSkeleton cards={3} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{wallet?.balance.toLocaleString() ?? "0"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Locked (Escrow)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#F97316]">₦{wallet?.locked_balance.toLocaleString() ?? "0"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#10B981]">₦{wallet?.available_balance.toLocaleString() ?? "0"}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-3">
        <FundDialog />
        <WithdrawDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="w-4 h-4" />Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <ListSkeleton rows={3} />
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: WalletTransaction) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={typeBadgeVariant[tx.type] ?? "secondary"}>{tx.type}</Badge>
                      <span className="text-sm font-semibold">₦{tx.amount.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tx.description}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{new Date(tx.created_at).toLocaleDateString()}</p>
                    <p>Balance: ₦{tx.balance_after.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Fund Dialog ────────────────────────────────────────────

function FundDialog() {
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
      <Button onClick={() => setOpen(true)}><ArrowDown className="w-4 h-4 mr-2" />Fund Wallet</Button>
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

// ── Bank Dropdown Component ─────────────────────────────────

function BankDropdown({
  banks,
  value,
  onChange,
  loading,
  error,
}: {
  banks: Bank[];
  value: string;
  onChange: (code: string, name: string) => void;
  loading: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedBank = banks.find((b) => b.code === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return banks;
    const q = search.toLowerCase();
    return banks.filter(
      (b) => b.name.toLowerCase().includes(q) || b.code.includes(q),
    );
  }, [banks, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-10 w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all duration-200 outline-none ${
          error
            ? "border-destructive ring-2 ring-destructive/20"
            : open
              ? "border-primary ring-4 ring-primary/15"
              : "border-input"
        } ${loading ? "opacity-50" : ""}`}
        disabled={loading}
      >
        <span className={selectedBank ? "text-foreground" : "text-muted-foreground"}>
          {loading ? "Loading banks..." : selectedBank?.name ?? "Select a bank"}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 sticky top-0 bg-popover">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search banks..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No banks found</p>
            ) : (
              filtered.map((bank) => (
                <button
                  key={bank.code}
                  type="button"
                  onClick={() => {
                    onChange(bank.code, bank.name);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-muted ${
                    bank.code === value ? "bg-primary/5 text-primary font-medium" : ""
                  }`}
                >
                  <span>{bank.name}</span>
                  <span className="text-xs text-muted-foreground">{bank.code}</span>
                  {bank.code === value && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ── Withdraw Dialog ─────────────────────────────────────────

function WithdrawDialog() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    bank_code: "",
    bank_name: "",
    account_number: "",
    account_name: "",
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch bank list from Flutterwave when dialog opens
  useEffect(() => {
    if (open && banks.length === 0) {
      setBanksLoading(true);
      walletApi.getBanks("flutterwave")
        .then(setBanks)
        .catch(() => toast.error("Error", "Could not load bank list."))
        .finally(() => setBanksLoading(false));
    }
  }, [open, banks.length]);

  // Auto-resolve account name via Flutterwave when account number + bank are entered
  useEffect(() => {
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
    setResolveError("");
    setValidationErrors((prev) => ({ ...prev, account_number: "", bank_code: "" }));

    if (form.account_number.length === 10 && form.bank_code) {
      resolveTimer.current = setTimeout(async () => {
        setResolving(true);
        try {
          const result = await walletApi.resolveAccount({
            account_number: form.account_number,
            bank_code: form.bank_code,
            provider: "flutterwave",
          });
          setForm((prev) => ({ ...prev, account_name: result.account_name }));
          setResolveError("");
        } catch {
          setResolveError("Could not verify this account. Check the account number and bank.");
          setForm((prev) => ({ ...prev, account_name: "" }));
        } finally {
          setResolving(false);
        }
      }, 600);
    } else if (form.account_number.length > 0 && form.account_number.length < 10) {
      setForm((prev) => ({ ...prev, account_name: "" }));
    }

    return () => {
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
    };
  }, [form.account_number, form.bank_code]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.amount || parseFloat(form.amount) < 1000) errors.amount = "Minimum ₦1,000";
    if (!form.bank_code) errors.bank_code = "Select a bank";
    if (form.account_number.length !== 10) errors.account_number = "Must be 10 digits";
    if (!form.account_name) errors.account_name = "Account name required";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBankSelect = (code: string, name: string) => {
    setForm((prev) => ({ ...prev, bank_code: code, bank_name: name, account_name: "" }));
    setResolveError("");
    setValidationErrors((prev) => ({ ...prev, bank_code: "" }));
  };

  const handleWithdraw = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await walletApi.withdraw({
        amount: parseFloat(form.amount),
        bank_code: form.bank_code,
        account_number: form.account_number,
        account_name: form.account_name,
        provider: "flutterwave",
      });
      toast.success("Withdrawal initiated", "Funds will arrive within 24 hours.");
      setOpen(false);
      setForm({ amount: "", bank_code: "", bank_name: "", account_number: "", account_name: "" });
      setValidationErrors({});
    } catch (err) {
      handleApiError(err, "Failed to withdraw.");
    } finally { setLoading(false); }
  };

  const isReady =
    form.amount && parseFloat(form.amount) >= 1000 &&
    form.bank_code &&
    form.account_number.length === 10 &&
    form.account_name &&
    !resolving;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><ArrowUp className="w-4 h-4 mr-2" />Withdraw</Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setValidationErrors({}); setResolveError(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw to Bank</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount (₦)</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => {
                setForm({ ...form, amount: e.target.value });
                setValidationErrors((prev) => ({ ...prev, amount: "" }));
              }}
              placeholder="5000"
              min="1000"
            />
            {validationErrors.amount && <p className="text-sm text-destructive">{validationErrors.amount}</p>}
          </div>

          {/* Bank Dropdown */}
          <div className="space-y-2">
            <Label>Bank</Label>
            <BankDropdown
              banks={banks}
              value={form.bank_code}
              onChange={handleBankSelect}
              loading={banksLoading}
              error={validationErrors.bank_code}
            />
          </div>

          {/* Account Number */}
          <div className="space-y-2">
            <Label>Account Number</Label>
            <Input
              value={form.account_number}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setForm({ ...form, account_number: val });
                setValidationErrors((prev) => ({ ...prev, account_number: "" }));
              }}
              placeholder="0123456789"
              maxLength={10}
              inputMode="numeric"
            />
            {validationErrors.account_number && (
              <p className="text-sm text-destructive">{validationErrors.account_number}</p>
            )}
          </div>

          {/* Account Name (auto-resolved) */}
          <div className="space-y-2">
            <Label>Account Name</Label>
            <div className="relative">
              <Input
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                placeholder={resolving ? "Verifying account..." : form.bank_code ? "Enter 10-digit account number" : "Select a bank first"}
                className={resolveError ? "border-destructive" : ""}
              />
              {resolving && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
              )}
              {!resolving && form.account_name && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#10B981]" />
              )}
            </div>
            {resolveError && <p className="text-sm text-destructive">{resolveError}</p>}
            {validationErrors.account_name && <p className="text-sm text-destructive">{validationErrors.account_name}</p>}
          </div>

          {/* Fee notice */}
          <div className="bg-muted rounded-xl p-3 text-xs text-muted-foreground space-y-0.5">
            <p>• Withdrawal fee: 1.5% (cap ₦200)</p>
            <p>• Funds arrive within 24 hours</p>
            <p>• Minimum withdrawal: ₦1,000</p>
          </div>

          <Button className="w-full" disabled={!isReady || loading} onClick={handleWithdraw}>
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
            ) : (
              `Withdraw ₦${form.amount ? parseFloat(form.amount).toLocaleString() : "0"}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<StatsSkeleton cards={3} />}>
      <WalletContent />
    </Suspense>
  );
}
