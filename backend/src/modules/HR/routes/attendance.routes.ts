import { Router } from 'express';
import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { requirePermission } from '../../../core/rbac/index.js';
import * as controller from '../controller/attendance.controller.js';

export const attendanceRoutes = Router();

// Routes for Attendance
attendanceRoutes.use(requireAuth);

attendanceRoutes.post('/check-in', requirePermission('attendance.self'), controller.checkIn);
attendanceRoutes.post('/check-out', requirePermission('attendance.self'), controller.checkOut);
attendanceRoutes.get('/me', requirePermission('attendance.self'), controller.getMine);
attendanceRoutes.get('/me/summary', requirePermission('attendance.self'), controller.getMineSummary);
attendanceRoutes.get('/team', requirePermission('attendance.view_team'), controller.getTeam);
