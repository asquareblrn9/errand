import type { PaginationParams, Timestamps } from "./common";

// ── Plan ───────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  features: string[];
  limits: Record<string, number>;
}

// ── Subscription ───────────────────────────────────────────

export type BillingCycle = "monthly" | "annual";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";

export interface SubscriptionData {
  id: string;
  plan: Plan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  features: string[];
}

// ── Subscribe / Cancel ─────────────────────────────────────

export interface SubscribeRequest {
  plan_id: string;
  billing_cycle?: BillingCycle;
}
