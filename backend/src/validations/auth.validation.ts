import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const verifyEmailSchema = {
  query: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
};

export const resendVerificationEmailSchema = {
  body: z.object({
    email: z.email('Invalid email'),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.email('Invalid email'),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters'),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters'),
  }),
};

export const updateProfileSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  }),
};

export const refreshAccessTokenSchema = {
  cookies: z.object({
    refreshToken: z.string().optional(),
  }),
};
