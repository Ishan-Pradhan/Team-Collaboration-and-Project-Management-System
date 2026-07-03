'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { Notification } from '@/types/notification.types';

export function useNotificationSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = connectSocket();

    const onNotificationNew = (notification: Notification) => {
      qc.setQueryData<number>(['notifications', 'unread-count'], (old) => (old ?? 0) + 1);
      qc.invalidateQueries({ queryKey: ['notifications'], exact: false });
      toast.info(notification.title);
    };

    socket.on('notification:new', onNotificationNew);

    return () => {
      socket.off('notification:new', onNotificationNew);
    };
  }, [qc]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);
}
