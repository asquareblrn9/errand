"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { disputesApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type {
  CreateDisputeRequest,
  RespondToDisputeRequest,
  DisputeQueryParams,
} from "@/types/api/disputes";

// ── Disputes ───────────────────────────────────────────────

export function useDispute(id: string) {
  return useQuery({
    queryKey: queryKeys.dispute(id),
    queryFn: () => disputesApi.getById(id),
    enabled: !!id,
  });
}

export function useMyDisputes(params?: DisputeQueryParams) {
  return useQuery({
    queryKey: queryKeys.myDisputes(params),
    queryFn: () => disputesApi.getMyDisputes(params),
    staleTime: 60 * 1000,
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useCreateDisputeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { payload: CreateDisputeRequest; evidence?: File[] }) =>
      disputesApi.create(vars.payload, vars.evidence),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-disputes"] });
      qc.invalidateQueries({ queryKey: ["disputes"] });
    },
  });
}

export function useRespondToDisputeMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RespondToDisputeRequest) =>
      disputesApi.respond(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dispute(id) });
    },
  });
}
