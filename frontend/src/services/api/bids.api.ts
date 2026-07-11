import apiClient, { extractData, toQueryParams } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  BidData,
  CreateBidRequest,
  MyBidListItem,
  MyBidQueryParams,
} from "@/types/api/bids";

// ── Bids ───────────────────────────────────────────────────

export const bidsApi = {
  getForRequest: (requestId: string) =>
    apiClient
      .get<ApiResponse<BidData[]>>(`/requests/${requestId}/bids`)
      .then(extractData),

  create: (requestId: string, payload: CreateBidRequest) =>
    apiClient.post(`/requests/${requestId}/bids`, payload),

  accept: (bidId: string) =>
    apiClient.post(`/bids/${bidId}/accept`),

  withdraw: (bidId: string) =>
    apiClient.delete(`/bids/${bidId}`),

  getMyBids: (params?: MyBidQueryParams) =>
    apiClient
      .get<ApiResponse<MyBidListItem[]>>(`/my/bids${toQueryParams(params ?? {})}`)
      .then(extractData),
};
