import api from './api';
import type { ApiResponse } from '../types/api';

export interface SubmitRatingPayload {
  bid_id: string;
  rating: number;
  review?: string;
  tip?: number;
}

export interface RatingSubmissionResult {
  id: string;
  rating: number;
  is_visible: boolean;
  tip: number;
}

export interface TipResult {
  tip: { id: string; bid_id: string; amount: number; reference: string; created_at: string };
  available_balance: number;
}

export const ratingService = {
  submit: (payload: SubmitRatingPayload) =>
    api.post<ApiResponse<RatingSubmissionResult>>('/ratings', payload),
  sendTip: (bidId: string, amount: number) =>
    api.post<ApiResponse<TipResult>>(`/bids/${bidId}/tip`, { amount }),
};
