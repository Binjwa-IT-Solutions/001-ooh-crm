import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { config } from '../../config/index.js';
import { AppError } from '../errors/index.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

/**
 * Central error handler. Every error in the app funnels through here so the
 * client always gets `{ error: { code, message, details? } }` and never a stack
 * trace or a raw driver message.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
      },
    });
    return;
  }

  // Duplicate key
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    const keys = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {});
    res.status(409).json({
      error: {
        code: 'DUPLICATE_KEY',
        message: keys.length
          ? `A record with this ${keys.join(', ')} already exists`
          : 'A record with these values already exists',
      },
    });
    return;
  }

  // Invalid ObjectId / BSON error
  if (
    err instanceof mongoose.Error.CastError ||
    (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'BSONError')
  ) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid ID format',
      },
    });
    return;
  }

  console.error('[unhandled error]', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      ...(config.isProduction ? {} : { details: String(err) }),
    },
  });
}
