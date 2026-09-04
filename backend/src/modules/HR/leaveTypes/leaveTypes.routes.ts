import { Router } from 'express';

import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requirePermission } from '../../../core/rbac/index.js';
import { LeaveTypesController } from './leaveTypes.controller.js';

/**
 * TRACK G — G3 · Leave Types, Quotas & Balances — routes.
 *
 * Every route declares a permission. No exceptions, including read-only ones.
 * Mounted at /api/leave-types in the app's route registry.
 */
const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('leave.self'), asyncHandler(LeaveTypesController.list));

router.post(
  '/',
  requirePermission('leave.manage'),
  asyncHandler(LeaveTypesController.create),
);

router.get(
  '/:id',
  requirePermission('leave.self'),
  asyncHandler(LeaveTypesController.getById),
);

router.patch(
  '/:id',
  requirePermission('leave.manage'),
  asyncHandler(LeaveTypesController.update),
);

router.delete(
  '/:id',
  requirePermission('leave.manage'),
  asyncHandler(LeaveTypesController.delete),
);

export default router;

/**
 * Balance-related routes hang off two different resources
 * (/api/employees/:id/leave-balance and /api/leave-balances/allocate),
 * not /api/leave-types itself. Exported as separate routers so the
 * top-level route registry can mount each at its correct path without
 * this module or the employee module importing each other's router.
 */
export const leaveBalancesRouter = Router();

leaveBalancesRouter.use(requireAuth);

leaveBalancesRouter.post(
  '/allocate',
  requirePermission('leave.manage'),
  asyncHandler(LeaveTypesController.allocate),
);

/**
 * Mount this one at /api/employees alongside the employee module's own
 * router — same pattern as employees.routes.ts mounting /:id/reports.
 */
export const employeeLeaveBalanceRouter = Router();

employeeLeaveBalanceRouter.use(requireAuth);

employeeLeaveBalanceRouter.get(
  '/:id/leave-balance',
  requirePermission('leave.self'),
  asyncHandler(LeaveTypesController.getEmployeeBalance),
);