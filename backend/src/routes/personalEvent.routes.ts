import { Router } from 'express';
import { z } from 'zod';
import { verifyJWT, isOrganizationMember } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listMyPersonalEvents,
  createPersonalEvent,
  deletePersonalEvent,
} from '../controllers/personalEvent.controller.js';

const router = Router();

const orgParamSchema = {
  params: z.object({ organizationId: z.string().uuid() }),
};

const createPersonalEventSchema = {
  params: z.object({ organizationId: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(300),
    dueDate: z.string().min(1),
  }),
};

const deletePersonalEventSchema = {
  params: z.object({ organizationId: z.string().uuid(), eventId: z.string().uuid() }),
};

router
  .route('/organizations/:organizationId/personal-events')
  .get(verifyJWT, isOrganizationMember, validate(orgParamSchema), listMyPersonalEvents)
  .post(verifyJWT, isOrganizationMember, validate(createPersonalEventSchema), createPersonalEvent);

router
  .route('/organizations/:organizationId/personal-events/:eventId')
  .delete(verifyJWT, isOrganizationMember, validate(deletePersonalEventSchema), deletePersonalEvent);

export default router;
