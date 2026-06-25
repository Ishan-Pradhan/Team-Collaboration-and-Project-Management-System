import { z } from 'zod';

export const createProjectSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    name: z.string().min(1, 'Project name is required').max(200, 'Name must be 200 characters or less'),
    description: z.string().max(1000, 'Description must be 1000 characters or less').nullable().optional(),
  }),
};

export const orgParamSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
};

export const updateProjectSchema = {
  params: z.object({
    projectId: z.string().uuid('Invalid project ID'),
  }),
  body: z.object({
    name: z.string().min(1, 'Project name is required').max(200, 'Name must be 200 characters or less').optional(),
    description: z.string().max(1000, 'Description must be 1000 characters or less').nullable().optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  }),
};

export const projectParamSchema = {
  params: z.object({
    projectId: z.string().uuid('Invalid project ID'),
  }),
};

export const addProjectMemberSchema = {
  params: z.object({
    projectId: z.string().uuid('Invalid project ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
};

export const removeProjectMemberSchema = {
  params: z.object({
    projectId: z.string().uuid('Invalid project ID'),
    userId: z.string().uuid('Invalid user ID'),
  }),
};
