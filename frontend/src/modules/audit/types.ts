export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'export'
  | 'other';

export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditLogEntry {
  _id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  payload?: unknown;
  changes?: AuditChange[];
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AuditFilters {
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditListResponse {
  data: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
