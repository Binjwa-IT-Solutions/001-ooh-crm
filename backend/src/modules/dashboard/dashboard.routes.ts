import { Router } from 'express';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { dashboardController } from './dashboard.controller.js';

const router = Router();

router.get('/overview', requireAuth, asyncHandler(dashboardController.getOverview));

export default router;
