import type { PaginationParams, Timestamps } from "./common";

// ── Wallet ─────────────────────────────────────────────────

export interface WalletData {
  id: string;
  balance: number;
  locked_balance: number;
  available_balance: number;
  pending_earnings: number;
  currency: string;
  status: string;
}

// ── Transactions ───────────────────────────────────────────

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "payment"
  | "refund"
  | "payout"
  | "lock"
  | "unlock";

export type TransactionStatus = "pending" | "successful" | "completed" | "failed";

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference: string;
  description: string;
  status: TransactionStatus;
  created_at: string;
}

export interface TransactionQueryParams extends PaginationParams {
  type?: TransactionType;
}

// ── Fund Wallet ────────────────────────────────────────────

export type PaymentGateway = "flutterwave" | "paystack";

export interface FundWalletRequest {
  amount: number;
  payment_gateway: PaymentGateway;
}

export interface FundWalletResponse {
  reference: string;
  authorization_url: string;
  access_code?: string;
  provider: PaymentGateway;
}

// ── Verify Payment ─────────────────────────────────────────

export interface VerifyPaymentRequest {
  reference: string;
  provider: PaymentGateway;
}

export interface VerifyPaymentResponse {
  amount: number;
  reference: string;
  balance_after: number;
}

// ── Payout Bank Account ────────────────────────────────────

export interface WalletBankAccount {
  bank_name: string;
  bank_code: string;
  account_number: string; // masked by the API (e.g. "****6789")
  account_name: string;
}

export interface WalletBankAccountStatus {
  bank_account: WalletBankAccount | null;
  change_locked: boolean;
  next_change_at: string | null;
}

// ── Bank Verification ──────────────────────────────────────

export interface ResolveAccountRequest {
  account_number: string;
  bank_code: string;
  provider?: PaymentGateway;
}

export interface ResolveAccountResponse {
  account_name: string;
  account_number: string;
  bank_code?: string;
}

export interface Bank {
  name: string;
  code: string;
}

// ── Withdraw ───────────────────────────────────────────────

/** Payouts always go to the saved verified bank account. */
export interface WithdrawRequest {
  amount: number;
  provider?: PaymentGateway;
  narration?: string;
}

export interface WithdrawResponse {
  withdrawal_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  reference: string;
  provider: string;
}
