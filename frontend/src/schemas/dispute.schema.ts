import { z } from "zod";

// ── Create Dispute ─────────────────────────────────────────

export const createDisputeSchema = z.object({
  delivery_id: z.string().uuid("Invalid delivery ID"),
  reason: z
    .string()
    .min(5, "Reason must be at least 5 characters")
    .max(200, "Reason is too long"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description is too long"),
});

export type CreateDisputeFormData = z.infer<typeof createDisputeSchema>;

// ── Respond to Dispute ─────────────────────────────────────

export const respondToDisputeSchema = z.object({
  response: z
    .string()
    .min(10, "Response must be at least 10 characters")
    .max(2000, "Response is too long"),
});

export type RespondToDisputeFormData = z.infer<typeof respondToDisputeSchema>;
