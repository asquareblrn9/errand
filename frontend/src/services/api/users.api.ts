import apiClient, { extractData } from "./client";
import type { ApiResponse } from "@/types/api/common";
import type {
  UserData,
  UpdateProfileRequest,
  AvatarUploadResponse,
  PublicProfile,
  Address,
  CreateAddressRequest,
  UpdateAddressRequest,
} from "@/types/api/users";

// ── Profile ────────────────────────────────────────────────

export const usersApi = {
  getMe: () =>
    apiClient.get<ApiResponse<UserData>>("/me").then(extractData),

  updateProfile: (payload: UpdateProfileRequest) =>
    apiClient.put<ApiResponse<UserData>>("/me", payload).then(extractData),

  deleteAccount: () =>
    apiClient.delete("/me"),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return apiClient
      .post<ApiResponse<AvatarUploadResponse>>("/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(extractData);
  },

  // ── Public Profile ──────────────────────────────────────
  getPublicProfile: (userId: string) =>
    apiClient
      .get<ApiResponse<PublicProfile>>(`/users/${userId}/profile`)
      .then(extractData),

  // ── Addresses ───────────────────────────────────────────
  getAddresses: () =>
    apiClient.get<ApiResponse<Address[]>>("/me/addresses").then(extractData),

  getAddress: (id: string) =>
    apiClient
      .get<ApiResponse<Address>>(`/me/addresses/${id}`)
      .then(extractData),

  createAddress: (payload: CreateAddressRequest) =>
    apiClient.post("/me/addresses", payload),

  updateAddress: (id: string, payload: UpdateAddressRequest) =>
    apiClient.put(`/me/addresses/${id}`, payload),

  deleteAddress: (id: string) =>
    apiClient.delete(`/me/addresses/${id}`),
};
