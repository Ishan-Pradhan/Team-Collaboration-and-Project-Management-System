import { ZodError, ZodType } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';

type Schema = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  cookies?: ZodType;
};

export const validate = (schema: Schema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.validated = req.validated || {};

      // Validate each part only if schema exists
      if (schema.body) {
        const parsedBody = schema.body.parse(req.body);
        req.body = parsedBody;
        req.validated.body = parsedBody;
      }

      if (schema.query) {
        const parsedQuery = schema.query.parse(req.query);
        req.validated.query = parsedQuery;
      }

      if (schema.params) {
        const parsedParams = schema.params.parse(req.params);
        req.validated.params = parsedParams;
      }

      if (schema.cookies) {
        const parsed = schema.cookies.parse(req.cookies);
        req.validated.cookies = parsed;
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        return next(new ApiError(400, 'Validation failed', formattedErrors));
      }

      return next(error);
    }
  };
};
