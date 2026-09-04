import api from './api';
import type { ApiResponse } from '../types/api';

export interface KycStatusData {
  kyc_status: string;
  kyc_tier: number;
  kyc_submitted_at: string | null;
  kyc_approved_at: string | null;
  progress: number;
  steps: Record<string, boolean>;
  verifications: {
    id: string;
    type: string;
    status: string;
    rejection_reason: string | null;
    rejection_category: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    attempt: number;
    has_documents: boolean;
    documents: { id: string; type: string; url: string }[];
  }[];
}

export const kycService = {
  status: () => api.get<ApiResponse<KycStatusData>>('/kyc/status'),

  profile: (data: {
    first_name: string; last_name: string; middle_name?: string;
    date_of_birth: string; gender: 'male' | 'female' | 'other';
    residential_address: string; state: string; lga: string;
  }) => api.put<ApiResponse<KycStatusData>>('/kyc/profile', data),

  identity: (data: { document_type: string; document_number: string; front_image: { uri: string; name: string; type: string }; back_image?: { uri: string; name: string; type: string } }) => {
    const fd = new FormData();
    fd.append('document_type', data.document_type);
    fd.append('document_number', data.document_number);
    fd.append('front_image', data.front_image as any);
    if (data.back_image) fd.append('back_image', data.back_image as any);
    return api.post<ApiResponse<KycStatusData>>('/kyc/identity', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  selfie: (file: { uri: string; name: string; type: string }) => {
    const fd = new FormData();
    fd.append('selfie', file as any);
    return api.post<ApiResponse<KycStatusData>>('/kyc/selfie', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  saveBankAccount: (data: { bank_name: string; bank_code: string; account_number: string; account_name: string }) =>
    api.post<ApiResponse<unknown>>('/kyc/bank-account', data),

  emergencyContact: (data: { full_name: string; phone_number: string; relationship: string; other_relationship?: string }) =>
    api.post<ApiResponse<KycStatusData>>('/kyc/emergency-contact', data),

  submit: () => api.post<ApiResponse<KycStatusData>>('/kyc/submit'),
};
