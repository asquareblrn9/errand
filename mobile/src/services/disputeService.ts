import api from './api';
import type { ApiResponse } from '../types/api';

export interface DisputeCreatedData {
  id: string;
  status: string;
  reason: string;
  evidence_count: number;
  created_at: string;
}

export interface DisputeEvidenceFile {
  uri: string;
  name: string;
  type: string;
}

export const disputeService = {
  myDisputes: () => api.get('/my/disputes'),
  getById: (id: string) => api.get(`/disputes/${id}`),
  create: (data: {
    delivery_id: string;
    bid_id?: string;
    request_id?: string;
    reason: string;
    description: string;
    evidence?: DisputeEvidenceFile[];
  }) => {
    const fd = new FormData();
    fd.append('delivery_id', data.delivery_id);
    if (data.bid_id) fd.append('bid_id', data.bid_id);
    if (data.request_id) fd.append('request_id', data.request_id);
    fd.append('reason', data.reason);
    fd.append('description', data.description);
    for (const file of data.evidence ?? []) {
      fd.append('evidence', file as any);
    }
    return api.post<ApiResponse<DisputeCreatedData>>('/disputes', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  respond: (id: string, response: string) => api.post(`/disputes/${id}/respond`, { response }),
};
