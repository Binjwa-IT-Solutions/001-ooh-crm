import { Router } from 'express';
import { requireAuth } from '../../../core/auth/auth-middleware.js';
import { requirePermission } from '../../../core/rbac/index.js';
import * as controller from '../controller/reports.controller.js';

export const reportsRoutes = Router();

reportsRoutes.use(requireAuth);

reportsRoutes.get('/attendance/daily', requirePermission('reports.view'), controller.getDailySummary);
reportsRoutes.get('/attendance/late', requirePermission('reports.view'), controller.getLateReport);
reportsRoutes.get('/attendance/monthly', requirePermission('reports.view'), controller.getMonthlyRegister);
reportsRoutes.get('/attendance/absence', requirePermission('reports.view'), controller.getAbsenceReport);
