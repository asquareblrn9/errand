import { Platform } from 'react-native';
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/authService';
import api from '../services/api';
import type { UserData, LoginPayload, RegisterPayload } from '../types/api';

const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';

interface AuthState {
  user: UserData | null; token: string | null; refreshToken: string | null;
  isAuthenticated: boolean; isLoading: boolean; isBiometricEnabled: boolean;
  requiresEmailVerification: boolean; registeredEmail: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{ email: string }>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  restoreSession: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  setUser: (user: UserData) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null, token: null, refreshToken: null,
  isAuthenticated: false, isLoading: true, isBiometricEnabled: false,
  requiresEmailVerification: false, registeredEmail: null,

  login: async (payload) => {
    const { data } = await authService.login({ ...payload, device_type: deviceType });
    await SecureStore.setItemAsync('auth_token', data.data.token);
    await SecureStore.setItemAsync('refresh_token', data.data.refresh_token);
    set({ user: data.data.user, token: data.data.token, refreshToken: data.data.refresh_token, isAuthenticated: true, requiresEmailVerification: false });
  },

  register: async (payload) => {
    const { data } = await authService.register({ ...payload, device_type: deviceType });
    await SecureStore.setItemAsync('auth_token', data.data.token);
    if (data.data.refresh_token) await SecureStore.setItemAsync('refresh_token', data.data.refresh_token);
    const needsVerification = data.data.requires_email_verification ?? false;
    set({
      user: data.data.user,
      token: data.data.token,
      refreshToken: data.data.refresh_token ?? null,
      isAuthenticated: !needsVerification,
      requiresEmailVerification: needsVerification,
      registeredEmail: data.data.user.email,
    });
    return { email: data.data.user.email };
  },

  googleLogin: async (idToken: string) => {
    const { data } = await authService.googleLogin(idToken);
    await SecureStore.setItemAsync('auth_token', data.data.token);
    await SecureStore.setItemAsync('refresh_token', data.data.refresh_token);
    set({
      user: data.data.user,
      token: data.data.token,
      refreshToken: data.data.refresh_token,
      isAuthenticated: true,
      requiresEmailVerification: false,
    });
  },

  logout: async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const { data } = await authService.me();
      set({ user: data.data, isAuthenticated: true });
    } catch { await get().logout(); }
  },

  restoreSession: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
      set({ token, isLoading: true });
      try {
        const { data } = await authService.me();
        set({ user: data.data, isAuthenticated: true, isLoading: false });
      } catch {
        // Token invalid or API unreachable — clear and show login
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('refresh_token');
        set({ token: null, refreshToken: null, isLoading: false });
      }
    } else { set({ isLoading: false }); }
  },

  enableBiometric: async () => {
    set({ isBiometricEnabled: true });
    await SecureStore.setItemAsync('biometric_enabled', 'true');
  },

  setUser: (user) => set({ user }),

  fetchUser: async () => {
    try {
      const { data } = await api.get('/me');
      set({ user: data.data, isAuthenticated: true });
    } catch {
      // token may be expired — handled by interceptor
    }
  },
}));
