import apiClient, { extractData } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  CreateRatingRequest,
  SendTipRequest,
  TipData,
} from "@/types/api/ratings";

// ── Ratings & Tips ─────────────────────────────────────────

export interface RatingSubmissionResult {
  id: string;
  rating: number;
  is_visible: boolean;
  tip: number;
}

export interface TipSubmissionResult {
  tip: TipData;
  available_balance: number;
}

export const ratingsApi = {
  create: (payload: CreateRatingRequest) =>
    apiClient
      .post<ApiResponse<RatingSubmissionResult>>("/ratings", payload)
      .then(extractData),

  sendTip: (bidId: string, payload: SendTipRequest) =>
    apiClient
      .post<ApiResponse<TipSubmissionResult>>(`/bids/${bidId}/tip`, payload)
      .then(extractData),
};
