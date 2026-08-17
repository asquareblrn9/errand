"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient, { extractData } from "@/services/api/client";
import type { ApiResponse } from "@/types/api/common";
import type { ErranderHomeData, ErranderEarningsData } from "@/types/api/errander";

export function useErranderHome(enabled = true) {
  return useQuery({
    queryKey: ["errander", "home"],
    queryFn: () =>
      apiClient.get<ApiResponse<ErranderHomeData>>("/errander/home").then(extractData),
    staleTime: 30 * 1000,
    enabled,
  });
}

export function useErranderEarnings(enabled = true) {
  return useQuery({
    queryKey: ["errander", "earnings"],
    queryFn: () =>
      apiClient
        .get<ApiResponse<ErranderEarningsData>>("/errander/earnings")
        .then(extractData),
    staleTime: 30 * 1000,
    enabled,
  });
}
