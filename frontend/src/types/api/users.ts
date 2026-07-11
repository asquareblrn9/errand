// ── User ───────────────────────────────────────────────────

export type UserRole =
  | "requester"
  | "errander"
  | "company_admin"
  | "company_member"
  | "admin"
  | "super_admin";

export type UserStatus = "active" | "suspended" | "banned";

export interface UserData {
  id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  roles: string[];
  permissions: string[];
  status: UserStatus;
  kyc_tier: number;
  date_of_birth?: string | null;
  gender?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  two_factor_enabled: boolean;
  avatar_url: string | null;
  residential_address?: string | null;
  state?: string | null;
  lga?: string | null;
  is_online: boolean;
  completed_orders: number;
  member_since: string;
  created_at: string;
}

// ── Profile ────────────────────────────────────────────────

export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  device_type?: string;
  device_name?: string;
}

export interface AvatarUploadResponse {
  avatar_url: string;
}

// ── Public Profile ─────────────────────────────────────────

export interface PublicProfile {
  id: string;
  name: string;
  role: string;
  completed_orders: number;
  member_since: string;
  avatar_url?: string | null;
}

// ── Address ────────────────────────────────────────────────

export type AddressLabel = "home" | "work" | "other";

export interface Address {
  id: string;
  label: AddressLabel;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  postal_code?: string | null;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
  created_at: string;
}

export interface CreateAddressRequest {
  label: AddressLabel;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
}

export type UpdateAddressRequest = Partial<CreateAddressRequest>;
