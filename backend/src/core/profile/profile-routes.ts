import { Router } from 'express';

import { requireAuth } from '../auth/auth-middleware.js';
import { UnauthorizedError } from '../errors/index.js';
import { asyncHandler } from '../http/asyncHandler.js';
import { profileService } from './profile-service.js';
import { updateProfileSchema } from './profile-validator.js';

const router = Router();

router.use(requireAuth);

/** GET /api/profile/me — fetch the current authenticated user's profile. */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.ctx) throw new UnauthorizedError();

    const user = await profileService.getProfile(req.ctx.user.id);
    res.status(200).json({ user });
  }),
);

/** PATCH /api/profile/me — update the current authenticated user's profile. */
router.patch(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.ctx) throw new UnauthorizedError();

    const input = updateProfileSchema.parse(req.body);
    const user = await profileService.updateProfile(req.ctx.user.id, input);
    res.status(200).json({ message: 'Profile updated successfully', user });
  }),
);

/** Alias GET /api/profile */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.ctx) throw new UnauthorizedError();

    const user = await profileService.getProfile(req.ctx.user.id);
    res.status(200).json({ user });
  }),
);

/** Alias PATCH /api/profile */
router.patch(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.ctx) throw new UnauthorizedError();

    const input = updateProfileSchema.parse(req.body);
    const user = await profileService.updateProfile(req.ctx.user.id, input);
    res.status(200).json({ message: 'Profile updated successfully', user });
  }),
);

export default router;
