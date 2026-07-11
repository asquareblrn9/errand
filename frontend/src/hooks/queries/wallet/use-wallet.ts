"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { walletApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type { FundWalletRequest, WithdrawRequest, TransactionQueryParams } from "@/types/api/wallet";

// ── Wallet ─────────────────────────────────────────────────

export function useWallet() {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: walletApi.get,
    staleTime: 30 * 1000,
  });
}

export function useTransactions(params?: TransactionQueryParams) {
  return useQuery({
    queryKey: queryKeys.transactions(params),
    queryFn: () => walletApi.getTransactions(params),
    staleTime: 30 * 1000,
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useFundWalletMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FundWalletRequest) => walletApi.fund(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useWithdrawMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WithdrawRequest) => walletApi.withdraw(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
