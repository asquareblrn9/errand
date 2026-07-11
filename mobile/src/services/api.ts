import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({ baseURL: BASE_URL, timeout: 30000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });

// Request interceptor — inject token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && !isRefreshing) {
      isRefreshing = true;
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          await SecureStore.setItemAsync('auth_token', data.data.token);
          await SecureStore.setItemAsync('refresh_token', data.data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.data.token}`;
          isRefreshing = false;
          return api.request(error.config);
        } catch { /* refresh failed */ }
      }
      isRefreshing = false;
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('refresh_token');
    }
    return Promise.reject(error);
  },
);

export default api;
