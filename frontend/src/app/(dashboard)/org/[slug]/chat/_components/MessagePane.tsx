'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, Send, Smile, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { parseApiError } from '@/lib/axios';
import { cn } from '@/lib/utils';
import {
  useChannelMessages,
  useSendMessage,
  useAddReaction,
  useRemoveReaction,
  useDeleteMessage,
  useUploadFile,
} from '@/hooks/useChannel';
import { getMessages } from '@/services/channel.service';
import { useAuthStore } from '@/store/auth.store';
import { getSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import UserProfileDialog from '@/components/shared/UserProfileDialog';
import { FileAttachmentCard } from './fileDisplay';
import type { Channel, Message } from '@/types/channel.types';

function typingLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDateSeparator(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(iso, now.toISOString())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(iso, yesterday.toISOString())) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

interface MessageGroupEntry {
  message: Message;
  showHeader: boolean;
  dateLabel: string | null;
}

function buildMessageGroups(messages: Message[]): MessageGroupEntry[] {
  return messages.map((message, i) => {
    const prev = messages[i - 1];
    const showDateSeparator = !prev || !isSameDay(prev.createdAt, message.createdAt);
    const withinWindow =
      !!prev &&
      !showDateSeparator &&
      prev.type !== 'SYSTEM' &&
      message.type !== 'SYSTEM' &&
      prev.senderId === message.senderId &&
      new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() <= 5 * 60 * 1000;
    return {
      message,
      showHeader: !withinWindow,
      dateLabel: showDateSeparator ? formatDateSeparator(message.createdAt) : null,
    };
  });
}

interface Props {
  channel: Channel;
  isAdmin: boolean;
  organizationId: string;
}

export default function MessagePane({ channel, isAdmin, organizationId }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data: messages, isLoading } = useChannelMessages(channel.id);
  const sendMessage = useSendMessage(channel.id);
  const addReaction = useAddReaction(channel.id);
  const removeReaction = useRemoveReaction(channel.id);
  const deleteMessage = useDeleteMessage(channel.id);
  const uploadFile = useUploadFile(channel.id);
  const [content, setContent] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingEmitRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  useEffect(() => {
    const socket = getSocket();
    const onTypingUpdate = (data: { channelId: string; userId: string; userName: string }) => {
      if (data.channelId !== channel.id || data.userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data.userName);
        return next;
      });
      const existing = typingTimeoutsRef.current.get(data.userId);
      if (existing) clearTimeout(existing);
      typingTimeoutsRef.current.set(
        data.userId,
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
          });
          typingTimeoutsRef.current.delete(data.userId);
        }, 4000)
      );
    };

    socket.on('typing:update', onTypingUpdate);
    return () => {
      socket.off('typing:update', onTypingUpdate);
      typingTimeoutsRef.current.forEach(clearTimeout);
      typingTimeoutsRef.current.clear();
      setTypingUsers(new Map());
    };
  }, [channel.id, user?.id]);

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

  const handleToggleReaction = (message: Message, emoji: string) => {
    const reaction = message.reactions.find((r) => r.emoji === emoji);
    const alreadyReacted = !!user && !!reaction?.userIds.includes(user.id);
    if (alreadyReacted) {
      removeReaction.mutate(
        { messageId: message.id, emoji },
        { onError: (err: unknown) => toast.error(parseApiError(err).message) }
      );
    } else {
      addReaction.mutate(
        { messageId: message.id, emoji },
        { onError: (err: unknown) => toast.error(parseApiError(err).message) }
      );
    }
  };

  const handlePickEmoji = (message: Message, emojiData: EmojiClickData) => {
    addReaction.mutate(
      { messageId: message.id, emoji: emojiData.emoji },
      { onError: (err: unknown) => toast.error(parseApiError(err).message) }
    );
    setOpenPickerFor(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMessage.mutate(deleteTarget, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile.mutate(file, {
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      lastTypingEmitRef.current = now;
      getSocket().emit('typing:start', { channelId: channel.id });
    }
  };

  const messageGroups = messages ? buildMessageGroups(messages) : [];

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
            className="mx-auto block rounded text-xs text-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {loadingMore ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {messages && messages.length > 0 ? (
          messageGroups.map(({ message, showHeader, dateLabel }) => {
            const isOwn = message.sender?.id === user?.id;
            return (
            <div key={message.id}>
              {dateLabel && (
                <div className="my-2 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border-subtle" />
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                    {dateLabel}
                  </span>
                  <div className="h-px flex-1 bg-border-subtle" />
                </div>
              )}
              {message.type === 'SYSTEM' ? (
                <p className="text-center text-xs italic text-text-secondary">{message.content}</p>
              ) : (
                <div className={cn(
                  'group relative flex items-start gap-2.5 py-0.5',
                  isOwn && 'flex-row-reverse',
                )}>
                  {showHeader ? (
                    <button
                      onClick={() => message.sender && setProfileUserId(message.sender.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {message.sender?.avatarUrl ? (
                        <img
                          src={message.sender.avatarUrl}
                          alt={message.sender.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (message.sender?.name ?? '?').charAt(0).toUpperCase()
                      )}
                    </button>
                  ) : (
                    <div className="w-7 shrink-0" />
                  )}
                  <div className={cn('flex min-w-0 flex-1 flex-col', isOwn ? 'items-end' : 'items-start')}>
                    {showHeader && (
                      <div className={cn('flex items-baseline gap-2', isOwn && 'flex-row-reverse')}>
                        <span className="text-sm font-medium text-text-primary">
                          {isOwn ? 'You' : message.sender?.name ?? 'Unknown'}
                        </span>
                        <span className="text-[10px] text-text-secondary">
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}

                    {message.deletedAt ? (
                      <p className="text-sm italic text-text-secondary">This message was deleted</p>
                    ) : (
                      <>
                        <div className="relative w-fit max-w-[75%]">
                          {message.type === 'FILE' ? (
                            <FileAttachmentCard message={message} channelId={channel.id} />
                          ) : (
                            <p className={cn(
                              'break-words rounded-lg px-3 py-1.5 text-sm text-text-primary',
                              isOwn ? 'bg-primary/10' : 'bg-surface-muted',
                            )}>
                              {message.content}
                            </p>
                          )}

                          <div className={cn(
                            'absolute -top-8 left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-lg border p-0.5 shadow-sm group-hover:flex',
                            isOwn ? 'border-primary/30 bg-primary/10' : 'border-border-subtle bg-white',
                          )}>
                            <button
                              onClick={() => setOpenPickerFor(openPickerFor === message.id ? null : message.id)}
                              className={cn(
                                'rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isOwn ? 'text-primary hover:bg-primary/15' : 'text-text-secondary hover:bg-surface-muted',
                              )}
                              title="Add reaction"
                            >
                              <Smile size={14} />
                            </button>
                            {(isOwn || isAdmin) && (
                              <button
                                onClick={() => setDeleteTarget(message.id)}
                                className={cn(
                                  'rounded p-1 transition-colors hover:bg-danger-soft/20 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  isOwn ? 'text-primary' : 'text-text-secondary',
                                )}
                                title="Delete message"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          {openPickerFor === message.id && (
                            <div className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2">
                              <EmojiPicker onEmojiClick={(emojiData) => handlePickEmoji(message, emojiData)} />
                            </div>
                          )}

                          {message.reactions.length > 0 && (
                            <div className={cn('mt-1 flex w-fit flex-wrap gap-1', !isOwn && 'ml-auto')}>
                              {message.reactions.map((reaction) => {
                                const reacted = !!user && reaction.userIds.includes(user.id);
                                return (
                                  <button
                                    key={reaction.emoji}
                                    onClick={() => handleToggleReaction(message, reaction.emoji)}
                                    className={`rounded-full border px-1.5 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                      reacted
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border-subtle text-text-secondary hover:bg-surface-muted'
                                    }`}
                                  >
                                    {reaction.emoji} {reaction.userIds.length}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            );
          })
        ) : (
          <p className="py-8 text-center text-sm text-text-secondary">No messages yet. Say hello!</p>
        )}
        <div ref={bottomRef} />
      </div>

      {typingUsers.size > 0 && (
        <p className="px-4 pb-1 text-xs italic text-text-secondary">
          {typingLabel([...typingUsers.values()])}
        </p>
      )}

      <form onSubmit={handleSend} className="border-t border-border-subtle p-3">
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-white px-1.5 py-1 transition-colors focus-within:border-primary">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadFile.isPending}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Attach a file"
          >
            <Paperclip size={16} />
          </button>
          <input
            value={content}
            onChange={handleContentChange}
            placeholder={channel.type === 'DM' ? `Message ${channel.dmParticipant?.name ?? ''}` : `Message #${channel.name}`}
            disabled={sendMessage.isPending}
            className="min-w-0 flex-1 bg-transparent px-1.5 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sendMessage.isPending || !content.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Send size={15} />
          </button>
        </div>
      </form>

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Message"
        description="Delete this message? This cannot be undone."
        confirmText="Delete"
        isDestructive
        isLoading={deleteMessage.isPending}
      />

      {profileUserId && (
        <UserProfileDialog
          userId={profileUserId}
          organizationId={organizationId}
          onClose={() => setProfileUserId(null)}
          onMessage={(userId) => {
            setProfileUserId(null);
            router.push(`?dmUserId=${userId}`);
          }}
        />
      )}
    </div>
  );
}
