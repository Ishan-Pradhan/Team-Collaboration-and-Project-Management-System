import { z } from 'zod';

export const notificationParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
};

export const readByEntitySchema = {
  body: z.object({
    entityType: z.string().min(1, 'entityType is required'),
    entityId: z.string().uuid('Invalid entity ID'),
  }),
};
