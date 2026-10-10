import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../../config/index.js';
import '../context.js';
import { UnauthorizedError } from '../errors/index.js';
import { isRole, permissionsForRole, type Role } from '../rbac/permissions.js';
import { AuthUser } from './auth-model.js';

interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Verifies the access token and builds `req.ctx`. Every authenticated route
 * runs this before its permission guard.
 *
 * The signature alone would keep a token valid for its full lifetime, so each
 * request also checks the account: deactivated users and tokens issued before an
 * admin "sign out everywhere" are rejected immediately.
 */
export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Authentication required. No token provided.'));
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  let decoded: AccessTokenPayload;
  try {
    decoded = jwt.verify(token, config.jwt.secret) as AccessTokenPayload;
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
    return;
  }

  if (!isRole(decoded.role)) {
    next(new UnauthorizedError('Token carries an unknown role. Please sign in again.'));
    return;
  }

  const account = await AuthUser.findById(decoded.sub)
    .select('status deletedAt sessionsRevokedAt')
    .lean();
  if (!account || account.status !== 'Active' || account.deletedAt) {
    next(new UnauthorizedError('This account is inactive. Contact your administrator.'));
    return;
  }
  // `iat` has one-second resolution; compare in whole seconds.
  if (
    account.sessionsRevokedAt &&
    decoded.iat < Math.floor(account.sessionsRevokedAt.getTime() / 1000)
  ) {
    next(new UnauthorizedError('Your session was ended. Please sign in again.'));
    return;
  }

  const role: Role = decoded.role;

  req.ctx = {
    user: {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role,
      permissions: permissionsForRole(role),
    },
  };

  next();
};
