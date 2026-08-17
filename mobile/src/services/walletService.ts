import api from './api';
import type { ApiResponse } from '../types/api';
import type { WalletData, Transaction } from '../types/wallet';

export const walletService = {
  get: () => api.get<ApiResponse<WalletData>>('/wallet'),
  fund: (amount: number) => api.post<ApiResponse<{ reference: string; amount: number }>>('/wallet/fund', { amount }),
  transactions: () => api.get<ApiResponse<Transaction[]>>('/wallet/transactions'),
  withdraw: (data: { amount: number; bank_code: string; account_number: string; account_name: string; provider?: string }) =>
    api.post<ApiResponse<{ withdrawal_id: string; amount: number; fee: number; net_amount: number }>>('/wallet/withdraw', data),
};
