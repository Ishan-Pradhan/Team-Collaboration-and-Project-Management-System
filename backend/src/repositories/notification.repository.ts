import { Op } from 'sequelize';
import { Notification } from '../models/index.js';
import type { NotificationCreationAttributes, NotificationInstance } from '../types/notifications.types.js';

// "New message" notifications are only ever created to drive the chat
// sidebar's per-channel unread dots (see upsertMessageNotification /
// findUnreadChannels below) — they were never meant to also populate the
// notification bell, which is what caused the bell badge and the chat
// unread dot to double up for the same message. The bell/feed queries
// below exclude this type; mentions get their own 'mention' type and do
// show up here same as any other real notification.
const NOT_MESSAGE_RECEIVED = { [Op.ne]: 'message_received' } as const;

export const notificationRepository = {
  create: async (data: NotificationCreationAttributes): Promise<NotificationInstance> => {
    return await Notification.create(data);
  },

  findByUser: async (userId: string, limit: number, offset: number): Promise<NotificationInstance[]> => {
    return await Notification.findAll({
      where: { userId, type: NOT_MESSAGE_RECEIVED },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  },

  countByUser: async (userId: string): Promise<number> => {
    return await Notification.count({ where: { userId, type: NOT_MESSAGE_RECEIVED } });
  },

  countUnread: async (userId: string): Promise<number> => {
    return await Notification.count({ where: { userId, isRead: false, type: NOT_MESSAGE_RECEIVED } });
  },

  markRead: async (id: string, userId: string): Promise<number> => {
    const [count] = await Notification.update({ isRead: true }, { where: { id, userId } });
    return count;
  },

  deleteById: async (id: string, userId: string): Promise<number> => {
    return await Notification.destroy({ where: { id, userId } });
  },

  markAllRead: async (userId: string): Promise<void> => {
    await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  },

  // Collapses a burst of messages in the same channel into one updating row
  // instead of one row per message.
  upsertMessageNotification: async (params: {
    userId: string;
    organizationId: string;
    channelId: string;
    title: string;
    body: string;
  }): Promise<NotificationInstance> => {
    const existing = await Notification.findOne({
      where: {
        userId: params.userId,
        entityType: 'channel',
        entityId: params.channelId,
        type: 'message_received',
        isRead: false,
      },
    });

    if (existing) {
      return await existing.update({ title: params.title, body: params.body, createdAt: new Date() });
    }

    return await Notification.create({
      userId: params.userId,
      organizationId: params.organizationId,
      type: 'message_received',
      title: params.title,
      body: params.body,
      entityType: 'channel',
      entityId: params.channelId,
    });
  },

  markReadByEntity: async (userId: string, entityType: string, entityId: string): Promise<void> => {
    await Notification.update({ isRead: true }, { where: { userId, entityType, entityId, isRead: false } });
  },

  findUnreadChannels: async (userId: string): Promise<NotificationInstance[]> => {
    return await Notification.findAll({
      where: { userId, entityType: 'channel', type: 'message_received', isRead: false },
      order: [['createdAt', 'DESC']],
    });
  },
};
