'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, Hash, Lock, LogOut, MoreVertical, Paperclip, Trash2, Users } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import { useChannelMembers, useLeaveChannel, useDeleteChannel, useMutedChannels, useMuteChannel } from '@/hooks/useChannel';
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
}

export default function ChannelView({ channel, organizationId, isAdmin, onLeftOrDeleted }: Props) {
  const { data: members } = useChannelMembers(channel.id);
  const leaveChannel = useLeaveChannel(organizationId, channel.id);
  const deleteChannel = useDeleteChannel(organizationId);
  const { data: mutedChannelIds } = useMutedChannels();
  const muteChannel = useMuteChannel();
  const isMuted = mutedChannelIds?.includes(channel.id) ?? false;

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeView, setActiveView] = useState<'messages' | 'files'>('messages');
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2.5">
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
              <h2 className="text-base font-semibold text-text-primary">{channel.dmParticipant?.name ?? 'Unknown'}</h2>
            </>
          ) : (
            <>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                {channel.type === 'PUBLIC' ? <Hash size={15} className="text-text-secondary" /> : <Lock size={15} className="text-text-secondary" />}
              </div>
              <h2 className="text-base font-semibold text-text-primary">{channel.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                <Users size={11} />
                {members?.length ?? 0}
              </span>
            </>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex items-center justify-center rounded-lg p-1.5 text-text-secondary hover:bg-surface-muted transition-colors"
            title="Channel options"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-border-subtle bg-white py-1 shadow-modal">
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
    </div>
  );
}
