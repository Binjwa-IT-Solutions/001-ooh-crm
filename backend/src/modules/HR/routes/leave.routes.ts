import { Router } from 'express';
import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { uploadSingle } from '../../../core/files/index.js';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requirePermission } from '../../../core/rbac/index.js';
import * as controller from '../controller/leave.controller.js';

// ---------------------------------------------------------------------------
// 1. Leave Requests Router (mounted at /api/leave-requests)
// ---------------------------------------------------------------------------

export const leaveRoutes = Router();
leaveRoutes.use(requireAuth);

// Types & Balances shortcuts on /api/leave-requests
leaveRoutes.get('/types', requirePermission('leave.self'), asyncHandler(controller.getLeaveTypes));
leaveRoutes.post('/types', requirePermission('leave.manage'), asyncHandler(controller.createLeaveType));
leaveRoutes.get('/balance', requirePermission('leave.self'), asyncHandler(controller.getBalance));

// Request queries
leaveRoutes.get('/me', requirePermission('leave.self'), asyncHandler(controller.getMyRequests));
leaveRoutes.get('/team', requirePermission('leave.manage'), asyncHandler(controller.getTeamRequests));
leaveRoutes.get('/pending', requirePermission('leave.manage'), asyncHandler(controller.getTeamRequests));
leaveRoutes.get('/calendar', requirePermission('leave.self'), asyncHandler(controller.getCalendarLeaves));

// Request lifecycle actions
leaveRoutes.post('/:id/approve', requirePermission('leave.manage'), asyncHandler(controller.approveLeave));
leaveRoutes.patch('/:id/approve', requirePermission('leave.manage'), asyncHandler(controller.approveLeave));
leaveRoutes.post('/:id/reject', requirePermission('leave.manage'), asyncHandler(controller.rejectLeave));
leaveRoutes.patch('/:id/reject', requirePermission('leave.manage'), asyncHandler(controller.rejectLeave));
leaveRoutes.post('/:id/cancel', requirePermission('leave.self'), asyncHandler(controller.cancelLeave));
leaveRoutes.patch('/:id/cancel', requirePermission('leave.self'), asyncHandler(controller.cancelLeave));

// Request CRUD
leaveRoutes.get('/:id', requirePermission('leave.self'), asyncHandler(controller.getLeaveById));
leaveRoutes.patch('/:id', requirePermission('leave.self'), uploadSingle('attachment'), asyncHandler(controller.updateLeave));
leaveRoutes.put('/:id', requirePermission('leave.self'), uploadSingle('attachment'), asyncHandler(controller.updateLeave));
leaveRoutes.delete('/:id', requirePermission('leave.self'), asyncHandler(controller.deleteLeave));

leaveRoutes.get('/', requirePermission('leave.self'), asyncHandler(controller.listLeaveRequests));
leaveRoutes.post('/', requirePermission('leave.self'), uploadSingle('attachment'), asyncHandler(controller.applyLeave));

// Backwards compatibility alias
export const leaveRequestRoutes = leaveRoutes;

// ---------------------------------------------------------------------------
// 2. Leave Types Router (mounted at /api/leave-types)
// ---------------------------------------------------------------------------

export const leaveTypeRoutes = Router();
leaveTypeRoutes.use(requireAuth);

leaveTypeRoutes.get('/', requirePermission('leave.self'), asyncHandler(controller.listLeaveTypes));
leaveTypeRoutes.post('/', requirePermission('leave.manage'), asyncHandler(controller.createLeaveType));
leaveTypeRoutes.get('/:id', requirePermission('leave.self'), asyncHandler(controller.getLeaveTypeById));
leaveTypeRoutes.patch('/:id', requirePermission('leave.manage'), asyncHandler(controller.updateLeaveType));
leaveTypeRoutes.delete('/:id', requirePermission('leave.manage'), asyncHandler(controller.deleteLeaveType));

export default leaveTypeRoutes;

// ---------------------------------------------------------------------------
// 3. Leave Balances Router (mounted at /api/leave-balances)
// ---------------------------------------------------------------------------

export const leaveBalancesRouter = Router();
leaveBalancesRouter.use(requireAuth);

leaveBalancesRouter.post(
  '/allocate',
  requirePermission('leave.manage'),
  asyncHandler(controller.allocateBalance)
);

// ---------------------------------------------------------------------------
// 4. Employee Leave Balance Router (mounted at /api/employees)
// ---------------------------------------------------------------------------

export const employeeLeaveBalanceRouter = Router();
employeeLeaveBalanceRouter.use(requireAuth);

employeeLeaveBalanceRouter.get(
  '/:id/leave-balance',
  requirePermission('leave.self'),
  asyncHandler(controller.getEmployeeBalance)
);
