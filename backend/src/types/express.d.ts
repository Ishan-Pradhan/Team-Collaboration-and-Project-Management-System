import 'express';

/**
 * Extends Express Request to include validated data
 * from validation middleware (e.g., Zod/Joi), so controllers
 * can safely use typed and trusted inputs.
 */

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
        cookies?: unknown;
      };
    }
  }
}

export {};
