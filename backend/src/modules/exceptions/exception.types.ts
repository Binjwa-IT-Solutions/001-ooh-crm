export const EXCEPTION_TYPES = [
  'missing_or_rejected_proof',
  'campaign_past_deadline',
  'client_payment_outstanding',
  'vendor_payment_outstanding',
  'gps_mismatch',
  'failed_audit_check',
  'task_escalated_l3',
] as const;

export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export type ExceptionSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface IExceptionItem {
  id: string; // deterministic key e.g. "campaign:6aad..."
  type: ExceptionType;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  source: string; // 'Track E', 'Track D', 'Track F1', 'Track F2', 'Track H1', etc.
  entityType: 'campaign' | 'task' | 'proof' | 'purchase_order' | 'quotation' | 'audit_result';
  entityId: string;
  campaignId?: string;
  campaignName?: string;
  city?: string;
  amount?: number;
  occurredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  link: string;
  metadata?: Record<string, unknown>;
}

export interface ExceptionFilters {
  type?: string;
  city?: string;
  campaignId?: string;
  severity?: ExceptionSeverity;
  from?: Date;
  to?: Date;
  search?: string;
  includeAcknowledged?: boolean;
}

export interface ExceptionCountSummary {
  totalUnresolved: number;
  highSeverityCount: number;
  byType: Record<string, number>;
  cachedAt: Date;
}
