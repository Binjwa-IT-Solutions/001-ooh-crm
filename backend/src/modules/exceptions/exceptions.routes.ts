import { Router } from 'express';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { ExceptionsController } from './exceptions.controller.js';

export const exceptionsRoutes = Router();

exceptionsRoutes.use(requireAuth);

// GET /api/exceptions/count - Lightweight counter for navigation badge
exceptionsRoutes.get('/count', asyncHandler(ExceptionsController.count));

// GET /api/exceptions - List all operational exceptions with filters
exceptionsRoutes.get('/', asyncHandler(ExceptionsController.list));

// PATCH /api/exceptions/:id/acknowledge - Manager/Admin acknowledge exception
exceptionsRoutes.patch('/:id/acknowledge', asyncHandler(ExceptionsController.acknowledge));

export default exceptionsRoutes;
