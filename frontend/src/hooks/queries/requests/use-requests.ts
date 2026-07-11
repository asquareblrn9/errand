"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requestsApi, categoriesApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type { RequestQueryParams, MyRequestQueryParams, CreateRequestRequest, UpdateRequestRequest } from "@/types/api/requests";

// ── Feed ───────────────────────────────────────────────────

export function useFeed(params?: RequestQueryParams) {
  return useQuery({
    queryKey: queryKeys.feed(params),
    queryFn: () => requestsApi.getFeed(params),
    staleTime: 30 * 1000,
  });
}

// ── Categories ─────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: categoriesApi.getAll,
    staleTime: 10 * 60 * 1000, // 10 min
  });
}

// ── Request Detail ─────────────────────────────────────────

export function useRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.request(id),
    queryFn: () => requestsApi.getById(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// ── My Requests ────────────────────────────────────────────

export function useMyRequests(params?: MyRequestQueryParams) {
  return useQuery({
    queryKey: queryKeys.myRequests(params),
    queryFn: () => requestsApi.getMyRequests(params),
    staleTime: 30 * 1000,
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useCreateRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRequestRequest) => requestsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
    },
  });
}

export function useUpdateRequestMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateRequestRequest) => requestsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.request(id) });
    },
  });
}

export function useDeleteRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      requestsApi.delete(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
    },
  });
}
