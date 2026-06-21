import type { Response } from 'express';

export const ok = <T>(
  res: Response,
  data: T | null = null,
  message = 'Success',
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    errors: null,
  });
};
