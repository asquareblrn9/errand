"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bidsApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type { CreateBidRequest, MyBidQueryParams } from "@/types/api/bids";

// ── My Bids ────────────────────────────────────────────────

export function useMyBids(params?: MyBidQueryParams) {
  return useQuery({
    queryKey: queryKeys.myBids(params),
    queryFn: () => bidsApi.getMyBids(params),
    staleTime: 30 * 1000,
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useCreateBidMutation(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBidRequest) =>
      bidsApi.create(requestId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.request(requestId) });
      qc.invalidateQueries({ queryKey: ["my-bids"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

export function useAcceptBidMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bidId: string) => bidsApi.accept(bidId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["my-bids"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useWithdrawBidMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bidId: string) => bidsApi.withdraw(bidId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-bids"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}
