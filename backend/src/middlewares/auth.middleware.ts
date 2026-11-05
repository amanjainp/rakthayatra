import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/crypto';
import prisma from '../config/database';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// Map demo roles to their corresponding seeded demo accounts
const DEMO_EMAILS: Record<string, string> = {
  DONOR: 'aman.jain@donor.org',
  HOSPITAL: 'apollo@lifelink.org',
  BLOOD_BANK: 'citybank@lifelink.org',
  ADMIN: 'admin@lifelink.org',
};

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token is missing or malformed.',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  // Fast-path demo token recognition for instant demo dashboard access
  if (token && token.startsWith('demo-token-')) {
    const rawRole = token.replace('demo-token-', '').toUpperCase();
    const role = rawRole === 'BLOODBANK' ? 'BLOOD_BANK' : rawRole;
    let resolvedUserId = `demo-${role.toLowerCase()}-user`;

    const demoEmail = DEMO_EMAILS[role];
    if (demoEmail) {
      try {
        const dbUser = await prisma.user.findUnique({ where: { email: demoEmail } });
        if (dbUser) {
          resolvedUserId = dbUser.id;
        }
      } catch {
        // Fallback to static demo id if database connection is pending
      }
    }

    req.user = { userId: resolvedUserId, role };
    (req.user as any).id = resolvedUserId;
    return next();
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token is invalid or has expired.',
      },
    });
  }

  req.user = payload;
  (req.user as any).id = payload.userId;
  return next();
}

export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token && token.startsWith('demo-token-')) {
      const rawRole = token.replace('demo-token-', '').toUpperCase();
      const role = rawRole === 'BLOODBANK' ? 'BLOOD_BANK' : rawRole;
      req.user = { userId: `demo-${role.toLowerCase()}-user`, role };
      (req.user as any).id = req.user.userId;
      return next();
    }
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
      (req.user as any).id = payload.userId;
    }
  }
  return next();
}

export function requireRoles(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      });
    }

    return next();
  };
}
