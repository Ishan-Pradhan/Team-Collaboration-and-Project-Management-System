import { z } from 'zod';

export const notificationParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
};
