import apiClient, { extractData, toQueryParams } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  PaymentData,
  PaymentQueryParams,
} from "@/types/api/payments";

// ── Payments ───────────────────────────────────────────────

export interface PaymentProvidersResponse {
  providers: string[];
  default: string;
}

export const paymentsApi = {
  initiate: (payload: InitiatePaymentRequest) =>
    apiClient
      .post<ApiResponse<InitiatePaymentResponse>>("/payments/initiate", payload)
      .then(extractData),

  getProviders: () =>
    apiClient
      .get<ApiResponse<PaymentProvidersResponse>>("/payments/providers")
      .then(extractData),

  verifyByRef: (providerRef: string) =>
    apiClient
      .get<ApiResponse<{ status: string; failure_reason?: string }>>(
        `/payments/verify/${providerRef}`,
      )
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
