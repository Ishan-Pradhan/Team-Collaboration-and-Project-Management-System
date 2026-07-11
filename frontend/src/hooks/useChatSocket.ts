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

    const onChannelUpdated = (channel: Channel) => {
      if (channel.organizationId !== organizationId) return;
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] });
    };

    const onMemberJoined = ({ channelId }: { channelId: string }) => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    };

    const onMemberLeft = ({ channelId }: { channelId: string }) => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    };

    const onMessageNew = (message: Message) => {
      qc.setQueryData<Message[]>(['channels', message.channelId, 'messages'], (old) => {
        if (!old) return [message];
        if (old.some((m) => m.id === message.id)) return old;
        return [...old, message];
      });
    };

    const onReactionAdded = ({
      messageId,
      channelId,
      emoji,
      userId,
    }: {
      messageId: string;
      channelId: string;
      emoji: string;
      userId: string;
    }) => {
      qc.setQueryData<Message[]>(['channels', channelId, 'messages'], (old) =>
        old?.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            if (existing.userIds.includes(userId)) return m;
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r
              ),
            };
          }
          return { ...m, reactions: [...m.reactions, { emoji, userIds: [userId] }] };
        })
      );
    };

    const onReactionRemoved = ({
      messageId,
      channelId,
      emoji,
      userId,
    }: {
      messageId: string;
      channelId: string;
      emoji: string;
      userId: string;
    }) => {
      qc.setQueryData<Message[]>(['channels', channelId, 'messages'], (old) =>
        old?.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: m.reactions
              .map((r) => (r.emoji === emoji ? { ...r, userIds: r.userIds.filter((id) => id !== userId) } : r))
              .filter((r) => r.userIds.length > 0),
          };
        })
      );
    };

    const onMessageDeleted = ({ messageId, channelId }: { messageId: string; channelId: string }) => {
      qc.setQueryData<Message[]>(['channels', channelId, 'messages'], (old) =>
        old?.map((m) =>
          m.id === messageId ? { ...m, content: '', deletedAt: new Date().toISOString(), reactions: [] } : m
        )
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('channel:created', onChannelCreated);
    socket.on('channel:deleted', onChannelDeleted);
    socket.on('channel:updated', onChannelUpdated);
    socket.on('member:joined', onMemberJoined);
    socket.on('member:left', onMemberLeft);
    socket.on('message:new', onMessageNew);
    socket.on('reaction:added', onReactionAdded);
    socket.on('reaction:removed', onReactionRemoved);
    socket.on('message:deleted', onMessageDeleted);

    setConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('channel:created', onChannelCreated);
      socket.off('channel:deleted', onChannelDeleted);
      socket.off('channel:updated', onChannelUpdated);
      socket.off('member:joined', onMemberJoined);
      socket.off('member:left', onMemberLeft);
      socket.off('message:new', onMessageNew);
      socket.off('reaction:added', onReactionAdded);
      socket.off('reaction:removed', onReactionRemoved);
      socket.off('message:deleted', onMessageDeleted);
    };
  }, [organizationId, qc]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  return { connected };
}
