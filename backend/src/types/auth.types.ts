export interface RegisterUserTypes {
  name: string;
  email: string;
  password: string;
}

export interface LoginUserTypes {
  email: string;
  password: string;
}

export interface JwtPayload {
  id: string;
  email: string;
}

import type { Request } from 'express';
import type { UserInstance } from './users.types.js';
export interface AuthRequest extends Request {
  user?: UserInstance;
}
