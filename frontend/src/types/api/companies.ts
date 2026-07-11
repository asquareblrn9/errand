import type { Timestamps } from "./common";

// ── Company ────────────────────────────────────────────────

export type CompanyRole = "admin" | "member" | "finance" | "viewer";

export interface Company {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  rc_number?: string | null;
  email?: string | null;
  phone?: string | null;
  owner: CompanyMember | null;
  members_count: number;
  status: string;
  created_at: string;
}

export interface CompanyMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: CompanyRole;
  department: string | null;
  spending_limit: number;
  status: string;
}

// ── Create Company ─────────────────────────────────────────

export interface CreateCompanyRequest {
  name: string;
  industry?: string;
  rc_number?: string;
  email?: string;
  phone?: string;
}

// ── Invite ─────────────────────────────────────────────────

export interface InviteMemberRequest {
  email: string;
  role?: CompanyRole;
  department?: string;
}
