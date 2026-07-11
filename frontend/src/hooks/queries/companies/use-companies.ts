"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type {
  CreateCompanyRequest,
  InviteMemberRequest,
} from "@/types/api/companies";

// ── Company ────────────────────────────────────────────────

export function useCompany(id: string) {
  return useQuery({
    queryKey: queryKeys.company(id),
    queryFn: () => companiesApi.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyMembers(id: string) {
  return useQuery({
    queryKey: queryKeys.companyMembers(id),
    queryFn: () => companiesApi.getMembers(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useCreateCompanyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCompanyRequest) => companiesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useInviteMemberMutation(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberRequest) =>
      companiesApi.invite(companyId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
    },
  });
}
