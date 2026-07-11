import { z } from "zod";

// ── Update Profile ─────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name is too long"),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number"),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
