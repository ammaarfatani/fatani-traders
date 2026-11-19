import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    let token = req.cookies?.[config.cookieName];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new AppError('Session expired or invalid token. Please log in again.', 401);
    }

    if (!decoded.sessionId || !decoded.userId) {
      throw new AppError('Invalid session token payload', 401);
    }

    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new AppError('Session has expired. Please log in again.', 401);
    }

    if (!session.user || !session.user.isActive) {
      throw new AppError('Account is inactive or disabled. Contact administrator.', 403);
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
      sessionId: session.id,
    };

    next();
  } catch (err) {
    next(err);
  }
}
