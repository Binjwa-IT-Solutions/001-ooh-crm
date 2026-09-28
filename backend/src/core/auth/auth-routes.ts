import { Router } from 'express';

import { asyncHandler } from '../http/asyncHandler.js';
import { requirePermission } from '../rbac/index.js';
import { AuthController } from './auth-controller.js';
import { requireAuth } from './auth-middleware.js';

const router = Router();

// --- Public: the two-step login flow -----------------------------------------
router.post('/login', asyncHandler(AuthController.login));
router.post('/verify-otp', asyncHandler(AuthController.verifyOtp));
router.post('/resend-otp', asyncHandler(AuthController.resendOtp));
router.post('/refresh', asyncHandler(AuthController.refresh));

// --- Authenticated ------------------------------------------------------------
router.post('/logout', requireAuth, asyncHandler(AuthController.logout));
router.get('/me', requireAuth, asyncHandler(AuthController.me));

// --- User Management (RBAC-protected) ----------------------------------------
// Users are created and managed by authorized roles, not self-signup.
router.get(
  '/users',
  requireAuth,
  requirePermission('users.view'),
  asyncHandler(AuthController.listUsers),
);

router.post(
  '/users',
  requireAuth,
  requirePermission('users.create'),
  asyncHandler(AuthController.register),
);

router.get(
  '/users/:id',
  requireAuth,
  requirePermission('users.view'),
  asyncHandler(AuthController.getUserById),
);

router.patch(
  '/users/:id',
  requireAuth,
  requirePermission('users.update'),
  asyncHandler(AuthController.updateUser),
);

router.delete(
  '/users/:id',
  requireAuth,
  requirePermission('users.update'),
  asyncHandler(AuthController.deleteUser),
);

// Backward compatibility alias for user creation
router.post(
  '/register',
  requireAuth,
  requirePermission('users.create'),
  asyncHandler(AuthController.register),
);

export default router;

