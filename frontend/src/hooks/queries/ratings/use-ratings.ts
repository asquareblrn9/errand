"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ratingsApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type { CreateRatingRequest, SendTipRequest } from "@/types/api/ratings";

// ── Rating & Tip Mutations ─────────────────────────────────

export function useCreateRatingMutation(bidId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRatingRequest) => ratingsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.delivery(bidId) });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

export function useSendTipMutation(bidId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendTipRequest) => ratingsApi.sendTip(bidId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.delivery(bidId) });
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.transactions() });
    },
  });
}
