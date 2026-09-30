import { Router } from 'express';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { requirePermission } from '../../core/rbac/index.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { AuditController } from './audit.controller.js';

export const auditRoutes = Router();

auditRoutes.use(requireAuth);
auditRoutes.use(requirePermission('audit.view'));

// GET /api/audit - List global audit logs with filters & pagination
auditRoutes.get('/', asyncHandler(AuditController.list));

// GET /api/audit/export - Export audit logs to CSV
auditRoutes.get('/export', asyncHandler(AuditController.exportCsv));

// GET /api/audit/:entity/:id - Audit history timeline for specific record
auditRoutes.get('/:entity/:id', asyncHandler(AuditController.getEntityLogs));

export default auditRoutes;
