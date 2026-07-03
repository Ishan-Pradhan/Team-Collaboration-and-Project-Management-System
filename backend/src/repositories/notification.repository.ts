import { Notification } from '../models/index.js';
import type { NotificationCreationAttributes, NotificationInstance } from '../types/notifications.types.js';

export const notificationRepository = {
  create: async (data: NotificationCreationAttributes): Promise<NotificationInstance> => {
    return await Notification.create(data);
  },

  findByUser: async (userId: string, limit: number, offset: number): Promise<NotificationInstance[]> => {
    return await Notification.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  },

  countByUser: async (userId: string): Promise<number> => {
    return await Notification.count({ where: { userId } });
  },

  countUnread: async (userId: string): Promise<number> => {
    return await Notification.count({ where: { userId, isRead: false } });
  },

  markRead: async (id: string, userId: string): Promise<number> => {
    const [count] = await Notification.update({ isRead: true }, { where: { id, userId } });
    return count;
  },

  markAllRead: async (userId: string): Promise<void> => {
    await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  },
};
