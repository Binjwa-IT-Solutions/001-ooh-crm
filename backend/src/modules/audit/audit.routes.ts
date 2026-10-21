import { Router } from 'express';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { requirePermission } from '../../core/rbac/index.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { AuditController } from './audit.controller.js';

export const auditRoutes = Router();

auditRoutes.use(requireAuth);

// POST /api/audit/run - Admin / Audit trigger to run compliance checks across all campaigns or single campaign
auditRoutes.post('/run', requirePermission('audit.view'), asyncHandler(AuditController.runAudit));

// GET /api/audit/campaigns/:id - Fetch compliance check results for a campaign
auditRoutes.get(
  '/campaigns/:id',
  (req, res, next) => {
    const userRole = req.ctx?.user?.role;
    if (
      userRole === 'admin' ||
      userRole === 'manager' ||
      userRole === 'ops' ||
      userRole === 'finance'
    ) {
      return next();
    }
    return requirePermission('campaigns.view')(req, res, next);
  },
  asyncHandler(AuditController.getCampaignAudit),
);

// GET /api/audit - List global audit logs with filters & pagination
auditRoutes.get('/', requirePermission('audit.view'), asyncHandler(AuditController.list));

// GET /api/audit/workload/users - List all users with workload summary counts
auditRoutes.get('/workload/users', requirePermission('audit.view'), asyncHandler(AuditController.getWorkloadUsers));

// GET /api/audit/workload/:userId - Workload audit & performance breakdown for a single user
auditRoutes.get('/workload/:userId', requirePermission('audit.view'), asyncHandler(AuditController.getUserWorkload));

// GET /api/audit/export - Export audit logs to CSV
auditRoutes.get('/export', requirePermission('audit.view'), asyncHandler(AuditController.exportCsv));

// GET /api/audit/:entity/:id - Audit history timeline for specific record
auditRoutes.get('/:entity/:id', requirePermission('audit.view'), asyncHandler(AuditController.getEntityLogs));

export default auditRoutes;
