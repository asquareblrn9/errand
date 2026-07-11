import apiClient, { extractData, toQueryParams } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  AdminDashboardData,
  AdminUserListItem,
  AdminUserDetail,
  AdminUserQueryParams,
  BanUserRequest,
} from "@/types/api/admin";
import type { AdminKycUser } from "@/types/api/kyc";

// ── Admin ──────────────────────────────────────────────────

export const adminApi = {
  getDashboard: () =>
    apiClient
      .get<ApiResponse<AdminDashboardData>>("/admin/dashboard")
      .then(extractData),

  // ── Users ───────────────────────────────────────────────
  getUsers: (params?: AdminUserQueryParams) =>
    apiClient
      .get<ApiResponse<AdminUserListItem[]>>(
        `/admin/users${toQueryParams(params ?? {})}`,
      )
      .then(extractData),

  getUser: (id: string) =>
    apiClient
      .get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`)
      .then(extractData),

  suspendUser: (id: string) =>
    apiClient.put(`/admin/users/${id}/suspend`),

  activateUser: (id: string) =>
    apiClient.put(`/admin/users/${id}/activate`),

  banUser: (id: string, payload?: BanUserRequest) =>
    apiClient.put(`/admin/users/${id}/ban`, payload),

  // ── KYC ─────────────────────────────────────────────────
  // Note: Full KYC admin operations are in kyc.api.ts (adminKycApi)
  getKycPending: () =>
    apiClient
      .get<ApiResponse<AdminKycUser[]>>("/admin/kyc/pending")
      .then(extractData),
};
