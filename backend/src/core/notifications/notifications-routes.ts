import { Router } from 'express';

import { requireAuth } from '../auth/auth-middleware.js';
import { NotFoundError, UnauthorizedError } from '../errors/index.js';
import { asyncHandler } from '../http/asyncHandler.js';
import { notificationService } from './index.js';

/**
 * The bell in the header. Always scoped to the signed-in user — there is no
 * endpoint here that can read someone else's notifications.
 */
const router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.ctx) throw new UnauthorizedError();

    const result = await notificationService.listForUser(req.ctx.user.id, {
      unreadOnly: req.query.unread === 'true',
      limit: Number(req.query.limit) || 25,
    });

    res.status(200).json(result);
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    if (!req.ctx) throw new UnauthorizedError();

    await notificationService.markRead(req.ctx.user.id, String(req.params.id));
    res.status(200).json({ message: 'Marked as read' });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    if (!req.ctx) throw new UnauthorizedError();

    const count = await notificationService.markAllRead(req.ctx.user.id);
    res.status(200).json({ message: 'All marked as read', count });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.ctx) throw new UnauthorizedError();

    const deleted = await notificationService.deleteForUser(req.ctx.user.id, String(req.params.id));
    if (!deleted) {
      throw new NotFoundError('Notification not found');
    }

    res.status(200).json({ message: 'Notification deleted' });
  }),
);

export default router;
