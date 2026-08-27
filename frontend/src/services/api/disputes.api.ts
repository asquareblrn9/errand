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
  create: (payload: CreateDisputeRequest, evidence: File[] = []) => {
    const formData = new FormData();
    formData.append("delivery_id", payload.delivery_id);
    formData.append("reason", payload.reason);
    formData.append("description", payload.description);
    evidence.forEach((file) => formData.append("evidence[]", file));
    return apiClient.post("/disputes", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

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
