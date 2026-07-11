"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionsApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type { SubscribeRequest } from "@/types/api/subscriptions";

// ── Plans & Subscription ───────────────────────────────────

export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans,
    queryFn: subscriptionsApi.getPlans,
    staleTime: 10 * 60 * 1000,
  });
}

export function useMySubscription() {
  return useQuery({
    queryKey: queryKeys.mySubscription,
    queryFn: subscriptionsApi.getCurrent,
    staleTime: 5 * 60 * 1000,
    retry: false, // 404 if no subscription yet — don't retry
  });
}

export function useSubscribeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubscribeRequest) =>
      subscriptionsApi.subscribe(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mySubscription });
    },
  });
}

export function useCancelSubscriptionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => subscriptionsApi.cancel(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mySubscription });
    },
  });
}
