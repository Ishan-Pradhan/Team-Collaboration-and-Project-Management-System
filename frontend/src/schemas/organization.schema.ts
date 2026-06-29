import { z } from 'zod';

export const updateOrgSchema = z.object({
  name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
