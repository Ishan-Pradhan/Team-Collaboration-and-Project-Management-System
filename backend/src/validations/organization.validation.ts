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

export const muteOrganizationSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    isMuted: z.boolean(),
  }),
};

export const memberParamSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
    userId: z.string().uuid('Invalid user ID'),
  }),
};

export const updateOrganizationSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
    description: z.string().max(500, 'Description must be 500 characters or less').nullable().optional(),
    logoUrl: z.string().url('Invalid logo URL').nullable().optional(),
  }),
};

export const slugParamSchema = {
  params: z.object({
    slug: z.string().min(1, 'Slug is required'),
  }),
};

export const inviteParamSchema = {
  params: z.object({
    organizationId: z.string().uuid(),
    inviteId: z.string().uuid(),
  }),
};

export const changeMemberRoleSchema = {
  params: z.object({
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
  body: z.object({
    role: z.enum(['ORG_ADMIN', 'MEMBER']),
  }),
};

