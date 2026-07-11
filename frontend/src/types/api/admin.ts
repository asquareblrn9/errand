import type { PaginationParams } from "./common";

// ── Admin Dashboard ────────────────────────────────────────

export interface AdminDashboardData {
  users: {
    total: number;
    active: number;
    requesters: number;
    erranders: number;
  };
  requests: {
    total: number;
    completed: number;
    completion_rate: number;
  };
  disputes: {
    pending: number;
  };
  finances: {
    total_payments: number;
    platform_revenue: number;
  };
}

// ── Admin User List ────────────────────────────────────────

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  kyc_tier: number;
  completed_orders: number;
  created_at: string;
}

export interface AdminUserListResponse {
  data: AdminUserListItem[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
  };
}

// ── Admin User Detail ──────────────────────────────────────

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  kyc_tier: number;
  email_verified: boolean;
  phone_verified: boolean;
  two_factor_enabled: boolean;
  completed_orders: number;
  wallet: { balance: number; locked: number } | null;
  addresses?: Array<{
    id: string;
    label: string;
    address_line_1: string;
    city: string;
    state: string;
  }>;
  created_at: string;
}

// ── Admin User Query ───────────────────────────────────────

export interface AdminUserQueryParams extends PaginationParams {
  role?: string;
  status?: string;
  search?: string;
}

// ── Admin Actions ──────────────────────────────────────────

export interface BanUserRequest {
  reason?: string;
}

// ── Admin KYC (from admin.api) ─────────────────────────────
// Note: Admin KYC types in kyc.ts are the canonical source.
// This file re-exports the admin-specific ones for convenience.

export type { AdminKycUser, AdminKycVerification, AdminKycDetail } from "./kyc";
