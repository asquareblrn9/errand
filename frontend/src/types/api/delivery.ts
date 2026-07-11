// ── Delivery ───────────────────────────────────────────────

export interface DeliveryData {
  id: string;
  bid_id: string;
  status: string;
  otp_generated_at: string | null;
  otp_expires_at: string | null;
  confirmed_at: string | null;
  dispute_window_hours: number;
  dispute_window_closes_at: string | null;
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
