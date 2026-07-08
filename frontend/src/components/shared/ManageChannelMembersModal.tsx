'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserPlus, X } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import {
  useChannelMembers,
  useInviteChannelMember,
  useRemoveChannelMember,
} from '@/hooks/useChannel';
import { useOrganizationMembers } from '@/hooks/useOrganization';
import UserProfileDialog from '@/components/shared/UserProfileDialog';

interface Props {
  channelId: string;
  organizationId: string;
  isOpen: boolean;
  isAdmin: boolean;
  onClose: () => void;
}

export default function ManageChannelMembersModal({
  channelId,
  organizationId,
  isOpen,
  isAdmin,
  onClose,
}: Props) {
  const router = useRouter();
  const { data: channelMembers, isLoading: channelMembersLoading } = useChannelMembers(channelId);
  const { data: orgMembers, isLoading: orgMembersLoading } = useOrganizationMembers(organizationId);

  const inviteMember = useInviteChannelMember(channelId);
  const removeMember = useRemoveChannelMember(channelId);

  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  if (!isOpen) return null;

  const channelMemberUserIds = new Set(channelMembers?.map((m) => m.userId) ?? []);
  const invitableMembers = orgMembers?.filter((m) => !channelMemberUserIds.has(m.userId)) ?? [];

  const handleInvite = (userId: string, name: string) => {
    inviteMember.mutate(userId, {
      onSuccess: () => toast.success(`${name} added to channel`),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleRemove = (userId: string, name: string) => {
    removeMember.mutate(userId, {
      onSuccess: () => toast.success(`${name} removed from channel`),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const isLoading = channelMembersLoading || orgMembersLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-modal">
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Manage Channel Members</h2>
            <p className="mt-0.5 text-xs text-text-secondary">Add or remove members from this channel.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : (
          <div className="divide-y divide-border-subtle max-h-[70vh] overflow-y-auto">
            <div className="px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Current Members ({channelMembers?.length ?? 0})
              </h3>
              {channelMembers && channelMembers.length > 0 ? (
                <ul className="space-y-2">
                  {channelMembers.map((member) => {
                    const name = member.user?.name ?? 'Unknown User';
                    const email = member.user?.email ?? '';
                    return (
                      <li key={member.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-muted/50 transition-colors">
                        <button
                          onClick={() => setProfileUserId(member.userId)}
                          className="flex items-center gap-3 text-left"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/5 text-sm font-semibold text-primary hover:opacity-80 transition-opacity">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary leading-none">{name}</p>
                            <p className="mt-0.5 text-xs text-text-secondary">{email}</p>
                          </div>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemove(member.userId, name)}
                            disabled={removeMember.isPending}
                            className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                            title="Remove from channel"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">No members yet.</p>
              )}
            </div>

            <div className="px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Invite Members ({invitableMembers.length} available)
              </h3>
              {invitableMembers.length > 0 ? (
                <ul className="space-y-2">
                  {invitableMembers.map((orgMember) => {
                    const name = orgMember.user?.name ?? 'Unknown User';
                    const email = orgMember.user?.email ?? '';
                    return (
                      <li key={orgMember.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-text-secondary">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary leading-none">{name}</p>
                            <p className="mt-0.5 text-xs text-text-secondary">{email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleInvite(orgMember.userId, name)}
                          disabled={inviteMember.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
                        >
                          <UserPlus size={12} />
                          Invite
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">All organization members are already in this channel.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {profileUserId && (
        <UserProfileDialog
          userId={profileUserId}
          organizationId={organizationId}
          onClose={() => setProfileUserId(null)}
          onMessage={(userId) => {
            setProfileUserId(null);
            onClose();
            router.push(`?dmUserId=${userId}`);
          }}
        />
      )}
    </div>
  );
}
