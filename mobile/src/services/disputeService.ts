import api from './api';
import type { ApiResponse } from '../types/api';

export const disputeService = {
  myDisputes: () => api.get('/my/disputes'),
  getById: (id: string) => api.get(`/disputes/${id}`),
  create: (data: { delivery_id: string; reason: string; description: string }) => api.post('/disputes', data),
  respond: (id: string, response: string) => api.post(`/disputes/${id}/respond`, { response }),
};
