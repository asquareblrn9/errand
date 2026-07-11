import apiClient, { extractData } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  GoogleLoginRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  VerifyPhoneRequest,
  Enable2FAResponse,
  Verify2FARequest,
  Session,
} from "@/types/api/auth";

export const authApi = {
  googleLogin: (payload: GoogleLoginRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>("/auth/google", payload).then(extractData),

  login: (payload: LoginRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>("/auth/login", payload).then(extractData),

  register: (payload: RegisterRequest) =>
    apiClient.post<ApiResponse<RegisterResponse>>("/auth/register", payload).then(extractData),

  logout: () => apiClient.post("/auth/logout"),

  refresh: (payload: RefreshTokenRequest) =>
    apiClient.post<ApiResponse<RefreshTokenResponse>>("/auth/refresh", payload).then(extractData),

  forgotPassword: (payload: ForgotPasswordRequest) =>
    apiClient.post("/auth/forgot-password", payload),

  resetPassword: (payload: ResetPasswordRequest) =>
    apiClient.post("/auth/reset-password", payload),

  sendEmailVerification: () => apiClient.post("/auth/verify-email/send"),

  verifyEmail: (payload: VerifyEmailRequest) =>
    apiClient.post("/auth/verify-email", payload),

  sendPhoneVerification: () => apiClient.post("/auth/verify-phone/send"),

  verifyPhone: (payload: VerifyPhoneRequest) =>
    apiClient.post("/auth/verify-phone", payload),

  enable2FA: () =>
    apiClient.post<ApiResponse<Enable2FAResponse>>("/auth/enable-2fa").then(extractData),

  verify2FA: (payload: Verify2FARequest) =>
    apiClient.post("/auth/verify-2fa", payload),

  disable2FA: () => apiClient.post("/auth/disable-2fa"),

  getSessions: () =>
    apiClient.get<ApiResponse<Session[]>>("/auth/sessions").then(extractData),

  revokeSession: (id: string) => apiClient.delete(`/auth/sessions/${id}`),
};
