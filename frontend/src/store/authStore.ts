"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserData } from "@/types/user";
import api from "@/lib/api";
import type {
  ApiResponse,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
} from "@/types/api";

/** Set a cookie that the proxy can read for route protection. */
function setAuthCookie(token: string) {
  if (typeof document === "undefined") return;
  try {
    // Safari ITP may block client-side cookies; don't fail if it does
    document.cookie = `auth_token=${token}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    // Silently fail — cookie is a convenience, not a requirement
  }
}

function clearAuthCookie() {
  if (typeof document === "undefined") return;
  try {
    document.cookie = "auth_token=; path=/; max-age=0";
  } catch {
    // Silently fail
  }
}

/** Safely store a value in localStorage (Safari private browsing may throw). */
function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable (Safari private browsing)
  }
}

/** Safely remove a value from localStorage. */
function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage may be unavailable
  }
}

interface AuthState {
  user: UserData | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (payload: LoginPayload) => Promise<{ requires_2fa: boolean; temp_token: string } | undefined>;
  completeLogin2FA: (tempToken: string, code: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{ email: string } | undefined>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setUser: (user: UserData) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (payload: LoginPayload) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post<ApiResponse<LoginResponse>>(
            "/auth/login",
            payload,
          );

          // If 2FA is required, return the temp token to the caller
          if (data.data.requires_2fa && data.data.temp_token) {
            set({ isLoading: false });
            return { requires_2fa: true, temp_token: data.data.temp_token };
          }

          const { user, token, refresh_token } = data.data;

          if (!user || !token || !refresh_token) {
            throw new Error("Invalid login response");
          }

          safeSetItem("auth_token", token);
          safeSetItem("refresh_token", refresh_token);
          setAuthCookie(token);

          set({
            user,
            token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      completeLogin2FA: async (tempToken: string, code: string) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post<ApiResponse<LoginResponse>>(
            "/auth/login-2fa",
            { temp_token: tempToken, code },
          );

          const { user, token, refresh_token } = data.data;

          if (!user || !token || !refresh_token) {
            throw new Error("Invalid 2FA response");
          }

          safeSetItem("auth_token", token);
          safeSetItem("refresh_token", refresh_token);
          setAuthCookie(token);

          set({
            user,
            token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (payload: RegisterPayload) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post<ApiResponse<RegisterResponse>>(
            "/auth/register",
            payload,
          );

          const { user, token, requires_email_verification } = data.data;

          safeSetItem("auth_token", token);
          setAuthCookie(token);

          set({
            user,
            token,
            refreshToken: null,
            // User is not fully authenticated until email is verified
            isAuthenticated: !requires_email_verification,
            isLoading: false,
          });

          // Return the registered email for the verify-email page
          return { email: user.email };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      googleLogin: async (idToken: string) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post<ApiResponse<LoginResponse>>(
            "/auth/google",
            { id_token: idToken },
          );

          const { user, token, refresh_token } = data.data;

          if (!user || !token || !refresh_token) {
            throw new Error("Invalid Google login response");
          }

          safeSetItem("auth_token", token);
          safeSetItem("refresh_token", refresh_token);
          setAuthCookie(token);

          set({
            user,
            token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch {
          // Token may be expired — still clear state
        } finally {
          safeRemoveItem("auth_token");
          safeRemoveItem("refresh_token");
          clearAuthCookie();
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
          });
        }
      },

      fetchUser: async () => {
        const token = get().token;
        if (!token) return;

        set({ isLoading: true });
        try {
          const { data } = await api.get<ApiResponse<UserData>>("/me");
          set({ user: data.data, isAuthenticated: true, isLoading: false });
        } catch {
          safeRemoveItem("auth_token");
          safeRemoveItem("refresh_token");
          clearAuthCookie();
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      setUser: (user: UserData) => set({ user }),
      clearAuth: () => {
        safeRemoveItem("auth_token");
        safeRemoveItem("refresh_token");
        clearAuthCookie();
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "errand-boy-auth",
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
