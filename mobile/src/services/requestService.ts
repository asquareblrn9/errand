import api from './api';
import type { ApiResponse } from '../types/api';
import type { RequestItem, RequestDetail, Category } from '../types/request';

export const requestService = {
  categories: () => api.get<ApiResponse<Category[]>>('/categories'),
  feed: (params?: Record<string, string>) => api.get<ApiResponse<RequestItem[]>>('/requests', { params }),
  getById: (id: string) => api.get<ApiResponse<RequestDetail>>(`/requests/${id}`),
  create: (data: any) => api.post<ApiResponse<RequestItem>>('/requests', data),
  update: (id: string, data: any) => api.put<ApiResponse<RequestItem>>(`/requests/${id}`, data),
  cancel: (id: string, reason?: string) => api.delete(`/requests/${id}`, { data: { reason } }),
  myRequests: (params?: Record<string, string>) => api.get<ApiResponse<RequestItem[]>>('/my/requests', { params }),
};
