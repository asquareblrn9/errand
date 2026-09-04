import api from './api';
import type { ApiResponse } from '../types/api';

/** Pending delivery extension (backend DeliveryController::formatPendingExtension). */
export interface PendingExtension {
  id: string;
  additional_minutes: number;
  reason: string;
  status: string;
  requested_by: { id: string; name: string | null } | null;
  created_at: string;
}

export interface DeliveryData {
  id: string;
  bid_id: string;
  confirmed: boolean;
  confirmed_at: string | null;
  started_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
  is_late: boolean;
  late_threshold_exceeded: boolean;
  minutes_remaining: number;
  sla_minutes: number;
  grace_period_minutes: number;
  late_fee_per_hour: number;
  late_fee_max: number;
  late_fee_accrued: number;
  dispute_window_hours: number;
  dispute_window_closes_at: string | null;
  requester_has_rated: boolean;
  requester_tipped: boolean;
  pending_extension: PendingExtension | null;
  bid: {
    id: string; status: string;
    goods_amount: number; service_fee: number; platform_fee: number; total_amount: number;
    delivery_at: string | null;
  };
  errander: { id: string; name: string | null };
  request: {
    id: string; title: string; description: string; location: string; status: string;
    requester: { id: string; name: string | null };
  };
}

export interface TimelineUpdate {
  id: string; type: string; message: string; user_id: string;
  latitude: number | null; longitude: number | null;
  photo_url: string | null; created_at: string;
}

export interface TimelineData {
  delivery_id: string;
  started_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
  is_late: boolean;
  minutes_remaining: number;
  late_fee_accrued: number;
  updates: TimelineUpdate[];
}

export const deliveryService = {
  generateOtp: (bidId: string) => api.post<ApiResponse<{ otp: string; expires_in_minutes: number; expires_at: string }>>(`/deliveries/${bidId}/generate-otp`),
  confirm: (bidId: string, otp: string) => api.post<ApiResponse<{ delivery_id: string; confirmed_at: string; dispute_window_hours: number; dispute_window_closes_at: string }>>(`/deliveries/${bidId}/confirm`, { otp }),
  get: (bidId: string) => api.get<ApiResponse<DeliveryData>>(`/deliveries/${bidId}`),
  timeline: (bidId: string) => api.get<ApiResponse<TimelineData>>(`/deliveries/${bidId}/timeline`),
  start: (bidId: string) => api.post(`/deliveries/${bidId}/start`),
  postUpdate: (bidId: string, type: string, message: string) =>
    api.post(`/deliveries/${bidId}/updates`, { type, message }),
  requestExtension: (bidId: string, additionalMinutes: number, reason: string) =>
    api.post(`/deliveries/${bidId}/extensions`, { additional_minutes: additionalMinutes, reason }),
  decideExtension: (extensionId: string, approved: boolean) =>
    api.post<ApiResponse<{ message: string }>>(`/deliveries/extensions/${extensionId}/decide`, { approved }),
  cancelDelivery: (bidId: string, reason: string) =>
    api.post<ApiResponse<{ message: string }>>(`/deliveries/${bidId}/cancel`, { reason }),
};
