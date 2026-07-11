import { z } from "zod";

// ── Submit Bid ─────────────────────────────────────────────

export const createBidSchema = z.object({
  goods_amount: z
    .number({ message: "Goods amount is required" })
    .min(1, "Goods amount is required"),
  service_fee: z
    .number({ message: "Service fee is required" })
    .min(500, "Service fee must be at least ₦500"),
  note: z.string().max(500, "Note is too long").optional(),
});

export type CreateBidFormData = z.infer<typeof createBidSchema>;
