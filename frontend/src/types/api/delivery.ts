// ── Delivery ───────────────────────────────────────────────

export interface PendingExtension {
  id: string;
  additional_minutes: number;
  reason: string;
  status: string;
  requested_by: { id: string; name: string } | null;
  created_at: string;
}

export interface DeliveryData {
  id: string;
  bid_id: string;
  status: string;
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
  otp_generated_at: string | null;
  otp_expires_at: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  dispute_window_hours: number;
  dispute_window_closes_at: string | null;
  requester_has_rated: boolean;
  requester_tipped: boolean;
  pending_extension: PendingExtension | null;
  created_at: string;
  bid: {
    id: string;
    status: string;
    goods_amount: number;
    service_fee: number;
    platform_fee: number;
    total_amount: number;
    delivery_at: string | null;
  } | null;
  errander: { id: string; name: string } | null;
  request: {
    id: string;
    title: string;
    description: string;
    location: string;
    status: string;
    requester: { id: string; name: string } | null;
  } | null;
}

export interface DeliveryUpdateItem {
  id: string;
  type: string;
  message: string;
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  created_at: string;
}

export interface DeliveryTimeline {
  delivery_id: string;
  started_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
  is_late: boolean;
  minutes_remaining: number;
  late_fee_accrued: number;
  updates: DeliveryUpdateItem[];
}

export interface GenerateOtpResponse {
  otp: string;
  expires_in_minutes: number;
  expires_at: string;
}

export interface ConfirmDeliveryRequest {
  otp: string;
}

export interface ConfirmDeliveryResponse {
  delivery_id: string;
  confirmed_at: string;
  dispute_window_hours: number;
  dispute_window_closes_at: string;
}
