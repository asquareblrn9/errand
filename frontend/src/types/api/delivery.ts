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
  pending_extension: PendingExtension | null;
  created_at: string;
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
