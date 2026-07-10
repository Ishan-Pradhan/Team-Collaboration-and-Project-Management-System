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

/**
 * @swagger
 * /organizations/{organizationId}/personal-events:
 *   get:
 *     tags: [Personal Events]
 *     summary: List the current user's personal events in an organization
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Personal events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PersonalEvent'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this organization
 *   post:
 *     tags: [Personal Events]
 *     summary: Create a personal event
 *     description: Visible only to the creator — personal events are not shared with other organization members.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, dueDate]
 *             properties:
 *               title: { type: string, maxLength: 300, example: Dentist appointment }
 *               dueDate: { type: string, format: date, example: '2026-08-01' }
 *     responses:
 *       201:
 *         description: Personal event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/PersonalEvent'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this organization
 */
router
  .route('/organizations/:organizationId/personal-events')
  .get(verifyJWT, isOrganizationMember, validate(orgParamSchema), listMyPersonalEvents)
  .post(verifyJWT, isOrganizationMember, validate(createPersonalEventSchema), createPersonalEvent);

/**
 * @swagger
 * /organizations/{organizationId}/personal-events/{eventId}:
 *   delete:
 *     tags: [Personal Events]
 *     summary: Delete a personal event
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Personal event deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this organization
 *       404:
 *         description: Event not found
 */
router
  .route('/organizations/:organizationId/personal-events/:eventId')
  .delete(verifyJWT, isOrganizationMember, validate(deletePersonalEventSchema), deletePersonalEvent);

export default router;
