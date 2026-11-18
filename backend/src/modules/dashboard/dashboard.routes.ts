import { Router } from 'express';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { requireRole } from '../../core/rbac/index.js';
import { dashboardController } from './dashboard.controller.js';
import { getHrDashboard, getMyDashboard, getOpsDashboard } from './role-dashboards.service.js';

const router = Router();

router.get('/overview', requireAuth, asyncHandler(dashboardController.getOverview));

// Role dashboards — see role-dashboards.service.ts
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getMyDashboard(req.ctx!) });
  }),
);
router.get(
  '/hr',
  requireAuth,
  requireRole(['hr', 'admin']),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await getHrDashboard() });
  }),
);
router.get(
  '/ops',
  requireAuth,
  requireRole(['ops', 'admin', 'manager']),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await getOpsDashboard() });
  }),
);

export default router;
