import { z } from "zod";

// ── Create Request ─────────────────────────────────────────

export const createRequestSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title is too long"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description is too long"),
  category_id: z.string().uuid("Please select a category"),
  location: z
    .string()
    .min(3, "Location is required")
    .max(255, "Location is too long"),
  budget_hint: z
    .number()
    .min(100, "Budget must be at least ₦100")
    .max(10000000, "Budget seems too high")
    .nullable()
    .optional(),
  is_urgent: z.boolean().optional(),
});

export type CreateRequestFormData = z.infer<typeof createRequestSchema>;

// ── Update Request ─────────────────────────────────────────

export const updateRequestSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200)
    .optional(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000)
    .optional(),
  location: z.string().min(3).max(255).optional(),
  budget_hint: z
    .number()
    .min(100)
    .max(10000000)
    .nullable()
    .optional(),
});

export type UpdateRequestFormData = z.infer<typeof updateRequestSchema>;
