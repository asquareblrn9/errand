import { toast } from "@/store/toastStore";
import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "@/types/api/common";

// ── User-Friendly Error Messages ───────────────────────────

const ERROR_MESSAGES: Record<number, string> = {
  400: "Invalid request. Please check your input.",
  401: "Session expired. Please sign in again.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource was not found.",
  422: "Validation failed. Please check the form for errors.",
  429: "Too many requests. Please wait a moment.",
  500: "Server error. Please try again later.",
  503: "Service unavailable. Please try again shortly.",
};

// ── Error Handler ──────────────────────────────────────────

export function handleApiError(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again.",
): string {
  const axiosError = error as AxiosError<ApiErrorResponse>;

  // Network error
  if (!axiosError.response) {
    const message = "Network error. Please check your connection.";
    toast.error("Connection Error", message);
    return message;
  }

  const { status, data } = axiosError.response;
  const message =
    data?.message || ERROR_MESSAGES[status] || fallbackMessage;

  // Show toast for server errors
  if (status >= 500) {
    toast.error("Server Error", message);
  }

  return message;
}

/** Extract validation errors from a 422 response. */
export function getValidationErrors(
  error: unknown,
): Record<string, string> | null {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  if (axiosError.response?.status === 422 && axiosError.response.data?.errors) {
    const flat: Record<string, string> = {};
    for (const [key, messages] of Object.entries(
      axiosError.response.data.errors,
    )) {
      flat[key] = messages[0];
    }
    return flat;
  }
  return null;
}

/** Check if an error is a network/auth error that needs redirect. */
export function isAuthError(error: unknown): boolean {
  const axiosError = error as AxiosError;
  return axiosError.response?.status === 401;
}
