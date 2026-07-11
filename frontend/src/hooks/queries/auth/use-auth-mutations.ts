"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/services/api";
import { queryKeys } from "@/hooks/queries/query-keys";
import type {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  VerifyPhoneRequest,
  Verify2FARequest,
} from "@/types/api/auth";

// ── Auth Mutations ─────────────────────────────────────────

export function useLoginMutation() {
  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (payload: RegisterRequest) => authApi.register(payload),
  });
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: () => authApi.logout(),
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordRequest) =>
      authApi.forgotPassword(payload),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ResetPasswordRequest) =>
      authApi.resetPassword(payload),
  });
}

// ── Email Verification ──────────────────────────────────

export function useSendEmailVerificationMutation() {
  return useMutation({
    mutationFn: () => authApi.sendEmailVerification(),
  });
}

export function useVerifyEmailMutation() {
  return useMutation({
    mutationFn: (payload: VerifyEmailRequest) => authApi.verifyEmail(payload),
  });
}

// ── Phone Verification ───────────────────────────────────

export function useSendPhoneVerificationMutation() {
  return useMutation({
    mutationFn: () => authApi.sendPhoneVerification(),
  });
}

export function useVerifyPhoneMutation() {
  return useMutation({
    mutationFn: (payload: VerifyPhoneRequest) => authApi.verifyPhone(payload),
  });
}

// ── Two-Factor Authentication ─────────────────────────────

export function useEnable2FAMutation() {
  return useMutation({
    mutationFn: () => authApi.enable2FA(),
  });
}

export function useVerify2FAMutation() {
  return useMutation({
    mutationFn: (payload: Verify2FARequest) => authApi.verify2FA(payload),
  });
}

export function useDisable2FAMutation() {
  return useMutation({
    mutationFn: () => authApi.disable2FA(),
  });
}

// ── Sessions ──────────────────────────────────────────────

export function useGetSessionsQuery() {
  return useQuery({
    queryKey: [queryKeys.sessions || "sessions"],
    queryFn: () => authApi.getSessions(),
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.sessions || "sessions"] });
    },
  });
}
