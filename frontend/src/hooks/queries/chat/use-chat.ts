"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type { SendMessageRequest, MessagesQueryParams } from "@/types/api/chat";

// ── Conversations ──────────────────────────────────────────

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: chatApi.getConversations,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000, // Poll every 30s for new messages
  });
}

// ── Messages ───────────────────────────────────────────────

export function useMessages(conversationId: string, params?: MessagesQueryParams) {
  return useQuery({
    queryKey: queryKeys.messages(conversationId, params),
    queryFn: () => chatApi.getMessages(conversationId, params),
    enabled: !!conversationId,
    staleTime: 0, // Always fetch fresh messages
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useSendMessageMutation(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessageRequest) =>
      chatApi.sendMessage(conversationId, payload),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.messages(conversationId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useMarkReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.markRead(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}
