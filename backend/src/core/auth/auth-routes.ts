import { Router } from 'express';

import { asyncHandler } from '../http/asyncHandler.js';
import { requirePermission, requireRole } from '../rbac/index.js';
import { AuthController } from './auth-controller.js';
import { requireAuth } from './auth-middleware.js';
import { SecurityController } from './security-controller.js';

const router = Router();

// --- Public: the two-step login flow -----------------------------------------
router.post('/login', asyncHandler(AuthController.login));
router.post('/verify-otp', asyncHandler(AuthController.verifyOtp));
router.post('/resend-otp', asyncHandler(AuthController.resendOtp));
router.post('/email-fallback', asyncHandler(AuthController.requestEmailFallback));
router.post('/complete-mfa-enrollment', asyncHandler(AuthController.completeMfaEnrollment));
router.post('/refresh', asyncHandler(AuthController.refresh));

// Login approval status is polled by the same unauthenticated browser that
// started the challenge. Approval decisions require admin.
router.post(
  '/security/login-approvals/:id/status',
  asyncHandler(SecurityController.loginApprovalStatus),
);
router.get(
  '/security/login-events',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(SecurityController.listLoginEvents),
);
router.get(
  '/security/login-approvals',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(SecurityController.listLoginApprovals),
);
router.post(
  '/security/login-approvals/:id/decision',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(SecurityController.decideLoginApproval),
);

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

router.post(
  '/users/:id/reset-mfa',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(AuthController.resetUserMfa),
);

router.get(
  '/users/:id/security',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(SecurityController.userDeviceAndSessions),
);

router.post(
  '/users/:id/revoke-sessions',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(SecurityController.revokeUserSessions),
);

router.post(
  '/users/:id/remove-device',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(SecurityController.removeUserDevice),
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
