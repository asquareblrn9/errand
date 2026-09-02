import apiClient, { extractData, toQueryParams } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  WalletData,
  WalletTransaction,
  TransactionQueryParams,
  FundWalletRequest,
  FundWalletResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  ResolveAccountRequest,
  ResolveAccountResponse,
  Bank,
  WalletBankAccountStatus,
  WithdrawRequest,
  WithdrawResponse,
} from "@/types/api/wallet";

// ── Wallet ─────────────────────────────────────────────────

export const walletApi = {
  get: () =>
    apiClient.get<ApiResponse<WalletData>>("/wallet").then(extractData),

  getBanks: (provider?: string) =>
    apiClient
      .get<ApiResponse<Bank[]>>(`/wallet/banks${provider ? `?provider=${provider}` : ""}`)
      .then(extractData),

  resolveAccount: (payload: ResolveAccountRequest) =>
    apiClient
      .post<ApiResponse<ResolveAccountResponse>>("/wallet/resolve-account", payload)
      .then(extractData),

  fund: (payload: FundWalletRequest) =>
    apiClient
      .post<ApiResponse<FundWalletResponse>>("/wallet/fund", payload)
      .then(extractData),

  verifyPayment: (payload: VerifyPaymentRequest) =>
    apiClient
      .post<ApiResponse<VerifyPaymentResponse>>("/wallet/verify-payment", payload)
      .then(extractData),

  getTransactions: (params?: TransactionQueryParams) =>
    apiClient
      .get<ApiResponse<WalletTransaction[]>>(
        `/wallet/transactions${toQueryParams(params ?? {})}`,
      )
      .then(extractData),

  withdraw: (payload: WithdrawRequest) =>
    apiClient
      .post<ApiResponse<WithdrawResponse>>("/wallet/withdraw", payload)
      .then(extractData),

  getBankAccount: () =>
    apiClient
      .get<ApiResponse<WalletBankAccountStatus>>("/wallet/bank-account")
      .then(extractData),
};
