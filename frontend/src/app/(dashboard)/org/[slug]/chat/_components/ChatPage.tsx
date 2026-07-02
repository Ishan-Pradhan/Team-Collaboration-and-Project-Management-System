'use client';

import { use, useEffect, useState } from 'react';
import { Hash, Lock, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useChannels, useCreateChannel } from '@/hooks/useChannel';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatSkeleton } from '@/components/shared/skeletons/ChatSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-gray-800">New Channel</h2>
        <p className="mt-0.5 text-xs text-gray-400">Create a channel for your organization to chat in.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim(), type); }}
          className="mt-5 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600" htmlFor="new-channel-name">
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
            <span className="text-xs font-semibold text-gray-600">Visibility</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('PUBLIC')}
                className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  type === 'PUBLIC' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium"><Hash size={13} /> Public</span>
                <span className="text-xs text-gray-400">All org members auto-join</span>
              </button>
              <button
                type="button"
                onClick={() => setType('PRIVATE')}
                className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  type === 'PRIVATE' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium"><Lock size={13} /> Private</span>
                <span className="text-xs text-gray-400">Invite-only</span>
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

export default function ChatPage({ params }: Props) {
  const { slug } = use(params);
  const { user } = useAuthStore();

  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const createChannel = useCreateChannel(org?.id ?? '');

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (selectedChannel && channels && !channels.some((c) => c.id === selectedChannel.id)) {
      setSelectedChannel(null);
    }
  }, [channels, selectedChannel]);

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

  return (
    <div className="flex h-full gap-4">
      <aside className="flex w-64 shrink-0 flex-col rounded-xl border border-border-subtle bg-white">
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
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {channels && channels.length > 0 ? (
            channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  selectedChannel?.id === channel.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-muted'
                }`}
              >
                {channel.type === 'PUBLIC' ? <Hash size={13} /> : <Lock size={13} />}
                <span className="truncate">{channel.name}</span>
              </button>
            ))
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No channels yet.</p>
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
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-text-secondary">
            <MessageSquare size={28} className="text-gray-300" />
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
    </div>
  );
}
