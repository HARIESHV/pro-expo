import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;
  let code = 'INTERNAL_ERROR';
  let fieldErrors: Record<string, string[]> | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    code = err.code || code;
  }

  // Mongoose schema validation error -> 422 with safe, human-readable details
  if (err.name === 'ValidationError') {
    const mongooseErr = err as import('mongoose').Error.ValidationError;
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed. Please check your input.';
    fieldErrors = {};
    for (const [field, e] of Object.entries(mongooseErr.errors || {})) {
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(e.message);
    }
    const firstMessage = Object.values(mongooseErr.errors || {})[0]?.message;
    if (firstMessage) message = firstMessage;
    isOperational = true;
  }

  // Mongoose/Mongo duplicate key -> 409
  const dupCode = (err as { code?: number | string }).code;
  if (dupCode === 11000 || dupCode === '11000') {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue;
    message =
      keyValue && Object.keys(keyValue).some((k) => k.includes('email'))
        ? 'An account with this email already exists.'
        : 'A record with these details already exists.';
    isOperational = true;
  }

  // Database unreachable / replica-set election -> 503
  if (err.name === 'MongooseServerSelectionError') {
    statusCode = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'Database is temporarily unavailable. Please try again shortly.';
    isOperational = false; // still logged with stack for diagnosis
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  if (!isOperational) {
    logger.error({
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  const response = {
    success: false as boolean,
    message,
    code,
    ...(fieldErrors ? { errors: fieldErrors } : {}),
  };

  res.status(statusCode).json(response);
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};
