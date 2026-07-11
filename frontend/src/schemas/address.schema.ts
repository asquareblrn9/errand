import { z } from "zod";

// ── Create Address ─────────────────────────────────────────

export const createAddressSchema = z.object({
  label: z.enum(["home", "work", "other"], {
    message: "Please select a label",
  }),
  address_line_1: z
    .string()
    .min(3, "Address is required")
    .max(255, "Address is too long"),
  address_line_2: z.string().max(255).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postal_code: z.string().max(20).optional(),
  is_default: z.boolean().optional(),
});

export type CreateAddressFormData = z.infer<typeof createAddressSchema>;

// ── Update Address ─────────────────────────────────────────

export const updateAddressSchema = createAddressSchema.partial();

export type UpdateAddressFormData = z.infer<typeof updateAddressSchema>;
