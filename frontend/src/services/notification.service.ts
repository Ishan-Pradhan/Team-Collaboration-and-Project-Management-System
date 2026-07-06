import { api } from '@/lib/axios';
import type {
  Notification,
  NotificationsResponse,
  UnreadCountResponse,
  PaginationMeta,
  UnreadChannel,
  UnreadChannelsResponse,
} from '@/types/notification.types';

export async function getNotifications(page = 1, limit = 30): Promise<{ notifications: Notification[]; meta: PaginationMeta }> {
  const res = await api.get<NotificationsResponse>('/notifications', { params: { page, limit } });
  return res.data.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<UnreadCountResponse>('/notifications/unread-count');
  return res.data.data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/mark-all-read');
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

export async function getUnreadChannels(): Promise<UnreadChannel[]> {
  const res = await api.get<UnreadChannelsResponse>('/notifications/unread-channels');
  return res.data.data;
}

export async function markReadByEntity(entityType: string, entityId: string): Promise<void> {
  await api.post('/notifications/read-by-entity', { entityType, entityId });
}
