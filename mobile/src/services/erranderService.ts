import api from './api';
import type { ApiResponse } from '../types/api';
import type { ErranderHomeData, ErranderEarningsSummary } from '../types/errander';

export const erranderService = {
  home: (params?: Record<string, string>) => api.get<ApiResponse<ErranderHomeData>>('/errander/home', { params }),
  earnings: () => api.get<ApiResponse<ErranderEarningsSummary>>('/errander/earnings'),
  setAvailability: (isOnline: boolean) =>
    api.post<ApiResponse<{ is_online: boolean; last_location_update: string | null }>>('/errander/availability', { is_online: isOnline }),
};
