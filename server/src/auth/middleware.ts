import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from './utils.js';
import { Permission, UserRole, User } from '../models/User.js';

// Extend Express Request to include user info
declare module 'express' {
  interface Request {
    user?: JWTPayload;
  }
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const payload = verifyToken(token);

      // Validate that userId is a valid ObjectId string
      if (!payload.userId || typeof payload.userId !== 'string' || payload.userId.length !== 24) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }
}

/**
 * Optional authentication middleware
 * Sets req.user if token is valid, but doesn't fail if missing
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = verifyToken(token);
        req.user = payload;
      } catch {
        // Token invalid, but continue without user
      }
    }
    next();
  } catch {
    next();
  }
}

/**
 * Permission-based authorization middleware factory
 */
export function hasPermission(_permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const role = req.user.role as UserRole | undefined;
    if (!role) {
      res.status(403).json({ error: 'Insufficient permissions', requiredPermission: _permission });
      return;
    }

    const permissions = User.getPermissionsByRole(role);
    if (!permissions.includes(_permission)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        requiredPermission: _permission,
        userRole: role
      });
      return;
    }

    next();
  };
}

/**
 * Role-based authorization middleware factory
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
      return;
    }

    next();
  };
}
