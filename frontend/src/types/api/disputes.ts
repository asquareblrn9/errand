import type { PaginationParams } from "./common";

// ── Dispute ────────────────────────────────────────────────

export type DisputeStatus = "open" | "under_review" | "resolved" | "closed";

export interface DisputeData {
  id: string;
  delivery_id: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  errander_response: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  raised_by: DisputeParty | null;
  errander: DisputeParty | null;
  opened_at: string;
  evidence: DisputeEvidenceItem[];
}

export interface DisputeEvidenceItem {
  id: string;
  type: "image" | "video";
  url: string;
  uploaded_by: string;
  created_at: string;
}

export interface DisputeParty {
  id: string;
  name: string;
}

export interface DisputeListItem {
  id: string;
  reason: string;
  status: DisputeStatus;
  raised_by: DisputeParty | null;
  errander: DisputeParty | null;
  opened_at: string;
}

// ── Create / Respond to Dispute ────────────────────────────

export interface CreateDisputeRequest {
  delivery_id: string;
  reason: string;
  description: string;
}

export interface RespondToDisputeRequest {
  response: string;
}

export interface DisputeQueryParams extends PaginationParams {
  status?: DisputeStatus;
}
