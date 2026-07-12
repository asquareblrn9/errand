import type { UserData } from "./users";

// ── Google OAuth ─────────────────────────────────────────────

export interface GoogleLoginRequest {
  id_token: string;
  device_name?: string;
  device_type?: string;
}

// ── Login ──────────────────────────────────────────────────

export interface LoginRequest {
  login: string;
  password: string;
  device_name?: string;
  device_type?: string;
}

export interface LoginResponse {
  user?: UserData;
  token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_at?: string;
  requires_2fa?: boolean;
  temp_token?: string;
}

export interface Login2FARequest {
  temp_token: string;
  code: string;
}

// ── Register ───────────────────────────────────────────────

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  role: "requester" | "errander";
  device_name?: string;
  device_type?: string;
}

export interface RegisterResponse {
  user: UserData;
  token: string;
  token_type: string;
  requires_email_verification: boolean;
}

// ── Token Refresh ──────────────────────────────────────────

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  user: UserData;
  token: string;
  token_type: string;
  refresh_token: string;
  expires_at: string;
}

// ── Password Reset ─────────────────────────────────────────

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  password: string;
  password_confirmation: string;
}

// ── Email Verification ─────────────────────────────────────

export interface VerifyEmailRequest {
  code: string;
  email?: string;
}

// ── Phone Verification ─────────────────────────────────────

export interface VerifyPhoneRequest {
  code: string;
}

// ── Two-Factor Authentication ──────────────────────────────

export interface Enable2FAResponse {
  secret: string;
  qr_code_url: string;
  recovery_codes: string[];
}

export interface Verify2FARequest {
  code: string;
}

// ── Sessions ───────────────────────────────────────────────

export interface Session {
  id: string;
  name: string;
  device_type: string | null;
  device_name: string | null;
  ip_address: string | null;
  last_used_at: string | null;
  created_at: string;
  is_current: boolean;
}
