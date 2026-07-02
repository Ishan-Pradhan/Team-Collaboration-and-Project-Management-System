'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/axios';
import { useChannelMessages, useSendMessage } from '@/hooks/useChannel';
import { getMessages } from '@/services/channel.service';
import { useAuthStore } from '@/store/auth.store';
import type { Channel, Message } from '@/types/channel.types';

interface Props {
  channel: Channel;
}

export default function MessagePane({ channel }: Props) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: messages, isLoading } = useChannelMessages(channel.id);
  const sendMessage = useSendMessage(channel.id);
  const [content, setContent] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed, {
      onSuccess: () => setContent(''),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleLoadMore = async () => {
    if (!messages || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await getMessages(channel.id, messages[0].createdAt);
      qc.setQueryData<Message[]>(['channels', channel.id, 'messages'], (old) =>
        old ? [...older, ...old] : older
      );
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages && messages.length > 0 && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="mx-auto block text-xs text-primary hover:underline disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {messages && messages.length > 0 ? (
          messages.map((message) =>
            message.type === 'SYSTEM' ? (
              <p key={message.id} className="text-center text-xs italic text-text-secondary">
                {message.content}
              </p>
            ) : (
              <div key={message.id} className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {(message.sender?.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {message.sender?.id === user?.id ? 'You' : message.sender?.name ?? 'Unknown'}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary">{message.content}</p>
                </div>
              </div>
            )
          )
        ) : (
          <p className="py-8 text-center text-sm text-text-secondary">No messages yet. Say hello!</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-subtle p-3">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Message #${channel.name}`}
          disabled={sendMessage.isPending}
          className="flex-1 rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sendMessage.isPending || !content.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-colors disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
