import { Router } from 'express';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { requirePermission } from '../../core/rbac/index.js';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { LeadsController } from './leads.controller.js';

export const leadRoutes = Router();

// A1: Public Webhook Intake route (before requireAuth)
leadRoutes.post(
  '/intake',
  asyncHandler(LeadsController.intake),
);

// Protected routes
leadRoutes.use(requireAuth);

leadRoutes.get(
  '/',
  requirePermission('leads.view'),
  asyncHandler(LeadsController.list),
);

leadRoutes.post(
  '/',
  requirePermission('leads.create'),
  asyncHandler(LeadsController.create),
);

leadRoutes.get(
  '/agents',
  requirePermission('leads.view'),
  asyncHandler(LeadsController.listAgents),
);

leadRoutes.get(
  '/:id',
  requirePermission('leads.view'),
  asyncHandler(LeadsController.get),
);

leadRoutes.patch(
  '/:id',
  requirePermission('leads.update'),
  asyncHandler(LeadsController.update),
);

leadRoutes.patch(
  '/:id/status',
  requirePermission('leads.update'),
  asyncHandler(LeadsController.changeStatus),
);

leadRoutes.patch(
  '/:id/qualify',
  requirePermission('leads.update'),
  asyncHandler(LeadsController.qualify),
);

leadRoutes.post(
  '/:id/claim',
  requirePermission('leads.claim'),
  asyncHandler(LeadsController.claim),
);

leadRoutes.post(
  '/:id/log-call',
  requirePermission('leads.log_call'),
  asyncHandler(LeadsController.logCall),
);

leadRoutes.post(
  '/:id/follow-up',
  requirePermission('leads.log_call'),
  asyncHandler(LeadsController.logFollowUp),
);

leadRoutes.post(
  '/:id/approve',
  requirePermission('leads.update'),
  asyncHandler(LeadsController.managerApprove),
);

leadRoutes.get(
  '/:id/activity',
  requirePermission('leads.view'),
  asyncHandler(LeadsController.getActivity),
);
