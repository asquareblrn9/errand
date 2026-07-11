"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type {
  AdminUserQueryParams,
  BanUserRequest,
} from "@/types/api/admin";

// ── Admin Dashboard ────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.adminDashboard,
    queryFn: adminApi.getDashboard,
    staleTime: 60 * 1000,
  });
}

// ── Admin Users ────────────────────────────────────────────

export function useAdminUsers(params?: AdminUserQueryParams) {
  return useQuery({
    queryKey: queryKeys.adminUsers(params),
    queryFn: () => adminApi.getUsers(params),
    staleTime: 30 * 1000,
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: queryKeys.adminUser(id),
    queryFn: () => adminApi.getUser(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// ── Admin User Mutations ───────────────────────────────────

function invalidateAdmin(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin", "users"] });
}

export function useSuspendUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.suspendUser(id),
    onSuccess: () => invalidateAdmin(qc),
  });
}

export function useActivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.activateUser(id),
    onSuccess: () => invalidateAdmin(qc),
  });
}

export function useBanUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.banUser(id, reason ? { reason } : undefined),
    onSuccess: () => invalidateAdmin(qc),
  });
}

// ── KYC ────────────────────────────────────────────────────
// Note: Full admin KYC hooks (approve, reject, resubmission)
// are in @/hooks/queries/kyc/use-kyc.ts

export function useKycPending() {
  return useQuery({
    queryKey: queryKeys.adminKycPending,
    queryFn: adminApi.getKycPending,
    staleTime: 30 * 1000,
  });
}
