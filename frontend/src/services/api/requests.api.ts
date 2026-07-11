import apiClient, { extractData, toQueryParams } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  Category,
  RequestData,
  RequestListItem,
  MyRequestListItem,
  CreateRequestRequest,
  UpdateRequestRequest,
  RequestQueryParams,
  MyRequestQueryParams,
} from "@/types/api/requests";

// ── Requests (Errands) ─────────────────────────────────────

export const requestsApi = {
  // ── Feed ────────────────────────────────────────────────
  getFeed: (params?: RequestQueryParams) =>
    apiClient
      .get<ApiResponse<RequestListItem[]>>(`/requests${toQueryParams(params ?? {})}`)
      .then(extractData),

  // ── CRUD ────────────────────────────────────────────────
  getById: (id: string) =>
    apiClient.get<ApiResponse<RequestData>>(`/requests/${id}`).then(extractData),

  create: (payload: CreateRequestRequest) =>
    apiClient
      .post<ApiResponse<{ id: string }>>("/requests", payload)
      .then(extractData),

  update: (id: string, payload: UpdateRequestRequest) =>
    apiClient.put(`/requests/${id}`, payload),

  delete: (id: string, reason?: string) =>
    apiClient.delete(`/requests/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`),

  // ── My Requests ─────────────────────────────────────────
  getMyRequests: (params?: MyRequestQueryParams) =>
    apiClient
      .get<ApiResponse<MyRequestListItem[]>>(`/my/requests${toQueryParams(params ?? {})}`)
      .then(extractData),
};

// ── Categories ─────────────────────────────────────────────

export const categoriesApi = {
  getAll: () =>
    apiClient.get<ApiResponse<Category[]>>("/categories").then(extractData),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Category>>(`/categories/${id}`).then(extractData),
};
