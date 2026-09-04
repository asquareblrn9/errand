export interface ChartPoint { label: string; amount: number; }

/** GET /errander/earnings response shape (backend ErranderController::earningsSummary). */
export interface ErranderEarningsSummary {
  lifetime_earnings: { total: number; jobs_count: number };
  rating_breakdown: {
    average_rating: number;
    total: number;
    distribution: { stars: number; count: number }[];
  };
  bank_account: {
    bank_name: string;
    account_number: string; // already masked by the API (e.g. "****6789")
    account_name: string;
  } | null;
}

export interface ErranderEarnings {
  today: number;
  yesterday: number;
  change_pct: number;
  this_week: number;
  this_week_jobs: number;
  chart_today: ChartPoint[];
  chart_week: ChartPoint[];
}

export interface ActiveErrand {
  bid_id: string;
  request_id: string;
  title: string;
  requester_name: string;
  requester_first_name: string;
  total_amount: number;
  escrow_amount: number;
  status: 'accepted' | 'payment_made' | 'in_progress';
  progress_pct: number;
  state_label: string;
  delivery: {
    started_at: string | null;
    deadline_at: string | null;
    otp_generated: boolean;
    confirmed: boolean;
  } | null;
}

export interface NearbyRequest {
  id: string;
  title: string;
  category: string | null;
  location: string;
  budget_hint: number | null;
  is_urgent: boolean;
  urgent_fee: number;
  status: string;
  bids_count: number;
  requester: { id: string; name: string; completed_orders: number; rating: number | null } | null;
  created_at: string;
  distance_km?: number;
}

export interface ErranderPerformance {
  rating: number;
  completed_orders: number;
  accept_rate: number;
  on_time_pct: number;
  dispute_rate: number;
  trust_score: number;
}

export interface ErranderHomeData {
  availability: { is_online: boolean; last_location_update: string | null };
  earnings: ErranderEarnings;
  active_errand: ActiveErrand | null;
  nearby: NearbyRequest[];
  nearby_total: number;
  performance: ErranderPerformance;
}
