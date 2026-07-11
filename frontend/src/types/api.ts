// Re-exports from the new typed API contracts — backward-compatible with existing code.

export type {
  ApiResponse,
  ApiErrorResponse as ApiError,
  PaginationMeta,
} from "./api/common";

export type {
  LoginRequest as LoginPayload,
  RegisterRequest as RegisterPayload,
  ForgotPasswordRequest as ForgotPasswordPayload,
  ResetPasswordRequest as ResetPasswordPayload,
  LoginResponse,
  RegisterResponse,
  RefreshTokenResponse as RefreshResponse,
} from "./api/auth";

export type { UserData } from "./api/users";
