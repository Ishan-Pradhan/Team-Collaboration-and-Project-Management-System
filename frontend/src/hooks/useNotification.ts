import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getUnreadChannels,
  markReadByEntity,
} from '@/services/notification.service';
import type { UnreadChannel } from '@/types/notification.types';

export const useNotifications = (page = 1, limit = 30) =>
  useQuery({
    queryKey: ['notifications', { page, limit }],
    queryFn: () => getNotifications(page, limit),
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useUnreadChannels = () =>
  useQuery({
    queryKey: ['notifications', 'unread-channels'],
    queryFn: getUnreadChannels,
  });

export const useMarkReadByEntity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: string; entityId: string }) =>
      markReadByEntity(entityType, entityId),
    onSuccess: (_data, variables) => {
      qc.setQueryData<UnreadChannel[]>(['notifications', 'unread-channels'], (old) =>
        old?.filter((c) => c.channelId !== variables.entityId)
      );
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
