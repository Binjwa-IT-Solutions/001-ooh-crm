import { Router } from 'express';

import { config } from '../../config/index.js';
import { requireAuth } from '../auth/auth-middleware.js';
import { NotFoundError } from '../errors/index.js';
import { asyncHandler } from '../http/asyncHandler.js';
import { fileService } from './index.js';

/**
 * Serves files stored by the LOCAL adapter, so uploads are viewable during
 * development. Object storage serves its own signed URLs and never reaches
 * this route.
 *
 * Authentication is required — proof photos and employee documents are not
 * public just because they happen to be on disk.
 */
const router = Router();

router.get(
  '/*key',
  (req, _res, next) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  },
  requireAuth,
  asyncHandler(async (req, res) => {
    if (config.storage.driver !== 'local') {
      throw new NotFoundError('Files are served by object storage in this environment');
    }

    const segments = req.params.key;
    const key = Array.isArray(segments) ? segments.join('/') : String(segments);

    const buffer = await fileService.read(key);

    const lowerKey = key.toLowerCase();
    if (lowerKey.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (lowerKey.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (lowerKey.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (lowerKey.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (lowerKey.endsWith('.csv')) {
      res.setHeader('Content-Type', 'text/csv');
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }),
);

export default router;
