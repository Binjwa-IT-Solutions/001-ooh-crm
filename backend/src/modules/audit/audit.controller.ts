import { Request, Response } from 'express';
import { auditService } from '../../core/audit/index.js';
import { listAuditQuerySchema, entityAuditQuerySchema } from './audit.validator.js';
import { ComplianceAuditService } from './compliance.service.js';

export class AuditController {
  /**
   * Run automated compliance checks across all campaigns or for a specific campaign.
   * POST /api/audit/run
   * Body: { campaignId?: string }
   */
  static async runAudit(req: Request, res: Response): Promise<void> {
    const { campaignId } = req.body || {};

    if (campaignId) {
      const results = await ComplianceAuditService.runForCampaign(campaignId);
      res.status(200).json({
        data: results,
        message: `Compliance audit completed for campaign with ${results.length} checks evaluated.`,
      });
      return;
    }

    const summary = await ComplianceAuditService.runAllCampaigns();
    res.status(200).json({
      data: summary,
      message: `Compliance audit completed across ${summary.totalCampaignsAudited} campaigns (${summary.totalChecksRun} total checks, ${summary.failingChecksCount} failing).`,
    });
  }

  /**
   * Fetch compliance check results for a specific campaign.
   * GET /api/audit/campaigns/:id
   */
  static async getCampaignAudit(req: Request, res: Response): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const results = await ComplianceAuditService.getCampaignAudit(String(id));
    res.status(200).json({ data: results });
  }

  /**
   * List global audit logs with filtering and pagination.
   */
  static async list(req: Request, res: Response): Promise<void> {
    const query = listAuditQuerySchema.parse(req.query);

    const filter: {
      entity?: string;
      entityId?: string;
      actorId?: string;
      action?: any;
      from?: Date;
      to?: Date;
    } = {};

    if (query.entity) filter.entity = query.entity;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.actorId) filter.actorId = query.actorId;
    if (query.action) filter.action = query.action;
    if (query.from) filter.from = query.from;
    if (query.to) filter.to = query.to;

    const result = await auditService.list(filter, {
      page: query.page,
      pageSize: query.pageSize,
    });

    res.status(200).json({
      data: result.entries,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  }

  /**
   * List audit history timeline for a specific entity record.
   */
  static async getEntityLogs(req: Request, res: Response): Promise<void> {
    const { entity, id } = req.params;
    const query = entityAuditQuerySchema.parse(req.query);

    const logs = await auditService.listForEntity(String(entity), String(id), query.limit);

    res.status(200).json({ data: logs });
  }

  /**
   * Export audit trail to CSV for compliance audits.
   */
  static async exportCsv(req: Request, res: Response): Promise<void> {
    const query = listAuditQuerySchema.parse(req.query);

    const filter: {
      entity?: string;
      entityId?: string;
      actorId?: string;
      action?: any;
      from?: Date;
      to?: Date;
    } = {};

    if (query.entity) filter.entity = query.entity;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.actorId) filter.actorId = query.actorId;
    if (query.action) filter.action = query.action;
    if (query.from) filter.from = query.from;
    if (query.to) filter.to = query.to;

    // Fetch up to 1000 records for CSV export
    const result = await auditService.list(filter, {
      page: 1,
      pageSize: 1000,
    });

    const headers = [
      'Timestamp (UTC)',
      'Timestamp (IST)',
      'Actor Email',
      'Actor Role',
      'Action',
      'Entity',
      'Entity ID',
      'HTTP Method',
      'Path',
      'Status Code',
      'IP Address',
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = result.entries.map((entry) => {
      const d = new Date(entry.createdAt);
      const utcStr = d.toISOString();
      const istStr = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      return [
        escapeCsv(utcStr),
        escapeCsv(istStr),
        escapeCsv(entry.actorEmail || 'System'),
        escapeCsv(entry.actorRole || 'N/A'),
        escapeCsv(entry.action),
        escapeCsv(entry.entity),
        escapeCsv(entry.entityId || ''),
        escapeCsv(entry.method || ''),
        escapeCsv(entry.path || ''),
        escapeCsv(entry.statusCode ?? ''),
        escapeCsv(entry.ip || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit_logs_${Date.now()}.csv"`,
    );
    res.status(200).send(csvContent);
  }
}
