import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import type { ApiResponse } from "@/types/api/common";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

// ── Axios Instance ─────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
});

// ── Safe localStorage helpers (Safari private browsing may throw) ──
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable (Safari private browsing)
  }
}

function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage may be unavailable
  }
}

// ── Request Interceptor ────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = safeGetItem("auth_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor ───────────────────────────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => response,
  async (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed && error.config) {
        const token = localStorage.getItem("auth_token");
        if (token && error.config.headers) {
          error.config.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient.request(error.config);
      }

      if (typeof window !== "undefined") {
        safeRemoveItem("auth_token");
        safeRemoveItem("refresh_token");
        if (!window.location.pathname.startsWith("/auth")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);

// ── Token Refresh ──────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeToRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function attemptTokenRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (!isRefreshing) {
    isRefreshing = true;
    const refreshToken = safeGetItem("refresh_token");

    if (!refreshToken) {
      isRefreshing = false;
      return false;
    }

    try {
      const { data } = await axios.post<
        ApiResponse<{ token: string; refresh_token: string }>
      >(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newToken = data.data.token;
      const newRefreshToken = data.data.refresh_token;

      safeSetItem("auth_token", newToken);
      safeSetItem("refresh_token", newRefreshToken);
      onTokenRefreshed(newToken);
      isRefreshing = false;
      return true;
    } catch {
      isRefreshing = false;
      return false;
    }
  }

  return new Promise((resolve) => {
    subscribeToRefresh(() => resolve(true));
  });
}

// ── Typed Helpers ──────────────────────────────────────────

/** Extract data from a successful API response. */
export function extractData<T>(response: AxiosResponse<ApiResponse<T>>): T {
  return response.data.data;
}

/** Build query string from params, omitting undefined values. */
export function toQueryParams(
  params: object,
): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export default apiClient;
