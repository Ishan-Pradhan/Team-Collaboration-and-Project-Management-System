import type { NotificationInstance } from '../types/notifications.types.js';

export const serializeNotification = (n: NotificationInstance) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  entityType: n.entityType,
  entityId: n.entityId,
  organizationId: n.organizationId,
  projectId: n.projectId,
  isRead: n.isRead,
  createdAt: n.createdAt,
});
