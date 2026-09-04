export interface ApiResponse<T = unknown> {
  success: boolean; data: T; message: string;
  meta?: { current_page: number; per_page: number; total: number };
}

export interface LoginPayload { login: string; password: string; device_name?: string; device_type?: string; }
export interface RegisterPayload { first_name: string; last_name: string; date_of_birth: string; email: string; phone: string; password: string; password_confirmation: string; role: 'requester' | 'errander'; device_type?: string; }
export interface AuthResponse {
  user?: UserData; token?: string; token_type?: string; refresh_token?: string; expires_at?: string;
  requires_email_verification?: boolean;
  /** 2FA challenge — tokens absent until /auth/login-2fa succeeds. */
  requires_2fa?: boolean;
  temp_token?: string;
}

export interface UserData {
  id: string; name: string; email: string; phone: string | null;
  role: 'requester' | 'errander'; status: string; kyc_tier: number;
  email_verified: boolean; phone_verified: boolean;
  avatar_url: string | null; completed_orders: number;
  member_since: string; created_at: string;
  residential_address?: string | null; state?: string | null;
  first_name?: string | null; last_name?: string | null;
  is_online?: boolean;
  two_factor_enabled?: boolean;
}
