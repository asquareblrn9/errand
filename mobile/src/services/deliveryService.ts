import api from './api';
import type { ApiResponse } from '../types/api';

export const deliveryService = {
  generateOtp: (bidId: string) => api.post<ApiResponse<{ otp: string; expires_in_minutes: number; expires_at: string }>>(`/deliveries/${bidId}/generate-otp`),
  confirm: (bidId: string, otp: string) => api.post<ApiResponse<{ delivery_id: string; confirmed_at: string; dispute_window_hours: number; dispute_window_closes_at: string }>>(`/deliveries/${bidId}/confirm`, { otp }),
  get: (bidId: string) => api.get<ApiResponse<{ id: string; confirmed: boolean; confirmed_at: string | null; dispute_window_closes_at: string | null }>>(`/deliveries/${bidId}`),
};
