export interface Category { id: string; name: string; slug: string; description?: string; dispute_window_hours: number; sla_target_minutes: number; }

export interface RequestItem {
  id: string; title: string; description: string;
  category: Category | null; location: string; latitude?: number; longitude?: number;
  budget_hint: number | null; status: string; is_urgent: boolean; urgent_fee: number;
  photos?: { id: string; url: string }[]; bids_count: number;
  requester: { id: string; name: string; completed_orders: number } | null;
  created_at: string; updated_at: string;
}

export interface RequestDetail extends RequestItem {
  bids?: BidItem[];
}

export interface BidItem {
  id: string; request_id: string;
  errander?: { id: string; name: string; completed_orders: number; trust_score?: number; average_rating?: number };
  goods_amount: number; service_fee: number; platform_fee: number; total_amount: number;
  delivery_at: string | null; status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  note?: string; created_at: string;
}
