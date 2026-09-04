import { Router } from 'express';
import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requirePermission } from '../../../core/rbac/index.js';
import * as controller from '../controller/holiday.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requirePermission('leave.self'),
  asyncHandler(controller.list)
);

router.post(
  '/',
  requirePermission('holiday.manage'),
  asyncHandler(controller.create)
);

router.put(
  '/:id',
  requirePermission('holiday.manage'),
  asyncHandler(controller.update)
);

router.delete(
  '/:id',
  requirePermission('holiday.manage'),
  asyncHandler(controller.deleteHoliday)
);

export const holidayRoutes = router;
