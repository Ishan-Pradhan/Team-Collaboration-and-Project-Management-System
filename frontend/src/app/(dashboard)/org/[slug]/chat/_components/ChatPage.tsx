'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Hash, Lock, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useChannels, useCreateChannel, useDMs, useStartDM } from '@/hooks/useChannel';
import { useUnreadChannels, useMarkReadByEntity } from '@/hooks/useNotification';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatSkeleton } from '@/components/shared/skeletons/ChatSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import UserProfileDialog from '@/components/shared/UserProfileDialog';
import type { Channel } from '@/types/channel.types';
import ChannelView from './ChannelView';

interface Props {
  params: Promise<{ slug: string }>;
}

function CreateChannelModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (name: string, type: 'PUBLIC' | 'PRIVATE') => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-modal">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-text-secondary hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-text-primary">New Channel</h2>
        <p className="mt-0.5 text-xs text-text-secondary">Create a channel for your organization to chat in.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim(), type); }}
          className="mt-5 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="new-channel-name">
              Channel name
            </label>
            <Input
              id="new-channel-name"
              placeholder="e.g. general"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-text-secondary">Visibility</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('PUBLIC')}
                className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  type === 'PUBLIC' ? 'border-primary bg-primary/5 text-primary' : 'border-border-subtle text-text-secondary'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium"><Hash size={13} /> Public</span>
                <span className="text-xs text-text-secondary">All org members auto-join</span>
              </button>
              <button
                type="button"
                onClick={() => setType('PRIVATE')}
                className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  type === 'PRIVATE' ? 'border-primary bg-primary/5 text-primary' : 'border-border-subtle text-text-secondary'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium"><Lock size={13} /> Private</span>
                <span className="text-xs text-text-secondary">Invite-only</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? <><Loader2 size={14} className="animate-spin mr-1.5" />Creating…</> : 'Create Channel'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewDMModal({
  onClose,
  onSelect,
  members,
  isPending,
}: {
  onClose: () => void;
  onSelect: (userId: string) => void;
  members: { userId: string; user?: { id: string; name: string; avatarUrl: string | null } }[];
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-modal">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-text-secondary hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-text-primary">New Direct Message</h2>
        <p className="mt-0.5 text-xs text-text-secondary">Pick someone in your organization to message.</p>

        <div className="mt-4 max-h-80 space-y-1 overflow-y-auto">
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={() => onSelect(m.userId)}
              disabled={isPending}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(m.user?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{m.user?.name ?? 'Unknown'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: dms } = useDMs(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const { data: unreadChannels } = useUnreadChannels();
  const createChannel = useCreateChannel(org?.id ?? '');
  const startDM = useStartDM(org?.id ?? '');
  const markReadByEntity = useMarkReadByEntity();

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const unreadMap = new Map((unreadChannels ?? []).map((c) => [c.channelId, c]));

  useEffect(() => {
    if (
      selectedChannel &&
      channels &&
      dms &&
      !channels.some((c) => c.id === selectedChannel.id) &&
      !dms.some((c) => c.id === selectedChannel.id)
    ) {
      setSelectedChannel(null);
    }
  }, [channels, dms, selectedChannel]);

  useEffect(() => {
    useChatStore.getState().setActiveChannelId(selectedChannel?.id ?? null);
    return () => {
      useChatStore.getState().setActiveChannelId(null);
    };
  }, [selectedChannel?.id]);

  useEffect(() => {
    if (!selectedChannel) return;
    if (unreadChannels?.some((c) => c.channelId === selectedChannel.id)) {
      markReadByEntity.mutate({ entityType: 'channel', entityId: selectedChannel.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel?.id, unreadChannels]);

  useEffect(() => {
    const dmUserId = searchParams.get('dmUserId');
    if (!dmUserId || !dms || !org) return;

    const existing = dms.find((dm) => dm.dmParticipant?.id === dmUserId);
    if (existing) {
      setSelectedChannel(existing);
      router.replace(`/org/${slug}/chat`);
      return;
    }

    startDM.mutate(dmUserId, {
      onSuccess: (channel) => setSelectedChannel(channel),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
      onSettled: () => router.replace(`/org/${slug}/chat`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, dms, org]);

  useEffect(() => {
    const channelId = searchParams.get('channelId');
    if (!channelId || !channels) return;

    const target = channels.find((c) => c.id === channelId);
    if (target) setSelectedChannel(target);
    router.replace(`/org/${slug}/chat`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, channels]);

  if (orgLoading || channelsLoading) return <ChatSkeleton />;
  if (orgError || !org) {
    return (
      <ErrorState title="Failed to load chat" message="Could not load workspace data." onRetry={() => refetch()} />
    );
  }

  const currentMembership = orgMembers?.find((m) => m.userId === user?.id);
  const isAdmin = org.ownerId === user?.id || currentMembership?.role === 'ORG_ADMIN';

  const handleCreate = (name: string, type: 'PUBLIC' | 'PRIVATE') => {
    createChannel.mutate(
      { name, type },
      {
        onSuccess: (channel) => {
          toast.success('Channel created');
          setShowCreateModal(false);
          setSelectedChannel(channel);
        },
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      }
    );
  };

  const handleStartDM = (userId: string) => {
    startDM.mutate(userId, {
      onSuccess: (channel) => {
        setShowDMModal(false);
        setSelectedChannel(channel);
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="flex h-full gap-4">
      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto rounded-xl border border-border-subtle bg-white">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Channels</span>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
              title="New channel"
            >
              <Plus size={15} />
            </button>
          )}
        </div>
        <div className="space-y-0.5 p-2">
          {channels && channels.length > 0 ? (
            channels.map((channel) => {
              const unread = unreadMap.get(channel.id);
              return (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    selectedChannel?.id === channel.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {channel.type === 'PUBLIC' ? <Hash size={13} className="mt-0.5 shrink-0" /> : <Lock size={13} className="mt-0.5 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{channel.name}</span>
                      {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    </span>
                    {unread && (
                      <span className="block truncate text-xs font-semibold text-text-primary">{unread.body}</span>
                    )}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No channels yet.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-b border-t border-border-subtle px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Direct Messages</span>
          <button
            onClick={() => setShowDMModal(true)}
            className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
            title="New direct message"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="space-y-0.5 p-2">
          {dms && dms.length > 0 ? (
            dms.map((dm) => {
              const unread = unreadMap.get(dm.id);
              return (
                <button
                  key={dm.id}
                  onClick={() => setSelectedChannel(dm)}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    selectedChannel?.id === dm.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dm.dmParticipant) setProfileUserId(dm.dmParticipant.id);
                    }}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[10px] font-semibold text-primary hover:opacity-80 transition-opacity"
                  >
                    {dm.dmParticipant?.avatarUrl ? (
                      <img
                        src={dm.dmParticipant.avatarUrl}
                        alt={dm.dmParticipant.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (dm.dmParticipant?.name ?? '?').charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{dm.dmParticipant?.name ?? 'Unknown'}</span>
                      {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    </span>
                    {unread && (
                      <span className="block truncate text-xs font-semibold text-text-primary">{unread.body}</span>
                    )}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No direct messages yet.</p>
          )}
        </div>
      </aside>

      <div className="flex-1 rounded-xl border border-border-subtle bg-white overflow-hidden">
        {selectedChannel ? (
          <ChannelView
            channel={selectedChannel}
            organizationId={org.id}
            isAdmin={isAdmin}
            onLeftOrDeleted={() => setSelectedChannel(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-secondary">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
              <MessageSquare size={24} className="text-text-muted" />
            </div>
            <p className="text-sm">Select a channel to start chatting</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateChannelModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isPending={createChannel.isPending}
        />
      )}

      {showDMModal && (
        <NewDMModal
          onClose={() => setShowDMModal(false)}
          onSelect={handleStartDM}
          members={(orgMembers ?? []).filter((m) => m.userId !== user?.id)}
          isPending={startDM.isPending}
        />
      )}

      {profileUserId && org && (
        <UserProfileDialog
          userId={profileUserId}
          organizationId={org.id}
          onClose={() => setProfileUserId(null)}
          onMessage={(userId) => {
            setProfileUserId(null);
            router.push(`/org/${slug}/chat?dmUserId=${userId}`);
          }}
        />
      )}
    </div>
  );
}
