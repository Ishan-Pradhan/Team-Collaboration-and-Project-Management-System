import { z } from 'zod';

export const createOrganizationSchema = {
  body: z.object({
    name: z.string().min(1, 'Organization name is required').max(100, 'Name must be 100 characters or less'),
  }),
};

export const inviteUserSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
};

export const acceptInviteSchema = {
  body: z.object({
    token: z.string().min(1, 'Invite token is required'),
  }),
};

export const organizationParamSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
};

export const memberParamSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
    userId: z.string().uuid('Invalid user ID'),
  }),
};
