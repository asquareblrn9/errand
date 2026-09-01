// ── Errander home & earnings ───────────────────────────────

export interface ErranderChartPoint {
  label: string;
  amount: number;
}

export interface ErranderHomeData {
  availability: {
    is_online: boolean;
    last_location_update: string | null;
  };
  earnings: {
    today: number;
    yesterday: number;
    change_pct: number;
    this_week: number;
    this_week_jobs: number;
    chart_today: ErranderChartPoint[];
    chart_week: ErranderChartPoint[];
  };
  active_errand: {
    bid_id: string;
    request_id: string;
    title: string;
    requester_name: string;
    requester_first_name: string;
    total_amount: number;
    escrow_amount: number;
    status: string;
    progress_pct: number;
    state_label: string;
    delivery: {
      started_at: string | null;
      deadline_at: string | null;
      otp_generated: boolean;
      confirmed: boolean;
    };
  } | null;
  nearby: {
    id: string;
    title: string;
    category: string | null;
    location: string;
    budget_hint: number | null;
    is_urgent: boolean;
    urgent_fee: number | null;
    status: string;
    bids_count: number;
    requester: {
      id: string;
      name: string;
      completed_orders: number;
      rating: number | null;
    } | null;
    distance_km: number | null;
    created_at: string;
  }[];
  nearby_total: number;
  performance: {
    rating: number | null;
    completed_orders: number;
    accept_rate: number | null;
    on_time_pct: number | null;
    completion_rate: number | null;
    dispute_rate: number | null;
    trust_score: number | null;
  };
}

export interface ErranderEarningsData {
  lifetime_earnings: {
    total: number;
    jobs_count: number;
  };
  rating_breakdown: {
    average_rating: number;
    total: number;
    distribution: { stars: number; count: number }[];
  };
  bank_account: {
    bank_name: string;
    account_number: string;
    account_name: string;
  } | null;
}

export interface ErranderTrustScoreData {
  trust_score: number;
  tier: string;
  completed_orders: number;
  average_rating: number;
  completion_rate: number;
  on_time_percentage: number;
  accept_rate: number;
  total_value_handled: number;
}
