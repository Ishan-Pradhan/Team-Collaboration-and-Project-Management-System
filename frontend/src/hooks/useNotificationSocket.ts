'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { markReadByEntity } from '@/services/notification.service';
import { useChatStore } from '@/store/chat.store';
import type { Notification, UnreadChannel } from '@/types/notification.types';

export function useNotificationSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = connectSocket();

    const onNotificationNew = (notification: Notification) => {
      const isMessage = notification.type === 'message_received';
      const activeChannelId = useChatStore.getState().activeChannelId;

      // Never show a channel you're already looking at as unread.
      if (isMessage && notification.entityId === activeChannelId) {
        markReadByEntity('channel', notification.entityId as string).catch(() => {});
        return;
      }

      if (isMessage) {
        const channelId = notification.entityId as string;
        const wasAlreadyUnread = (qc.getQueryData<UnreadChannel[]>(['notifications', 'unread-channels']) ?? []).some(
          (c) => c.channelId === channelId
        );

        qc.setQueryData<UnreadChannel[]>(['notifications', 'unread-channels'], (old) => {
          const next = (old ?? []).filter((c) => c.channelId !== channelId);
          next.unshift({
            channelId,
            title: notification.title,
            body: notification.body,
            createdAt: notification.createdAt,
          });
          return next;
        });

        // Only bump the badge once per newly-unread channel, not once per
        // message — a burst of messages upserts the same underlying row.
        if (!wasAlreadyUnread) {
          qc.setQueryData<number>(['notifications', 'unread-count'], (old) => (old ?? 0) + 1);
        }
        qc.invalidateQueries({ queryKey: ['notifications'], exact: false });
        return;
      }

      qc.setQueryData<number>(['notifications', 'unread-count'], (old) => (old ?? 0) + 1);
      qc.invalidateQueries({ queryKey: ['notifications'], exact: false });
      toast.info(notification.title);
    };

    const onPersonalEventChanged = (event: { organizationId: string }) => {
      qc.invalidateQueries({ queryKey: ['organizations', event.organizationId, 'personal-events'] });
    };

    socket.on('notification:new', onNotificationNew);
    socket.on('personal-event:created', onPersonalEventChanged);
    socket.on('personal-event:deleted', onPersonalEventChanged);

    return () => {
      socket.off('notification:new', onNotificationNew);
      socket.off('personal-event:created', onPersonalEventChanged);
      socket.off('personal-event:deleted', onPersonalEventChanged);
    };
  }, [qc]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);
}
