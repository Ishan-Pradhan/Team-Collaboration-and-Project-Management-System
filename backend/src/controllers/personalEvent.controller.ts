import type { Response } from 'express';
import { personalEventRepository } from '../repositories/personalEvent.repository.js';
import { organizationRepository } from '../repositories/organization.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import type { AuthRequest } from '../types/auth.types.js';
import { getIO } from '../socket/index.js';

export const listMyPersonalEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { organizationId } = req.params as { organizationId: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.calendarEnabled) throw new ApiError(403, 'Calendar has been disabled for this organization');

  const events = await personalEventRepository.findMineInOrg(userId, organizationId);
  return ok(res, events, 'Personal events retrieved successfully');
});

export const createPersonalEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { organizationId } = req.params as { organizationId: string };
  const { title, dueDate } = req.body as { title: string; dueDate: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.calendarEnabled) throw new ApiError(403, 'Calendar has been disabled for this organization');

  const event = await personalEventRepository.create({ userId, organizationId, title, dueDate });

  getIO().to(`user:${userId}`).emit('personal-event:created', event);

  return ok(res, event, 'Personal event created successfully');
});

export const deletePersonalEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { eventId } = req.params as { eventId: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const event = await personalEventRepository.findByIdForUser(eventId, userId);
  if (!event) throw new ApiError(404, 'Personal event not found');

  await personalEventRepository.delete(eventId);

  getIO().to(`user:${userId}`).emit('personal-event:deleted', { id: eventId, organizationId: event.organizationId });

  return ok(res, null, 'Personal event deleted successfully');
});
