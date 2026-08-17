import apiClient, { extractData } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  DeliveryData,
  DeliveryTimeline,
  GenerateOtpResponse,
  ConfirmDeliveryRequest,
  ConfirmDeliveryResponse,
} from "@/types/api/delivery";

// ── Delivery ───────────────────────────────────────────────

export const deliveryApi = {
  get: (bidId: string) =>
    apiClient.get<ApiResponse<DeliveryData>>(`/deliveries/${bidId}`).then(extractData),

  generateOtp: (bidId: string) =>
    apiClient
      .post<ApiResponse<GenerateOtpResponse>>(`/deliveries/${bidId}/generate-otp`)
      .then(extractData),

  confirm: (bidId: string, payload: ConfirmDeliveryRequest) =>
    apiClient
      .post<ApiResponse<ConfirmDeliveryResponse>>(
        `/deliveries/${bidId}/confirm`,
        payload,
      )
      .then(extractData),

  getTimeline: (bidId: string) =>
    apiClient
      .get<ApiResponse<DeliveryTimeline>>(`/deliveries/${bidId}/timeline`)
      .then(extractData),

  postUpdate: (
    bidId: string,
    payload: {
      type:
        | "heading_to_pickup"
        | "item_purchased"
        | "on_the_way"
        | "traffic_delay"
        | "arrived"
        | "completed"
        | "custom";
      message: string;
      latitude?: number;
      longitude?: number;
    },
  ) =>
    apiClient.post(`/deliveries/${bidId}/updates`, payload),
};
