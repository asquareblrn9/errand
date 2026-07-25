import type { PaginationParams, Timestamps } from "./common";

// ── Bid ────────────────────────────────────────────────────

export type BidStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "payment_made"
  | "in_progress"
  | "completed";

export interface BidData {
  id: string;
  request_id: string;
  request_title: string;
  goods_amount: number;
  service_fee: number;
  platform_fee: number;
  total_amount: number;
  delivery_at: string | null;
  status: BidStatus;
  note?: string | null;
  errander?: BidErrander;
  created_at: string;
}

export interface BidErrander {
  id: string;
  name: string;
  completed_orders?: number;
  avatar_url?: string | null;
}

// ── Create Bid ─────────────────────────────────────────────

export interface CreateBidRequest {
  goods_amount: number;
  service_fee: number;
  delivery_at?: string;
  note?: string;
}

// ── My Bids ────────────────────────────────────────────────

export interface MyBidListItem {
  id: string;
  request_id: string;
  request_title: string;
  goods_amount: number;
  service_fee: number;
  platform_fee: number;
  total_amount: number;
  status: BidStatus;
  created_at: string;
}

export interface MyBidQueryParams extends PaginationParams {
  status?: BidStatus;
}
