import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { requirePermission } from '../../core/rbac/index.js';
import { uploadSingle } from '../../core/files/index.js';
import { ValidationError } from '../../core/errors/index.js';
import { candidatesController } from './candidates.controller.js';

const router = Router();

// Wrapper to catch Multer errors and convert them to ValidationError
const handleMulterUpload = (req: any, res: any, next: any) => {
  const uploadMiddleware = uploadSingle('resume', ['application/pdf', 'image/jpeg', 'image/jpg']);
  uploadMiddleware(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File size exceeds the 5MB limit'));
      }
      return next(new ValidationError(err.message));
    }
    if (err) {
      return next(err); // Could be ValidationError thrown by fileFilter
    }
    next();
  });
};

router.post(
  '/',
  requireAuth,
  requirePermission('candidates.manage'),
  handleMulterUpload,
  asyncHandler(candidatesController.create)
);

router.get(
  '/',
  requireAuth,
  requirePermission('candidates.view'),
  asyncHandler(candidatesController.list)
);

router.get(
  '/:id',
  requireAuth,
  requirePermission('candidates.view'),
  asyncHandler(candidatesController.getById)
);

router.patch(
  '/:id',
  requireAuth,
  requirePermission('candidates.manage'),
  asyncHandler(candidatesController.update)
);

export default router;
