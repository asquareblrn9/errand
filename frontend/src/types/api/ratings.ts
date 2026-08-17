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

/** meta for GET /users/{id}/ratings — {average_rating, total} */
export interface UserRatingsMeta {
  average_rating: number | null;
  total: number;
}

export interface UserRatingItem {
  id: string;
  reviewer: { id: string; name: string };
  rating: number;
  review: string | null;
  response: string | null;
  created_at: string;
}
