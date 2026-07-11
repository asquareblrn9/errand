// ── Rating ─────────────────────────────────────────────────

export interface CreateRatingRequest {
  bid_id: string;
  rating: number;
  review?: string;
}

export interface RatingData {
  id: string;
  bid_id: string;
  rating: number;
  review: string | null;
  rater: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
  created_at: string;
}

export interface UserRatingsResponse {
  ratings: RatingData[];
  average: number;
  count: number;
}
