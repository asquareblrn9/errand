import apiClient, { extractData, toQueryParams } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  DisputeData,
  DisputeListItem,
  CreateDisputeRequest,
  RespondToDisputeRequest,
  DisputeQueryParams,
} from "@/types/api/disputes";

// ── Disputes ───────────────────────────────────────────────

export const disputesApi = {
  create: (payload: CreateDisputeRequest) =>
    apiClient.post("/disputes", payload),

  getById: (id: string) =>
    apiClient.get<ApiResponse<DisputeData>>(`/disputes/${id}`).then(extractData),

  getMyDisputes: (params?: DisputeQueryParams) =>
    apiClient
      .get<ApiResponse<DisputeListItem[]>>(
        `/my/disputes${toQueryParams(params ?? {})}`,
      )
      .then(extractData),

  respond: (id: string, payload: RespondToDisputeRequest) =>
    apiClient.post(`/disputes/${id}/respond`, payload),
};
