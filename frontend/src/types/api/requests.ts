import type { GeoPoint, PaginationParams, Timestamps } from "./common";

// ── Category ───────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  dispute_window_hours?: number;
  sla_target_minutes?: number;
  is_active?: boolean;
  sort_order?: number;
}

// ── Request (Errand) ───────────────────────────────────────

export type RequestStatus =
  | "draft"
  | "open"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "delivered"
  | "confirmed"
  | "escrow_hold"
  | "dispute_window"
  | "funds_released"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded"
  | "expired";

export interface RequestData {
  id: string;
  title: string;
  description: string;
  category: Category | null;
  category_id?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  status: RequestStatus;
  is_urgent: boolean;
  budget_hint: number | null;
  bids_count: number;
  requester: RequestRequester | null;
  photos?: RequestPhoto[];
  bids?: BidSummary[];
  company_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface RequestRequester {
  id: string;
  name: string;
  completed_orders?: number;
  avatar_url?: string | null;
}

export interface RequestPhoto {
  id: string;
  url: string;
  sort_order?: number;
}

// ── Create / Update Request ────────────────────────────────

export interface CreateRequestRequest {
  title: string;
  description: string;
  category_id: string;
  location: string;
  latitude: number;
  longitude: number;
  budget_hint?: number | null;
  is_urgent?: boolean;
  company_id?: string;
  photos?: File[];
}

export interface UpdateRequestRequest {
  title?: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  budget_hint?: number | null;
}

// ── Request List (Feed / My Requests) ──────────────────────

export interface RequestListItem {
  id: string;
  title: string;
  description: string;
  category: { id: string; name: string } | null;
  location: string;
  status: RequestStatus;
  is_urgent: boolean;
  budget_hint: number | null;
  bids_count: number;
  requester: { id: string; name: string } | null;
  created_at: string;
}

export interface MyRequestListItem {
  id: string;
  title: string;
  status: RequestStatus;
  is_urgent: boolean;
  category: { id: string; name: string } | null;
  location: string;
  budget_hint?: number | null;
  bids_count?: number;
  created_at: string;
}

// ── Request Query Params ───────────────────────────────────

export interface RequestQueryParams extends PaginationParams {
  category_id?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  budget_min?: number;
  budget_max?: number;
  urgent_only?: boolean;
}

export interface MyRequestQueryParams extends PaginationParams {
  status?: RequestStatus;
}

// ── Bid Summary (embedded in request) ──────────────────────

export interface BidSummary {
  id: string;
  goods_amount: number;
  service_fee: number;
  platform_fee: number;
  total_amount: number;
  delivery_at: string | null;
  status: string;
  note?: string;
  errander?: {
    id: string;
    name: string;
    completed_orders: number;
    avatar_url?: string | null;
  };
}
