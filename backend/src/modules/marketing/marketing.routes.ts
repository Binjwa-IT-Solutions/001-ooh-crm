import { Router } from 'express';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { MarketingController } from './marketing.controller.js';

export const marketingRoutes = Router();

marketingRoutes.use(requireAuth);

// 1. Daily Logs
marketingRoutes.post('/daily-logs', asyncHandler(MarketingController.submitDailyLog));
marketingRoutes.get('/daily-logs', asyncHandler(MarketingController.listDailyLogs));
marketingRoutes.get('/daily-logs/summary', asyncHandler(MarketingController.getManagerDailySummary));

// 2. Tasks & Content
marketingRoutes.post('/tasks', asyncHandler(MarketingController.createTask));
marketingRoutes.get('/tasks', asyncHandler(MarketingController.listTasks));
marketingRoutes.patch('/tasks/:id/status', asyncHandler(MarketingController.updateTaskStatus));
marketingRoutes.patch('/tasks/:id', asyncHandler(MarketingController.updateTask));

// 3. Budget & Spend
marketingRoutes.post('/budget', asyncHandler(MarketingController.setBudget));
marketingRoutes.get('/budget/:month', asyncHandler(MarketingController.getBudget));
marketingRoutes.post('/spend', asyncHandler(MarketingController.recordSpend));
marketingRoutes.get('/spend', asyncHandler(MarketingController.listSpends));

// 4. Leads & Attribution
marketingRoutes.post('/leads', asyncHandler(MarketingController.createLead));
marketingRoutes.get('/leads', asyncHandler(MarketingController.listLeads));
marketingRoutes.patch('/leads/:id/stage', asyncHandler(MarketingController.updateLeadStage));

// 5. Dashboard Overview
marketingRoutes.get('/overview', asyncHandler(MarketingController.getOverview));

export default marketingRoutes;
