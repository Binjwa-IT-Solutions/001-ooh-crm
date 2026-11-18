import { Schema, model, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

export const COMPLIANCE_CHECK_TYPES = [
  'executed_on_time',
  'deadlines_met',
  'proofs_complete',
  'gps_match',
  'payments_in_reconciled',
  'payments_out_reconciled',
] as const;

export type ComplianceCheckType = (typeof COMPLIANCE_CHECK_TYPES)[number];

export interface IAuditResult extends BaseDocument {
  campaignId: Types.ObjectId;
  checkType: ComplianceCheckType;
  passed: boolean;
  details: {
    summary: string;
    message?: string;
    failingItems?: Array<{ id: string; name?: string; reason?: string }>;
    metadata?: Record<string, unknown>;
  };
  checkedAt: Date;
}

const auditResultSchema = new Schema<IAuditResult>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    checkType: {
      type: String,
      enum: COMPLIANCE_CHECK_TYPES,
      required: true,
    },
    passed: {
      type: Boolean,
      required: true,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
    checkedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

auditResultSchema.plugin(basePlugin);
auditResultSchema.index({ campaignId: 1, checkType: 1 });

export const AuditResult = model<IAuditResult>('AuditResult', auditResultSchema);
