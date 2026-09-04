import api from './api';
import type { ApiResponse } from '../types/api';
import type { RequesterHomeData } from '../types/requester';

export const requesterService = {
  home: () => api.get<ApiResponse<RequesterHomeData>>('/requester/home'),
};
