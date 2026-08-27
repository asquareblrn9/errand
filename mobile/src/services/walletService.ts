import api from './api';
import type { ApiResponse } from '../types/api';
import type { WalletData, Transaction } from '../types/wallet';

export type WalletFundingGateway = 'paystack' | 'flutterwave';

export interface FundWalletResult {
  reference: string;
  authorization_url: string;
  access_code?: string;
  provider: WalletFundingGateway;
}

export interface VerifyFundingResult {
  amount?: number;
  reference?: string;
  balance_after?: number;
  already_verified?: boolean;
  status?: 'pending';
}

export const walletService = {
  get: () => api.get<ApiResponse<WalletData>>('/wallet'),
  fund: (data: { amount: number; payment_gateway: WalletFundingGateway }) =>
    api.post<ApiResponse<FundWalletResult>>('/wallet/fund', data),
  verifyPayment: (reference: string, provider: WalletFundingGateway) =>
    api.post<ApiResponse<VerifyFundingResult>>('/wallet/verify-payment', { reference, provider }),
  transactions: () => api.get<ApiResponse<Transaction[]>>('/wallet/transactions'),
  withdraw: (data: { amount: number; bank_code: string; account_number: string; account_name: string; provider?: string }) =>
    api.post<ApiResponse<{ withdrawal_id: string; amount: number; fee: number; net_amount: number }>>('/wallet/withdraw', data),
};
