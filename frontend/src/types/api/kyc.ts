// ── KYC Status ─────────────────────────────────────────────

export type KycStatus =
  | "draft"
  | "pending_review"
  | "under_review"
  | "approved"
  | "rejected"
  | "requires_resubmission";

export type KycVerificationType = "identity" | "selfie" | "bank" | "emergency_contact";

export type KycDocumentType = "nin" | "drivers_license" | "voters_card" | "international_passport";

export type Gender = "male" | "female" | "other";

export type Relationship = "parent" | "sibling" | "friend" | "spouse" | "other";

export type RejectionCategory =
  | "blurry_document"
  | "id_mismatch"
  | "invalid_info"
  | "expired_document"
  | "other";

// ── API Response Types ──────────────────────────────────────

export interface KycDocument {
  id: string;
  document_type: KycDocumentType;
  document_number: string;
  front_image_url: string | null;
  back_image_url: string | null;
  file_type: "image" | "pdf";
  created_at: string;
}

export interface KycBankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_verified: boolean;
}

export interface KycEmergencyContact {
  id: string;
  full_name: string;
  phone_number: string;
  relationship: Relationship;
}

export interface KycVerificationItem {
  id: string;
  type: KycVerificationType;
  status: KycStatus;
  rejection_reason: string | null;
  rejection_category: RejectionCategory | null;
  reviewed_at: string | null;
  review_notes: string | null;
  attempt: number;
  has_documents: boolean;
  documents: KycDocument[];
  bank_account: KycBankAccount | null;
  emergency_contact: KycEmergencyContact | null;
  created_at: string;
}

export interface KycSteps {
  profile: boolean;
  phone: boolean;
  email: boolean;
  identity: boolean;
  selfie: boolean;
  bank: boolean;
  emergency_contact: boolean;
}

export interface KycStatusResponse {
  kyc_status: KycStatus;
  kyc_tier: number;
  kyc_submitted_at: string | null;
  kyc_approved_at: string | null;
  progress: number;
  steps: KycSteps;
  verifications: KycVerificationItem[];
}

// ── Admin Types ─────────────────────────────────────────────

export interface AdminKycUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  kyc_status: KycStatus;
  kyc_tier: number;
  kyc_submitted_at: string | null;
  verifications: AdminKycVerification[];
}

export interface AdminKycVerification {
  id: string;
  type: KycVerificationType;
  status: KycStatus;
  attempt: number;
  documents: Pick<KycDocument, "id" | "document_type" | "document_number" | "front_image_url" | "back_image_url">[];
  created_at: string;
}

export interface AdminKycDetail {
  user: {
    id: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    role: string;
    status: string;
    kyc_status: KycStatus;
    kyc_tier: number;
    date_of_birth: string | null;
    gender: Gender | null;
    residential_address: string | null;
    state: string | null;
    lga: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    created_at: string;
  };
  kyc_status: KycStatusResponse;
}

// ── Request Types ───────────────────────────────────────────

export interface KycProfileRequest {
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string;
  gender: Gender;
  residential_address: string;
  state: string;
  lga: string;
}

export interface KycBankAccountRequest {
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
}

export interface KycEmergencyContactRequest {
  full_name: string;
  phone_number: string;
  relationship: Relationship;
  other_relationship?: string;
}

export interface AdminKycReviewAction {
  notes?: string;
}

export interface AdminKycRejectAction extends AdminKycReviewAction {
  reason: string;
  category: RejectionCategory;
}
