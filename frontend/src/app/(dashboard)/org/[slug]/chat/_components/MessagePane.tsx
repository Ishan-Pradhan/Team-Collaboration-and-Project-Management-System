'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, Send, Smile, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { parseApiError } from '@/lib/axios';
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
              <div key={message.id} className="group relative flex items-start gap-2.5">
                <button
                  onClick={() => message.sender && setProfileUserId(message.sender.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
                >
                  {(message.sender?.name ?? '?').charAt(0).toUpperCase()}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {message.sender?.id === user?.id ? 'You' : message.sender?.name ?? 'Unknown'}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {message.deletedAt ? (
                    <p className="text-sm italic text-text-secondary">This message was deleted</p>
                  ) : (
                    <>
                      {message.type === 'FILE' ? (
                        <FileAttachmentCard message={message} channelId={channel.id} />
                      ) : (
                        <p className="text-sm text-text-primary">{message.content}</p>
                      )}

                      {message.reactions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {message.reactions.map((reaction) => {
                            const reacted = !!user && reaction.userIds.includes(user.id);
                            return (
                              <button
                                key={reaction.emoji}
                                onClick={() => handleToggleReaction(message, reaction.emoji)}
                                className={`rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
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
                    </>
                  )}
                </div>

                {!message.deletedAt && (
                  <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-lg border border-border-subtle bg-white p-0.5 shadow-sm group-hover:flex">
                    <button
                      onClick={() => setOpenPickerFor(openPickerFor === message.id ? null : message.id)}
                      className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
                      title="Add reaction"
                    >
                      <Smile size={14} />
                    </button>
                    {(message.sender?.id === user?.id || isAdmin) && (
                      <button
                        onClick={() => setDeleteTarget(message.id)}
                        className="rounded p-1 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors"
                        title="Delete message"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}

                {openPickerFor === message.id && (
                  <div className="absolute right-2 top-6 z-20">
                    <EmojiPicker onEmojiClick={(emojiData) => handlePickEmoji(message, emojiData)} />
                  </div>
                )}
              </div>
            )
          )
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

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-subtle p-3">
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadFile.isPending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
          title="Attach a file"
        >
          <Paperclip size={16} />
        </button>
        <input
          value={content}
          onChange={handleContentChange}
          placeholder={channel.type === 'DM' ? `Message ${channel.dmParticipant?.name ?? ''}` : `Message #${channel.name}`}
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
