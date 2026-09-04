// ── Requester home (GET /requester/home) ──────────────────
// Mirrors backend RequesterController::home() and
// frontend/src/types/api/requester.ts.

export interface RequesterStats {
  active_errands: number;
  arriving_today: number;
  spent_this_month: number;
  spent_change_pct: number;
  spent_lifetime: number;
  completed: number;
  avg_rating: number;
  total_ratings: number;
}

export interface RequesterChartPoint {
  label: string;
  amount: number;
}

export interface RequesterCategoryBreakdown {
  category_name: string;
  amount: number;
}

export interface RequesterActiveErrand {
  id: string;
  title: string;
  status: string;
  category_name: string | null;
  errander_name: string | null;
  escrow_amount: number | null;
  deadline_at: string | null;
  minutes_remaining: number | null;
}

export interface RequesterHomeData {
  stats: RequesterStats;
  chart_week: RequesterChartPoint[];
  category_breakdown: RequesterCategoryBreakdown[];
  active_errands: RequesterActiveErrand[];
}
