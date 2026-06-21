import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ValidationError } from 'sequelize';
import { ApiError } from '../utils/ApiError.js';

type AppError = ApiError | Error | multer.MulterError | ValidationError;

const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = 500;
  let message = 'Something went wrong';
  let errors: unknown[] = [];

  // Handle known custom error
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors || [];
  }

  // Sequelize validation error
  else if (err instanceof ValidationError) {
    statusCode = 400;
    message = err.message;
    errors = err.errors.map((e) => ({
      message: e.message,
      field: e.path,
    }));
  }

  // Multer error
  else if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = err.message;
  }

  // Generic JS error
  else if (err instanceof Error) {
    message =
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Internal server error';
  }

  if (process.env.NODE_ENV !== 'production') {
    if (statusCode === 401) {
      console.warn(`[Auth Warning] ${message}`);
    } else {
      console.error(`[Error] ${message}`, err);
    }
  }

  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export { errorHandler };
