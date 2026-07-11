import type { PaginationParams, Timestamps } from "./common";

// ── Wallet ─────────────────────────────────────────────────

export interface WalletData {
  id: string;
  balance: number;
  locked_balance: number;
  available_balance: number;
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

export type TransactionStatus = "pending" | "successful" | "failed";

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

export interface WithdrawRequest {
  amount: number;
  bank_code: string;
  account_number: string;
  account_name: string;
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
