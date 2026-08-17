"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient, { extractData } from "@/services/api/client";
import type { ApiResponse } from "@/types/api/common";
import type { RequesterHomeData } from "@/types/api/requester";

export function useRequesterHome(enabled = true) {
  return useQuery({
    queryKey: ["requester", "home"],
    queryFn: () =>
      apiClient.get<ApiResponse<RequesterHomeData>>("/requester/home").then(extractData),
    staleTime: 30 * 1000,
    enabled,
  });
}
