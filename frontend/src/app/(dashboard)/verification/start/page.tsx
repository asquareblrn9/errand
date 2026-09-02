"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Camera,
  Shield,
  Users,
  Upload,
  X,
  Loader2,
  ChevronDown,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OtpInput } from "@/components/shared/OtpInput";
import {
  useKycStatus,
  useSubmitKycIdentity,
  useSubmitKycSelfie,
  useSaveBankAccount,
  useSaveEmergencyContact,
} from "@/hooks/queries/kyc/use-kyc";
import { walletApi } from "@/services/api/wallet.api";
import { useWalletBankAccount } from "@/hooks/queries/wallet/use-wallet";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/store/toastStore";
import Link from "next/link";
import type { KycDocumentType, Relationship } from "@/types/api/kyc";
import type { Bank } from "@/types/api/wallet";

// ── Schemas ─────────────────────────────────────────────────

const bankSchema = z.object({
  bank_name: z.string().min(1, "Required"),
  bank_code: z.string().min(1, "Required"),
  account_number: z.string().regex(/^\d{10}$/, "Must be 10 digits"),
  account_name: z.string().min(3, "Invalid account name"),
});

const contactSchema = z.object({
  full_name: z.string().min(1, "Required"),
  phone_number: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone"),
  relationship: z.enum(["parent", "sibling", "friend", "spouse", "other"]),
  other_relationship: z.string().optional(),
});

const STEPS = [
  { id: 1, label: "Identity", icon: CreditCard },
  { id: 2, label: "Selfie", icon: Camera },
  { id: 3, label: "Bank", icon: Shield },
  { id: 4, label: "Contact", icon: Users },
];

// ── Document Type Labels ────────────────────────────────────

const DOC_TYPES: { value: KycDocumentType; label: string }[] = [
  { value: "nin", label: "National Identification Number (NIN)" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_card", label: "Voter's Card" },
  { value: "international_passport", label: "International Passport" },
];

const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "friend", label: "Friend" },
  { value: "spouse", label: "Spouse" },
  { value: "other", label: "Other" },
];

export default function KycWizardPage() {
  const router = useRouter();
  const { data: kyc } = useKycStatus();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // ── Step 1: Identity ──────────────────────────────────────
  const [docType, setDocType] = useState<KycDocumentType>("nin");
  const [docNumber, setDocNumber] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const submitIdentity = useSubmitKycIdentity();

  // ── Step 2: Selfie ────────────────────────────────────────
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const submitSelfie = useSubmitKycSelfie();

  // ── Step 3: Bank ──────────────────────────────────────────
  const bankForm = useForm<z.infer<typeof bankSchema>>({
    resolver: zodResolver(bankSchema),
  });
  const saveBank = useSaveBankAccount();
  const queryClient = useQueryClient();
  const { data: bankStatus } = useWalletBankAccount();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [resolveError, setResolveError] = useState("");
  const [bankLockError, setBankLockError] = useState<string | null>(null);
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch banks when step 4 is reached
  useEffect(() => {
    if (step === 3 && banks.length === 0) {
      setBanksLoading(true);
      walletApi.getBanks("flutterwave")
        .then(setBanks)
        .catch(() => toast.error("Error", "Could not load bank list."))
        .finally(() => setBanksLoading(false));
    }
  }, [step, banks.length]);

  // Close bank dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredBanks = useMemo(() => {
    // Deduplicate by code (Flutterwave sometimes returns duplicate entries)
    const seen = new Set<string>();
    const unique = banks.filter((b) => {
      if (seen.has(b.code)) return false;
      seen.add(b.code);
      return true;
    });
    if (!bankSearch.trim()) return unique;
    const q = bankSearch.toLowerCase();
    return unique.filter((b) => b.name.toLowerCase().includes(q) || b.code.includes(q));
  }, [banks, bankSearch]);

  const selectedBankName = banks.find((b) => b.code === bankForm.watch("bank_code"))?.name;

  // Auto-resolve account name
  const accountNumber = bankForm.watch("account_number");
  const bankCode = bankForm.watch("bank_code");

  useEffect(() => {
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
    setResolveError("");

    if (accountNumber && accountNumber.length === 10 && bankCode) {
      resolveTimer.current = setTimeout(async () => {
        setResolvingAccount(true);
        try {
          const result = await walletApi.resolveAccount({
            account_number: accountNumber,
            bank_code: bankCode,
            provider: "flutterwave",
          });
          setAccountName(result.account_name);
          bankForm.setValue("account_name", result.account_name);
          setResolveError("");
        } catch {
          setResolveError("Could not verify this account. Check the number and bank.");
          setAccountName("");
          bankForm.setValue("account_name", "");
        } finally {
          setResolvingAccount(false);
        }
      }, 600);
    } else if (accountNumber && accountNumber.length > 0 && accountNumber.length < 10) {
      setAccountName("");
      bankForm.setValue("account_name", "");
    }

    return () => {
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
    };
  }, [accountNumber, bankCode, bankForm]);

  const handleBankSelect = (code: string, name: string) => {
    bankForm.setValue("bank_code", code);
    bankForm.setValue("bank_name", name);
    setBankDropdownOpen(false);
    setBankSearch("");
    setAccountName("");
    bankForm.setValue("account_name", "");
    setResolveError("");
  };

  // ── Step 4: Emergency Contact ─────────────────────────────
  const contactForm = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { relationship: "friend" },
  });
  const saveContact = useSaveEmergencyContact();

  // ── File handlers ─────────────────────────────────────────
  const handleFile = (
    file: File,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", "Maximum file size is 5MB.");
      return;
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearFile = (
    inputRef: React.RefObject<HTMLInputElement | null>,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
  ) => {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
    setPreview(null);
  };

  // ── Step handlers ─────────────────────────────────────────
  const handleIdentityNext = async () => {
    if (!frontFile) {
      toast.error("Missing file", "Please upload your ID front image.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("document_type", docType);
      fd.append("document_number", docNumber);
      fd.append("front_image", frontFile);
      if (backFile) fd.append("back_image", backFile);
      await submitIdentity.mutateAsync(fd);
      toast.success("Submitted", "Identity documents uploaded.");
      setStep(2);
    } catch {
      toast.error("Error", "Failed to upload documents.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelfieNext = async () => {
    if (!selfieFile) {
      toast.error("Missing photo", "Please take or upload a selfie.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("selfie", selfieFile);
      await submitSelfie.mutateAsync(fd);
      toast.success("Submitted", "Selfie uploaded for verification.");
      setStep(3);
    } catch {
      toast.error("Error", "Failed to upload selfie.");
    } finally {
      setSaving(false);
    }
  };

  const handleBankNext = async () => {
    const valid = await bankForm.trigger();
    if (!valid) return;
    setSaving(true);
    try {
      await saveBank.mutateAsync(bankForm.getValues());
      setBankLockError(null);
      queryClient.invalidateQueries({ queryKey: ["wallet", "bank-account"] });
      toast.success("Saved", "Bank account saved.");
      setStep(4);
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data?.code;
      if (code === "bank_change_locked") {
        setBankLockError(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? "You can only change your bank account once per calendar month."
        );
      } else {
        toast.error("Error", "Failed to save bank account.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleContactFinish = async () => {
    const valid = await contactForm.trigger();
    if (!valid) return;
    setSaving(true);
    try {
      await saveContact.mutateAsync(contactForm.getValues());
      toast.success("Complete", "KYC information saved. You can now submit for review.");
      router.push("/verification");
    } catch {
      toast.error("Error", "Failed to save emergency contact.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/verification">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-[32px] font-bold text-foreground">KYC Verification</h1>
          <p className="text-base text-muted-foreground mt-1">Step {step} of {STEPS.length}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                step > s.id
                  ? "bg-[#10B981] text-white"
                  : step === s.id
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.id ? <Check className="w-4 h-4" /> : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded ${step > s.id ? "bg-[#10B981]" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* ── Step 1: Identity ────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Document Type *</Label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as KycDocumentType)}
                  className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
                >
                  {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Document Number *</Label>
                <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="Enter ID number" />
              </div>

              {/* Front Image */}
              <div className="space-y-2">
                <Label>Document Front *</Label>
                {frontPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={frontPreview} alt="Front" className="w-full h-40 object-cover" />
                    <button
                      onClick={() => clearFile(frontInputRef, setFrontFile, setFrontPreview)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => frontInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload or drag & drop</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG, or PDF (max 5MB)</span>
                  </button>
                )}
                <input
                  ref={frontInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], setFrontFile, setFrontPreview)}
                />
              </div>

              {/* Back Image (optional) */}
              <div className="space-y-2">
                <Label>Document Back (Optional)</Label>
                {backPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={backPreview} alt="Back" className="w-full h-40 object-cover" />
                    <button
                      onClick={() => clearFile(backInputRef, setBackFile, setBackPreview)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => backInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload back side (optional)</span>
                  </button>
                )}
                <input
                  ref={backInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], setBackFile, setBackPreview)}
                />
              </div>

              <Button onClick={handleIdentityNext} disabled={saving} className="w-full">
                {saving ? "Uploading..." : "Continue"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {/* ── Step 2: Selfie ──────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="bg-muted rounded-xl p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Instructions:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Remove sunglasses or hats</li>
                  <li>Face the camera directly</li>
                  <li>Ensure good lighting</li>
                  <li>Use a plain background</li>
                </ul>
              </div>

              {selfiePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={selfiePreview} alt="Selfie" className="w-full h-64 object-cover" />
                  <button
                    onClick={() => clearFile(selfieInputRef, setSelfieFile, setSelfiePreview)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => selfieInputRef.current?.click()}
                  className="w-full h-64 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2"
                >
                  <Camera className="w-12 h-12 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Take or upload a selfie</span>
                </button>
              )}
              <input
                ref={selfieInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                capture="user"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], setSelfieFile, setSelfiePreview)}
              />

              <Button onClick={handleSelfieNext} disabled={saving} className="w-full">
                {saving ? "Uploading..." : "Continue"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {/* ── Step 3: Bank Account ────────────────────────── */}
          {step === 3 && (
            <>
              {/* Bank Dropdown */}
              <div className="space-y-2">
                <Label>Bank *</Label>
                <div ref={bankDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                    className={`flex h-10 w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all duration-200 outline-none ${
                      bankDropdownOpen ? "border-primary ring-4 ring-primary/15" : "border-input"
                    } ${banksLoading ? "opacity-50" : ""}`}
                    disabled={banksLoading}
                  >
                    <span className={selectedBankName ? "text-foreground" : "text-muted-foreground"}>
                      {banksLoading ? "Loading banks..." : selectedBankName ?? "Search and select a bank"}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${bankDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {bankDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2 sticky top-0 bg-popover">
                        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input
                          type="text"
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Search banks..."
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          autoFocus
                        />
                        {bankSearch && (
                          <button onClick={() => setBankSearch("")} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        {filteredBanks.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No banks found</p>
                        ) : (
                          filteredBanks.map((bank) => (
                            <button
                              key={bank.code}
                              type="button"
                              onClick={() => handleBankSelect(bank.code, bank.name)}
                              className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-muted ${
                                bank.code === bankCode ? "bg-primary/5 text-primary font-medium" : ""
                              }`}
                            >
                              <span>{bank.name}</span>
                              <span className="text-xs text-muted-foreground">{bank.code}</span>
                              {bank.code === bankCode && <Check className="w-4 h-4 text-primary" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {bankForm.formState.errors.bank_code && (
                  <p className="text-sm text-destructive">{bankForm.formState.errors.bank_code.message}</p>
                )}
              </div>

              {/* Hidden fields for react-hook-form */}
              <input type="hidden" {...bankForm.register("bank_name")} />
              <input type="hidden" {...bankForm.register("bank_code")} />

              {/* Account Number with validation */}
              <div className="space-y-2">
                <Label>Account Number *</Label>
                <Input
                  {...bankForm.register("account_number")}
                  placeholder="0123456789"
                  maxLength={10}
                  inputMode="numeric"
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    bankForm.setValue("account_number", val);
                  }}
                />
                {bankForm.formState.errors.account_number && (
                  <p className="text-sm text-destructive">{bankForm.formState.errors.account_number.message}</p>
                )}
              </div>

              {/* Account Name (auto-resolved) */}
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <div className="relative">
                  <Input
                    {...bankForm.register("account_name")}
                    placeholder={
                      resolvingAccount ? "Verifying account..."
                      : bankCode ? "Enter 10-digit account number"
                      : "Select a bank first"
                    }
                    readOnly
                    className={resolveError ? "border-destructive" : ""}
                  />
                  {resolvingAccount && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                  )}
                  {!resolvingAccount && accountName && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#10B981]" />
                  )}
                </div>
                {resolveError && <p className="text-sm text-destructive">{resolveError}</p>}
                {bankForm.formState.errors.account_name && (
                  <p className="text-sm text-destructive">{bankForm.formState.errors.account_name.message}</p>
                )}
              </div>

              {/* Current account + monthly change lock */}
              {bankStatus?.bank_account && !bankStatus.change_locked && (
                <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                  Current account: <span className="font-medium text-foreground">{bankStatus.bank_account.bank_name}</span>{" "}
                  {bankStatus.bank_account.account_number} · {bankStatus.bank_account.account_name}
                </div>
              )}
              {bankStatus?.change_locked && (
                <div className="rounded-xl border border-[#B24E00]/30 bg-[#FFF1E6] p-3 text-xs font-medium text-[#B24E00]">
                  You can only change your bank account once per calendar month.
                  You can change it again on {bankStatus.next_change_at}.
                </div>
              )}
              {bankLockError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-medium text-destructive">
                  {bankLockError}
                </div>
              )}

              <Button onClick={handleBankNext} disabled={saving || resolvingAccount || !!bankStatus?.change_locked} className="w-full">
                {saving ? "Saving..." : "Continue"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {/* ── Step 4: Emergency Contact ───────────────────── */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input id="full_name" {...contactForm.register("full_name")} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number *</Label>
                <Input id="phone_number" {...contactForm.register("phone_number")} placeholder="+2348012345678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship *</Label>
                <select
                  id="relationship"
                  {...contactForm.register("relationship")}
                  className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
                >
                  {RELATIONSHIPS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {contactForm.watch("relationship") === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="other_relationship">Please specify *</Label>
                  <Input id="other_relationship" {...contactForm.register("other_relationship")} />
                </div>
              )}
              <Button onClick={handleContactFinish} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Finish"} <Check className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
