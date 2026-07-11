import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import type {
  KycStatusResponse,
  KycProfileRequest,
  KycBankAccountRequest,
  KycEmergencyContactRequest,
  AdminKycUser,
  AdminKycDetail,
  AdminKycReviewAction,
  AdminKycRejectAction,
} from "@/types/api/kyc";

// ── User KYC Endpoints ─────────────────────────────────────

export const kycApi = {
  /** Get the authenticated user's KYC status. */
  getStatus: () =>
    api.get<ApiResponse<KycStatusResponse>>("/kyc/status"),

  /** Update KYC profile (Step 1). */
  updateProfile: (data: KycProfileRequest) =>
    api.put<ApiResponse<KycStatusResponse>>("/kyc/profile", data),

  /** Submit identity documents (Step 4). */
  submitIdentity: (formData: FormData) =>
    api.post<ApiResponse<KycStatusResponse>>("/kyc/identity", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  /** Submit selfie (Step 5). */
  submitSelfie: (formData: FormData) =>
    api.post<ApiResponse<KycStatusResponse>>("/kyc/selfie", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  /** Save bank account (Step 6). */
  saveBankAccount: (data: KycBankAccountRequest) =>
    api.post<ApiResponse<KycStatusResponse>>("/kyc/bank-account", data),

  /** Save emergency contact (Step 7). */
  saveEmergencyContact: (data: KycEmergencyContactRequest) =>
    api.post<ApiResponse<KycStatusResponse>>("/kyc/emergency-contact", data),

  /** Submit KYC for review. */
  submit: () =>
    api.post<ApiResponse<KycStatusResponse>>("/kyc/submit"),
};

// ── Admin KYC Endpoints ────────────────────────────────────

export const adminKycApi = {
  /** List pending KYC reviews. */
  getPending: () =>
    api.get<ApiResponse<AdminKycUser[]>>("/admin/kyc/pending"),

  /** Get detailed KYC info for a user. */
  getDetail: (userId: string) =>
    api.get<ApiResponse<AdminKycDetail>>(`/admin/kyc/${userId}`),

  /** Approve a verification. */
  approve: (verificationId: string, data?: AdminKycReviewAction) =>
    api.post<ApiResponse<null>>(`/admin/kyc/${verificationId}/approve`, data),

  /** Reject a verification. */
  reject: (verificationId: string, data: AdminKycRejectAction) =>
    api.post<ApiResponse<null>>(`/admin/kyc/${verificationId}/reject`, data),

  /** Request resubmission. */
  requestResubmission: (verificationId: string, data: AdminKycRejectAction) =>
    api.post<ApiResponse<null>>(
      `/admin/kyc/${verificationId}/request-resubmission`,
      data,
    ),
};
