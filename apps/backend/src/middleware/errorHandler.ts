import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const correlationId = res.locals.correlationId || 'unavailable';
  const errorCode = err instanceof AppError
    ? `APP_${err.statusCode}`
    : err instanceof ZodError
      ? 'VALIDATION_ERROR'
      : err instanceof Prisma.PrismaClientKnownRequestError
        ? `PRISMA_${err.code}`
        : 'INTERNAL_ERROR';
  const rawTarget = err instanceof Prisma.PrismaClientKnownRequestError ? err.meta?.target : undefined;
  const conflictTarget = Array.isArray(rawTarget)
    ? rawTarget.filter((value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_]{1,40}$/.test(value)).join(',')
    : typeof rawTarget === 'string' && /^[a-zA-Z0-9_,. -]{1,80}$/.test(rawTarget) ? rawTarget : undefined;
  console.error(JSON.stringify({ level: 'error', errorCode, correlationId, method: req.method, path: req.path, ...(conflictTarget ? { conflictTarget } : {}) }));

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: errorCode,
      correlationId,
      message: err.message,
    });
  }

  if (err instanceof ZodError) {
    const formatted = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      code: errorCode,
      correlationId,
      message: 'Validation failed',
      errors: formatted,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        code: 'UNIQUE_CONFLICT',
        correlationId,
        message: 'A record with this unique value already exists.',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        code: errorCode,
        correlationId,
        message: 'Requested record was not found.',
      });
    }
  }

  return res.status(500).json({
    success: false,
    code: errorCode,
    correlationId,
    message: err.message || 'Internal server error',
  });
}
