import { z } from "zod";

// ── Create Company ─────────────────────────────────────────

export const createCompanySchema = z.object({
  name: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(200, "Company name is too long"),
  industry: z.string().max(100).optional(),
  rc_number: z.string().max(50).optional(),
});

export type CreateCompanyFormData = z.infer<typeof createCompanySchema>;

// ── Invite Member ──────────────────────────────────────────

export const inviteMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "member", "finance", "viewer"]).optional(),
});

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;
