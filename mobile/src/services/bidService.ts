import api from './api';
import type { ApiResponse } from '../types/api';
import type { BidItem } from '../types/request';

export const bidService = {
  submit: (requestId: string, data: { goods_amount: number; service_fee: number; note?: string; delivery_at?: string }) =>
    api.post<ApiResponse<BidItem>>(`/requests/${requestId}/bids`, data),
  getByRequest: (requestId: string) => api.get<ApiResponse<BidItem[]>>(`/requests/${requestId}/bids`),
  accept: (bidId: string) => api.post<ApiResponse<{ bid: BidItem }>>(`/bids/${bidId}/accept`),
  withdraw: (bidId: string) => api.delete(`/bids/${bidId}`),
  myBids: () => api.get<ApiResponse<BidItem[]>>('/my/bids'),
};
