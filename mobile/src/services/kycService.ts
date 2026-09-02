import api from './api';
import type { ApiResponse } from '../types/api';

export const kycService = {
  saveBankAccount: (data: { bank_name: string; bank_code: string; account_number: string; account_name: string }) =>
    api.post<ApiResponse<unknown>>('/kyc/bank-account', data),
};
