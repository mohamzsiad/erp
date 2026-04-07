// ── Pagination ────────────────────────────────────────────────────────────────
export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── API Responses ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export interface AuditInfo {
  createdAt: string;
  updatedAt: string;
  createdById?: string;
}

// ── Document Status ───────────────────────────────────────────────────────────
export type DocStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'POSTED'
  | 'REVERSED'
  | 'PAID'
  | 'PARTIAL';

// ── Lookup Item (used by search/dropdown APIs) ─────────────────────────────────
export interface LookupItem {
  id: string;
  code: string;
  name: string;
  [key: string]: unknown;
}
