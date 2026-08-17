"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deliveryApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type { ConfirmDeliveryRequest } from "@/types/api/delivery";

// ── Delivery ───────────────────────────────────────────────

export function useDelivery(bidId: string) {
  return useQuery({
    queryKey: queryKeys.delivery(bidId),
    queryFn: () => deliveryApi.get(bidId),
    enabled: !!bidId,
  });
}

export function useDeliveryTimeline(bidId: string) {
  return useQuery({
    queryKey: queryKeys.deliveryTimeline(bidId),
    queryFn: () => deliveryApi.getTimeline(bidId),
    enabled: !!bidId,
  });
}

export function usePostDeliveryUpdateMutation(bidId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof deliveryApi.postUpdate>[1]) =>
      deliveryApi.postUpdate(bidId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.delivery(bidId) });
    },
  });
}

export function useGenerateOtpMutation(bidId: string) {
  return useMutation({
    mutationFn: () => deliveryApi.generateOtp(bidId),
  });
}

export function useConfirmDeliveryMutation(bidId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConfirmDeliveryRequest) =>
      deliveryApi.confirm(bidId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.delivery(bidId) });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}
