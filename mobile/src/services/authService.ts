import api from './api';
import type { ApiResponse, LoginPayload, RegisterPayload, AuthResponse, UserData } from '../types/api';

export const authService = {
  googleLogin: (idToken: string) => api.post<ApiResponse<AuthResponse>>('/auth/google', { id_token: idToken }),
  login: (payload: LoginPayload) => api.post<ApiResponse<AuthResponse>>('/auth/login', payload),
  login2FA: (tempToken: string, code: string) => api.post<ApiResponse<AuthResponse>>('/auth/login-2fa', { temp_token: tempToken, code }),
  register: (payload: RegisterPayload) => api.post<ApiResponse<AuthResponse>>('/auth/register', payload),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<ApiResponse<UserData>>('/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { email: string; code: string; password: string; password_confirmation: string }) =>
    api.post('/auth/reset-password', data),
  sendEmailVerification: () => api.post('/auth/verify-email/send'),
  verifyEmail: (code: string, email?: string) => api.post('/auth/verify-email', { code, email }),
  sendPhoneVerification: () => api.post('/auth/verify-phone/send'),
  verifyPhone: (code: string) => api.post('/auth/verify-phone', { code }),
  enable2FA: () => api.post('/auth/enable-2fa'),
  verify2FA: (code: string) => api.post('/auth/verify-2fa', { code }),
  disable2FA: () => api.post('/auth/disable-2fa'),
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`),
};
