"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/services/api";
import { queryKeys } from "../query-keys";
import type { UpdateProfileRequest, CreateAddressRequest, UpdateAddressRequest } from "@/types/api/users";

// ── Profile ────────────────────────────────────────────────

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: usersApi.getMe,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfileRequest) => usersApi.updateProfile(payload),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.me, user);
    },
  });
}

export function useUploadAvatarMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.me, (old: unknown) =>
        old && typeof old === "object" ? { ...old, avatar_url: data.avatar_url } : old,
      );
    },
  });
}

// ── Public Profile ─────────────────────────────────────────

export function usePublicProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: () => usersApi.getPublicProfile(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Addresses ──────────────────────────────────────────────

export function useAddresses() {
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: usersApi.getAddresses,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddress(id: string) {
  return useQuery({
    queryKey: queryKeys.address(id),
    queryFn: () => usersApi.getAddress(id),
    enabled: !!id,
  });
}

export function useCreateAddressMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAddressRequest) => usersApi.createAddress(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
}

export function useUpdateAddressMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAddressRequest) => usersApi.updateAddress(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
}

export function useDeleteAddressMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deleteAddress(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
}
