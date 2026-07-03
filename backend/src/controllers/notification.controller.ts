import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { serializeNotification } from '../serializers/notification.serializer.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.utils.js';

export const listNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const { page, limit, offset } = getPaginationParams(req.query as { page?: string; limit?: string });

  const [notifications, totalItems] = await Promise.all([
    notificationRepository.findByUser(user.id, limit, offset),
    notificationRepository.countByUser(user.id),
  ]);

  return ok(
    res,
    {
      notifications: notifications.map(serializeNotification),
      meta: buildPaginationMeta({ totalItems, page, limit, itemCount: notifications.length }),
    },
    'Notifications retrieved successfully'
  );
});

export const getUnreadNotificationCount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const count = await notificationRepository.countUnread(user.id);
  return ok(res, { count }, 'Unread count retrieved successfully');
});

export const markNotificationRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');
  const { id } = req.params as { id: string };

  const updated = await notificationRepository.markRead(id, user.id);
  if (updated === 0) throw new ApiError(404, 'Notification not found');

  return ok(res, null, 'Notification marked as read');
});

export const markAllNotificationsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await notificationRepository.markAllRead(user.id);
  return ok(res, null, 'All notifications marked as read');
});
