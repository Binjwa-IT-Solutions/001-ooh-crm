import { Router } from 'express';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { requirePermission } from '../../core/rbac/index.js';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { uploadSingle } from '../../core/files/index.js';
import { QuotationsController } from './quotations.controller.js';

export const quotationsRoutes = Router();

// --- Protected Internal Routes (/api/quotations) ---
quotationsRoutes.get('/', requireAuth, requirePermission('quotations.view'), asyncHandler(QuotationsController.list));
quotationsRoutes.post('/', requireAuth, requirePermission('quotations.create'), asyncHandler(QuotationsController.create));
quotationsRoutes.get('/:id', requireAuth, requirePermission('quotations.view'), asyncHandler(QuotationsController.get));
quotationsRoutes.patch('/:id', requireAuth, requirePermission('quotations.update'), asyncHandler(QuotationsController.update));
quotationsRoutes.post('/:id/pdf', requireAuth, requirePermission('quotations.view'), asyncHandler(QuotationsController.generatePdf));
quotationsRoutes.get('/:id/pdf', requireAuth, requirePermission('quotations.view'), asyncHandler(QuotationsController.getPdf));
quotationsRoutes.post('/:id/upload-pdf', requireAuth, requirePermission('quotations.update'), uploadSingle('file'), asyncHandler(QuotationsController.uploadPdf));
quotationsRoutes.post('/:id/send', requireAuth, requirePermission('quotations.update'), asyncHandler(QuotationsController.send));

// --- Public Client Proposal Routes (/q) ---
export const publicQuotationsRoutes = Router();
publicQuotationsRoutes.get('/:token', asyncHandler(QuotationsController.getPublicByToken));
publicQuotationsRoutes.post('/:token/accept', asyncHandler(QuotationsController.acceptPublic));
publicQuotationsRoutes.post('/:token/reject', asyncHandler(QuotationsController.rejectPublic));

export default quotationsRoutes;
