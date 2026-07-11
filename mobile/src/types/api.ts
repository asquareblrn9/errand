export interface ApiResponse<T = unknown> {
  success: boolean; data: T; message: string;
  meta?: { current_page: number; per_page: number; total: number };
}

export interface LoginPayload { login: string; password: string; device_name?: string; device_type?: string; }
export interface RegisterPayload { name: string; email: string; phone: string; password: string; password_confirmation: string; role: 'requester' | 'errander'; }
export interface AuthResponse { user: UserData; token: string; token_type: string; refresh_token: string; expires_at: string; }

export interface UserData {
  id: string; name: string; email: string; phone: string | null;
  role: 'requester' | 'errander'; status: string; kyc_tier: number;
  email_verified: boolean; phone_verified: boolean;
  avatar_url: string | null; completed_orders: number;
  member_since: string; created_at: string;
}
