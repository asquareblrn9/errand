// ── API Response Envelope ──────────────────────────────────

/** Standard success response from the Laravel backend. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

/** Standard error response from the Laravel backend. */
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

// ── Pagination ─────────────────────────────────────────────

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page?: number;
  from?: number;
  to?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

// ── Cursor Pagination (Chat) ───────────────────────────────

export interface CursorParams {
  before_id?: string;
  limit?: number;
}

// ── Common Query Params ────────────────────────────────────

export interface SearchParams extends PaginationParams {
  search?: string;
}

export interface StatusParams {
  status?: string;
}

// ── Timestamps ─────────────────────────────────────────────

export interface Timestamps {
  created_at: string;
  updated_at?: string;
}

export interface SoftDeletes extends Timestamps {
  deleted_at?: string | null;
}

// ── Geo Coordinates ────────────────────────────────────────

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// ── Generic API Error ──────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Mutation Result ────────────────────────────────────────

export interface MutationResult<T = void> {
  success: boolean;
  message: string;
  data: T;
}
