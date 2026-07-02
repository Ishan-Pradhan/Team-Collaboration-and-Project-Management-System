'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { Channel, Message } from '@/types/channel.types';

export function useChatSocket(organizationId: string | undefined) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    const socket = connectSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onChannelCreated = (channel: Channel) => {
      if (channel.organizationId !== organizationId) return;
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] });
    };

    const onChannelDeleted = ({ id }: { id: string }) => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] });
      qc.removeQueries({ queryKey: ['channels', id] });
    };

    const onMemberJoined = ({ channelId }: { channelId: string }) => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    };

    const onMemberLeft = ({ channelId }: { channelId: string }) => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    };

    const onMessageNew = (message: Message) => {
      qc.setQueryData<Message[]>(['channels', message.channelId, 'messages'], (old) =>
        old ? [...old, message] : [message]
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('channel:created', onChannelCreated);
    socket.on('channel:deleted', onChannelDeleted);
    socket.on('member:joined', onMemberJoined);
    socket.on('member:left', onMemberLeft);
    socket.on('message:new', onMessageNew);

    setConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('channel:created', onChannelCreated);
      socket.off('channel:deleted', onChannelDeleted);
      socket.off('member:joined', onMemberJoined);
      socket.off('member:left', onMemberLeft);
      socket.off('message:new', onMessageNew);
    };
  }, [organizationId, qc]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  return { connected };
}
