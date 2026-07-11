import { z } from "zod";

// ── Fund Wallet ────────────────────────────────────────────

export const fundWalletSchema = z.object({
  amount: z
    .number({ message: "Amount is required" })
    .min(1000, "Minimum deposit is ₦1,000")
    .max(500000, "Maximum deposit is ₦500,000"),
});

export type FundWalletFormData = z.infer<typeof fundWalletSchema>;

// ── Withdraw ───────────────────────────────────────────────

export const withdrawSchema = z.object({
  amount: z
    .number({ message: "Amount is required" })
    .min(1000, "Minimum withdrawal is ₦1,000"),
  bank_code: z
    .string()
    .min(3, "Bank code is required"),
  account_number: z
    .string()
    .length(10, "Account number must be 10 digits")
    .regex(/^\d+$/, "Account number must be numeric"),
  account_name: z
    .string()
    .min(2, "Account name is required")
    .max(100, "Account name is too long"),
});

export type WithdrawFormData = z.infer<typeof withdrawSchema>;
