import api from './api';
import type { ApiResponse } from '../types/api';
import type { WalletData, Transaction, WalletBankAccountStatus } from '../types/wallet';

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
  // Payouts go to the saved verified bank account — no bank fields needed
  withdraw: (data: { amount: number; provider?: string }) =>
    api.post<ApiResponse<{ withdrawal_id: string; amount: number; fee: number; net_amount: number }>>('/wallet/withdraw', data),
  getBankAccount: () => api.get<ApiResponse<WalletBankAccountStatus>>('/wallet/bank-account'),
  banks: (provider = 'flutterwave') =>
    api.get<ApiResponse<{ name: string; code: string }[]>>(`/wallet/banks?provider=${provider}`),
  resolveAccount: (account_number: string, bank_code: string) =>
    api.post<ApiResponse<{ account_name: string }>>('/wallet/resolve-account', { account_number, bank_code, provider: 'flutterwave' }),
};
