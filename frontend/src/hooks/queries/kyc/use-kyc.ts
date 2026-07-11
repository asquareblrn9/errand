"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kycApi, adminKycApi } from "@/services/api/kyc.api";
import { queryKeys } from "@/hooks/queries/query-keys";
import type { RejectionCategory } from "@/types/api/kyc";

// ── User KYC Hooks ─────────────────────────────────────────

export function useKycStatus() {
  return useQuery({
    queryKey: ["kyc", "status"],
    queryFn: async () => {
      const { data } = await kycApi.getStatus();
      return data.data;
    },
  });
}

export function useUpdateKycProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: kycApi.updateProfile,
    onSuccess: (res) => {
      qc.setQueryData(["kyc", "status"], res.data.data);
    },
  });
}

export function useSubmitKycIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: kycApi.submitIdentity,
    onSuccess: (res) => {
      qc.setQueryData(["kyc", "status"], res.data.data);
    },
  });
}

export function useSubmitKycSelfie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: kycApi.submitSelfie,
    onSuccess: (res) => {
      qc.setQueryData(["kyc", "status"], res.data.data);
    },
  });
}

export function useSaveBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: kycApi.saveBankAccount,
    onSuccess: (res) => {
      qc.setQueryData(["kyc", "status"], res.data.data);
    },
  });
}

export function useSaveEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: kycApi.saveEmergencyContact,
    onSuccess: (res) => {
      qc.setQueryData(["kyc", "status"], res.data.data);
    },
  });
}

export function useSubmitKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: kycApi.submit,
    onSuccess: (res) => {
      qc.setQueryData(["kyc", "status"], res.data.data);
    },
  });
}

// ── Admin KYC Hooks ────────────────────────────────────────

export function useAdminKycPending() {
  return useQuery({
    queryKey: queryKeys.adminKycPending,
    queryFn: async () => {
      const { data } = await adminKycApi.getPending();
      return data.data;
    },
  });
}

export function useAdminKycDetail(userId: string) {
  return useQuery({
    queryKey: queryKeys.adminKycDetail(userId),
    queryFn: async () => {
      const { data } = await adminKycApi.getDetail(userId);
      return data.data;
    },
    enabled: !!userId,
  });
}

interface KycApproveVars {
  verificationId: string;
  notes?: string;
}

export function useAdminKycApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ verificationId, notes }: KycApproveVars) =>
      adminKycApi.approve(verificationId, notes ? { notes } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminKycPending });
      qc.invalidateQueries({ queryKey: ["admin", "kyc"] });
    },
  });
}

interface KycRejectVars {
  verificationId: string;
  reason: string;
  category: RejectionCategory;
  notes?: string;
}

export function useAdminKycReject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ verificationId, reason, category, notes }: KycRejectVars) =>
      adminKycApi.reject(verificationId, { reason, category, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminKycPending });
      qc.invalidateQueries({ queryKey: ["admin", "kyc"] });
    },
  });
}

export function useAdminKycResubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ verificationId, reason, category, notes }: KycRejectVars) =>
      adminKycApi.requestResubmission(verificationId, {
        reason,
        category,
        notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminKycPending });
      qc.invalidateQueries({ queryKey: ["admin", "kyc"] });
    },
  });
}
