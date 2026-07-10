'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Bell, BellOff, Edit2, Hash, Lock, Loader2, LogOut, MoreVertical, Paperclip, Trash2, Users, X } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import { useChannelMembers, useLeaveChannel, useDeleteChannel, useMutedChannels, useMuteChannel, useRenameChannel } from '@/hooks/useChannel';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ManageChannelMembersModal from '@/components/shared/ManageChannelMembersModal';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { Channel } from '@/types/channel.types';
import MessagePane from './MessagePane';
import FileList from './FileList';

interface Props {
  channel: Channel;
  organizationId: string;
  isAdmin: boolean;
  onLeftOrDeleted: () => void;
  onBack: () => void;
}

export default function ChannelView({ channel, organizationId, isAdmin, onLeftOrDeleted, onBack }: Props) {
  const user = useAuthStore((s) => s.user);
  const { data: members } = useChannelMembers(channel.id);
  const leaveChannel = useLeaveChannel(organizationId, channel.id);
  const deleteChannel = useDeleteChannel(organizationId);
  const renameChannel = useRenameChannel(organizationId);
  const { data: mutedChannelIds } = useMutedChannels();
  const muteChannel = useMuteChannel();
  const isMuted = mutedChannelIds?.includes(channel.id) ?? false;

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [activeView, setActiveView] = useState<'messages' | 'files'>('messages');
  const [showMenu, setShowMenu] = useState(false);

  const isCreator = channel.createdBy === user?.id;
  const canRename = isCreator || isAdmin;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            onClick={onBack}
            className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-muted transition-colors lg:hidden"
            title="Back to list"
          >
            <ArrowLeft size={18} />
          </button>
          {channel.type === 'DM' ? (
            <>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {channel.dmParticipant?.avatarUrl ? (
                  <img
                    src={channel.dmParticipant.avatarUrl}
                    alt={channel.dmParticipant.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (channel.dmParticipant?.name ?? '?').charAt(0).toUpperCase()
                )}
              </div>
              <h2 className="truncate text-base font-semibold text-text-primary">{channel.dmParticipant?.name ?? 'Unknown'}</h2>
            </>
          ) : (
            <>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                {channel.type === 'PUBLIC' ? <Hash size={15} className="text-text-secondary" /> : <Lock size={15} className="text-text-secondary" />}
              </div>
              <h2 className="truncate text-base font-semibold text-text-primary">{channel.name}</h2>
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary sm:inline-flex">
                <Users size={11} />
                {members?.length ?? 0}
              </span>
            </>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex items-center justify-center rounded-lg p-1.5 text-text-secondary hover:bg-surface-muted transition-colors"
            title="Channel options"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-border-subtle bg-surface py-1 shadow-modal">
              <button
                onClick={() => {
                  setActiveView(activeView === 'files' ? 'messages' : 'files');
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-muted transition-colors"
              >
                <Paperclip size={13} />
                {activeView === 'files' ? 'View Messages' : 'View Files'}
              </button>
              <button
                onClick={() => {
                  muteChannel.mutate({ channelId: channel.id, isMuted: !isMuted });
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-muted transition-colors"
              >
                {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
                {isMuted ? 'Unmute Channel' : 'Mute Channel'}
              </button>
              {channel.type !== 'DM' && (
                <>
                  {canRename && (
                    <button
                      onClick={() => {
                        setShowRenameModal(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-muted transition-colors"
                    >
                      <Edit2 size={13} /> Rename Channel
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMembersModal(true);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-muted transition-colors"
                  >
                    <Users size={13} /> Members
                  </button>
                  <button
                    onClick={() => {
                      setShowLeaveConfirm(true);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-muted transition-colors"
                  >
                    <LogOut size={13} /> Leave Channel
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger-soft/20 transition-colors"
                    >
                      <Trash2 size={13} /> Delete Channel
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)} />
      )}

      <div className="flex-1 overflow-hidden">
        {activeView === 'files' ? (
          <FileList channel={channel} />
        ) : (
          <MessagePane channel={channel} isAdmin={isAdmin} organizationId={organizationId} />
        )}
      </div>

      {showMembersModal && (
        <ManageChannelMembersModal
          channelId={channel.id}
          organizationId={organizationId}
          isOpen
          isAdmin={isAdmin}
          onClose={() => setShowMembersModal(false)}
        />
      )}

      <ConfirmationDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => leaveChannel.mutate(undefined, {
          onSuccess: () => { toast.success(`Left #${channel.name}`); setShowLeaveConfirm(false); onLeftOrDeleted(); },
          onError: (err) => toast.error(parseApiError(err).message),
        })}
        title="Leave Channel"
        description={`Leave #${channel.name}? You can be invited back later.`}
        confirmText="Leave"
        isDestructive
        isLoading={leaveChannel.isPending}
      />
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteChannel.mutate(channel.id, {
          onSuccess: () => { toast.success(`#${channel.name} deleted`); setShowDeleteConfirm(false); onLeftOrDeleted(); },
          onError: (err) => toast.error(parseApiError(err).message),
        })}
        title="Delete Channel"
        description={`Permanently delete #${channel.name}? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
        isLoading={deleteChannel.isPending}
      />

      {showRenameModal && (
        <RenameChannelModal
          currentName={channel.name ?? ''}
          isPending={renameChannel.isPending}
          onClose={() => setShowRenameModal(false)}
          onSubmit={(newName) =>
            renameChannel.mutate(
              { channelId: channel.id, name: newName },
              {
                onSuccess: () => {
                  toast.success('Channel renamed');
                  setShowRenameModal(false);
                },
                onError: (err) => toast.error(parseApiError(err).message),
              },
            )
          }
        />
      )}
    </div>
  );
}

function RenameChannelModal({
  currentName,
  isPending,
  onClose,
  onSubmit,
}: {
  currentName: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-modal">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-text-secondary hover:bg-surface-muted transition-colors"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-text-primary">Rename Channel</h2>
        <p className="mt-0.5 text-xs text-text-secondary">Enter a new name for this channel.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed && trimmed !== currentName) onSubmit(trimmed);
          }}
          className="mt-5 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="rename-channel-name">
              Channel name
            </label>
            <Input
              id="rename-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim() || name.trim() === currentName}
            >
              {isPending ? <><Loader2 size={14} className="animate-spin mr-1.5" />Renaming…</> : 'Rename'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
