import type { Response } from 'express';
import { personalEventRepository } from '../repositories/personalEvent.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import type { AuthRequest } from '../types/auth.types.js';

export const listMyPersonalEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { organizationId } = req.params as { organizationId: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const events = await personalEventRepository.findMineInOrg(userId, organizationId);
  return ok(res, events, 'Personal events retrieved successfully');
});

export const createPersonalEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { organizationId } = req.params as { organizationId: string };
  const { title, dueDate } = req.body as { title: string; dueDate: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const event = await personalEventRepository.create({ userId, organizationId, title, dueDate });
  return ok(res, event, 'Personal event created successfully');
});

export const deletePersonalEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { eventId } = req.params as { eventId: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const event = await personalEventRepository.findByIdForUser(eventId, userId);
  if (!event) throw new ApiError(404, 'Personal event not found');

  await personalEventRepository.delete(eventId);
  return ok(res, null, 'Personal event deleted successfully');
});
