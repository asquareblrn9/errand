import type { PaginationParams, Timestamps } from "./common";

// ── Payment ────────────────────────────────────────────────

export type PaymentMethod = "wallet" | "card" | "bank_transfer";
export type PaymentStatus = "pending" | "successful" | "failed" | "refunded";

export interface InitiatePaymentRequest {
  bid_id: string;
  payment_method?: PaymentMethod;
  provider?: string;
}

export interface PaymentBreakdown {
  goods_amount: number;
  service_fee: number;
  platform_fee: number;
}

export interface InitiatePaymentResponse {
  payment_id: string;
  provider_ref: string;
  payment_url: string | null;
  amount: number;
  breakdown: PaymentBreakdown;
  status: PaymentStatus;
}

export interface PaymentData {
  id: string;
  bid_id: string;
  amount: number;
  breakdown: PaymentBreakdown;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  provider_ref?: string | null;
  created_at: string;
}

export interface PaymentQueryParams extends PaginationParams {
  status?: PaymentStatus;
}
