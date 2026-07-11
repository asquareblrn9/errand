import apiClient, { extractData } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  Company,
  CompanyMember,
  CreateCompanyRequest,
  InviteMemberRequest,
} from "@/types/api/companies";

// ── Companies ──────────────────────────────────────────────

export const companiesApi = {
  create: (payload: CreateCompanyRequest) =>
    apiClient
      .post<ApiResponse<{ id: string }>>("/companies", payload)
      .then(extractData),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Company>>(`/companies/${id}`).then(extractData),

  getMembers: (id: string) =>
    apiClient
      .get<ApiResponse<CompanyMember[]>>(`/companies/${id}/members`)
      .then(extractData),

  invite: (id: string, payload: InviteMemberRequest) =>
    apiClient.post(`/companies/${id}/invite`, payload),
};
