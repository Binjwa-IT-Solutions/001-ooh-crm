

import { Router } from 'express';

import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requirePermission } from '../../../core/rbac/index.js';

import { LeaveRequestController } from './leaveRequest.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requirePermission('leave.self'),
  asyncHandler(LeaveRequestController.list),
);

router.post(
  '/',
  requirePermission('leave.self'),
  asyncHandler(LeaveRequestController.create),
);

router.get(
  '/:id',
  requirePermission('leave.self'),
  asyncHandler(LeaveRequestController.getById),
);

router.post(
  '/:id/approve',
  requirePermission('leave.manage'),
  asyncHandler(LeaveRequestController.approve),
);

router.post(
  '/:id/reject',
  requirePermission('leave.manage'),
  asyncHandler(LeaveRequestController.reject),
);

export const leaveRequestRoutes = router;