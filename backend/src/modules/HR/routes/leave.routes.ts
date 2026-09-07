import { Router } from 'express';
import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requirePermission } from '../../../core/rbac/index.js';
import * as controller from '../controller/leave.controller.js';
import { uploadSingle } from '../../../core/files/index.js';

export const leaveRoutes = Router();

leaveRoutes.use(requireAuth);

leaveRoutes.get('/types', requirePermission('leave.self'), asyncHandler(controller.getLeaveTypes));
leaveRoutes.post('/types', requirePermission('leave.manage'), asyncHandler(controller.createLeaveType));

leaveRoutes.get('/balance', requirePermission('leave.self'), asyncHandler(controller.getBalance));

leaveRoutes.post('/', requirePermission('leave.self'), uploadSingle('attachment'), asyncHandler(controller.applyLeave));
leaveRoutes.get('/me', requirePermission('leave.self'), asyncHandler(controller.getMyRequests));

leaveRoutes.get('/team', requirePermission('leave.manage'), asyncHandler(controller.getTeamRequests));
leaveRoutes.get('/pending', requirePermission('leave.manage'), asyncHandler(controller.getTeamRequests));
leaveRoutes.post('/:id/approve', requirePermission('leave.manage'), asyncHandler(controller.approveLeave));
leaveRoutes.patch('/:id/approve', requirePermission('leave.manage'), asyncHandler(controller.approveLeave));
leaveRoutes.post('/:id/reject', requirePermission('leave.manage'), asyncHandler(controller.rejectLeave));
leaveRoutes.patch('/:id/reject', requirePermission('leave.manage'), asyncHandler(controller.rejectLeave));
leaveRoutes.patch('/:id/cancel', requirePermission('leave.self'), asyncHandler(controller.cancelLeave));
