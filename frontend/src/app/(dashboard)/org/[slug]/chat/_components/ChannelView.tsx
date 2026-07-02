'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Hash, Lock, LogOut, Trash2, Users } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import { useChannelMembers, useLeaveChannel, useDeleteChannel } from '@/hooks/useChannel';
import ManageChannelMembersModal from '@/components/shared/ManageChannelMembersModal';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { Channel } from '@/types/channel.types';
import MessagePane from './MessagePane';

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

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          {channel.type === 'PUBLIC' ? <Hash size={15} className="text-text-secondary" /> : <Lock size={15} className="text-text-secondary" />}
          <h2 className="text-sm font-semibold text-text-primary">{channel.name}</h2>
          <span className="text-xs text-text-secondary">{members?.length ?? 0} members</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowMembersModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <Users size={13} /> Members
          </button>
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <LogOut size={13} /> Leave
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft/20 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <MessagePane channel={channel} isAdmin={isAdmin} />
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
