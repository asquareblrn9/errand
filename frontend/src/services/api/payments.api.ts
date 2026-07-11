import apiClient, { extractData, toQueryParams } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  PaymentData,
  PaymentQueryParams,
} from "@/types/api/payments";

// ── Payments ───────────────────────────────────────────────

export const paymentsApi = {
  initiate: (payload: InitiatePaymentRequest) =>
    apiClient
      .post<ApiResponse<InitiatePaymentResponse>>("/payments/initiate", payload)
      .then(extractData),

  getById: (id: string) =>
    apiClient.get<ApiResponse<PaymentData>>(`/payments/${id}`).then(extractData),

  getMyPayments: (params?: PaymentQueryParams) =>
    apiClient
      .get<ApiResponse<PaymentData[]>>(
        `/my/payments${toQueryParams(params ?? {})}`,
      )
      .then(extractData),
};
