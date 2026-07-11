"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "@/services/api";
import type { InitiatePaymentRequest } from "@/types/api/payments";

// ── Payment Mutations ──────────────────────────────────────

export function useInitiatePaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InitiatePaymentRequest) => paymentsApi.initiate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}
