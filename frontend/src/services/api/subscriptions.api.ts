import apiClient, { extractData } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  Plan,
  SubscriptionData,
  SubscribeRequest,
} from "@/types/api/subscriptions";

// ── Subscriptions ──────────────────────────────────────────

export const subscriptionsApi = {
  getPlans: () =>
    apiClient.get<ApiResponse<Plan[]>>("/plans").then(extractData),

  getCurrent: () =>
    apiClient
      .get<ApiResponse<SubscriptionData>>("/my/subscription")
      .then(extractData),

  subscribe: (payload: SubscribeRequest) =>
    apiClient.post("/subscriptions", payload),

  cancel: () =>
    apiClient.post("/subscriptions/cancel"),
};
