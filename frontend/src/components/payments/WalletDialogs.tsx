"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Loader2, Search, X } from "lucide-react";
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
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import type { PaymentGateway, Bank } from "@/types/api/wallet";

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

// ── Bank Dropdown Component ─────────────────────────────────

export function BankDropdown({
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
    // Deduplicate by code (Flutterwave sometimes returns duplicate entries)
    const seen = new Set<string>();
    const unique = banks.filter((b) => {
      if (seen.has(b.code)) return false;
      seen.add(b.code);
      return true;
    });
    if (!search.trim()) return unique;
    const q = search.toLowerCase();
    return unique.filter(
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

export function WithdrawDialog() {
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
  const [withdrawProvider, setWithdrawProvider] = useState<PaymentGateway>("paystack");

  // Fetch bank list (on open / provider change — event-driven, not an effect)
  const loadBanks = () => {
    setBanksLoading(true);
    walletApi.getBanks(withdrawProvider)
      .then(setBanks)
      .catch(() => toast.error("Error", "Could not load bank list."))
      .finally(() => setBanksLoading(false));
  };

  const openDialog = () => {
    setOpen(true);
    if (banks.length === 0 && !banksLoading) loadBanks();
  };

  const handleProviderChange = (provider: PaymentGateway) => {
    setWithdrawProvider(provider);
    if (open) {
      setBanks([]);
      loadBanks();
    }
  };

  // Auto-resolve account name (debounced) when account number + bank are entered
  useEffect(() => {
    if (!(form.account_number.length === 10 && form.bank_code)) return;

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
    setValidationErrors((prev) => ({ ...prev, bank_code: "", account_number: "" }));
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
        provider: withdrawProvider,
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
      <Button
        variant="outline"
        onClick={openDialog}
        className="rounded-[11px] font-heading text-xs font-bold"
      >
        <ArrowUp className="mr-1.5 h-4 w-4" />Withdraw
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setValidationErrors({}); setResolveError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw to Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Provider */}
            <div className="space-y-2">
              <Label>Payment Provider</Label>
              <div className="flex rounded-xl border border-input p-1 bg-muted/50">
                <button type="button" onClick={() => handleProviderChange("paystack")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${withdrawProvider === "paystack" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Paystack
                </button>
                <button type="button" onClick={() => handleProviderChange("flutterwave")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${withdrawProvider === "flutterwave" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Flutterwave
                </button>
              </div>
            </div>
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
              {/* Fee breakdown */}
              {form.amount && parseFloat(form.amount) >= 1000 && (
                <div className="p-3 rounded-xl bg-muted/30 text-xs space-y-1">
                  {(() => {
                    const amt = parseFloat(form.amount);
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
                  setForm((prev) => ({
                    ...prev,
                    account_number: val,
                    account_name: val.length === 10 ? prev.account_name : "",
                  }));
                  setResolveError("");
                  setValidationErrors((prev) => ({ ...prev, account_number: "", bank_code: "" }));
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
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00A86B]" />
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
