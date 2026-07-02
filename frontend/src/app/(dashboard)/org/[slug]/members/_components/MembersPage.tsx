'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useOrganizationBySlug,
  useOrganizationMembers,
  useInviteUser,
  useRemoveMember,
  useLeaveOrganization,
  useDeleteOrganization,
  usePendingInvites,
  useRevokeInvite,
  useChangeMemberRole,
  useOrganizationBans,
  useBanMember,
  useUnbanMember,
} from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';
import { useOrgStore } from '@/store/org.store';
import { parseApiError } from '@/lib/axios';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  Clock,
  Loader2,
  LogOut,
  Mail,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MembersSkeleton } from '@/components/shared/skeletons/MembersSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { cn } from '@/lib/utils';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import UserProfileDialog from '@/components/shared/UserProfileDialog';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function MembersPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const { clearCurrentOrg } = useOrgStore();
  const { data: org, isLoading: orgLoading } = useOrganizationBySlug(slug);
  const { data: members, isLoading: membersLoading } = useOrganizationMembers(org?.id ?? '');
  const { data: pendingInvites, isLoading: invitesLoading } = usePendingInvites(org?.id ?? '');

  const [activeTab, setActiveTab] = useState<'members' | 'invites' | 'bans'>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);

  const inviteMutation = useInviteUser(org?.id ?? '');
  const removeMutation = useRemoveMember(org?.id ?? '');
  const leaveMutation = useLeaveOrganization(org?.id ?? '');
  const deleteMutation = useDeleteOrganization();
  const revokeInviteMutation = useRevokeInvite(org?.id ?? '');
  const changeRoleMutation = useChangeMemberRole(org?.id ?? '');
  const { data: bans, isLoading: bansLoading } = useOrganizationBans(org?.id ?? '');
  const banMutation = useBanMember(org?.id ?? '');
  const unbanMutation = useUnbanMember(org?.id ?? '');

  const [activeConfirm, setActiveConfirm] = useState<'remove' | 'revoke' | 'leave' | 'delete' | 'ban' | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<any>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  if (orgLoading || membersLoading) return <MembersSkeleton />;

  if (!org) {
    return (
      <ErrorState
        title="Workspace not found"
        message="This workspace does not exist or you don't have access."
      />
    );
  }

  const currentUserMembership = members?.find((m) => m.userId === currentUser?.id);
  const isAdmin = org.ownerId === currentUser?.id || currentUserMembership?.role === 'ORG_ADMIN';

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate(inviteEmail.toLowerCase().trim(), {
      onSuccess: (data) => {
        toast.success('Invitation generated successfully');
        if (data.inviteLink) {
          setInviteResult(data.inviteLink);
        } else {
          setInviteEmail('');
          setShowInviteModal(false);
        }
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleRemoveMember = (userId: string, name: string) => {
    setActiveConfirm('remove');
    setConfirmPayload({ userId, name });
  };

  const confirmRemoveMember = () => {
    if (!confirmPayload) return;
    removeMutation.mutate(confirmPayload.userId, {
      onSuccess: () => {
        toast.success(`${confirmPayload.name} removed successfully`);
        setActiveConfirm(null);
        setConfirmPayload(null);
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleBanMember = (userId: string, name: string) => {
    setActiveConfirm('ban');
    setConfirmPayload({ userId, name });
  };

  const confirmBanMember = () => {
    if (!confirmPayload) return;
    banMutation.mutate(confirmPayload.userId, {
      onSuccess: () => {
        toast.success(`${confirmPayload.name} banned`);
        setActiveConfirm(null);
        setConfirmPayload(null);
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleUnbanMember = (userId: string, name: string) => {
    unbanMutation.mutate(userId, {
      onSuccess: () => toast.success(`${name} unbanned`),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleRevokeInvite = (inviteId: string, email: string) => {
    setActiveConfirm('revoke');
    setConfirmPayload({ inviteId, email });
  };

  const confirmRevokeInvite = () => {
    if (!confirmPayload) return;
    revokeInviteMutation.mutate(confirmPayload.inviteId, {
      onSuccess: () => {
        toast.success('Invitation revoked');
        setActiveConfirm(null);
        setConfirmPayload(null);
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleChangeRole = (userId: string, role: 'ORG_ADMIN' | 'MEMBER', name: string) => {
    setOpenRoleDropdown(null);
    changeRoleMutation.mutate(
      { userId, role },
      {
        onSuccess: () =>
          toast.success(`${name} is now ${role === 'ORG_ADMIN' ? 'an Admin' : 'a Member'}`),
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      }
    );
  };

  const handleLeave = () => {
    setActiveConfirm('leave');
  };

  const confirmLeave = () => {
    leaveMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(`You have left ${org?.name}`);
        clearCurrentOrg();
        setActiveConfirm(null);
        router.push('/auth/workspace');
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Members</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage users who have access to this workspace.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setInviteResult(null);
              setShowInviteModal(true);
            }}
            className="flex items-center gap-1.5"
          >
            <UserPlus size={16} />
            <span>Invite Member</span>
          </Button>
        )}
      </div>

      {/* Tabs — only show "Pending Invites" tab to admins */}
      <div className="flex gap-1 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'members'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          Members
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('invites')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === 'invites'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <Mail size={13} />
            Pending Invites
            {pendingInvites && pendingInvites.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {pendingInvites.length}
              </span>
            )}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('bans')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === 'bans'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <Ban size={13} />
            Banned Users
            {bans && bans.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {bans.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border-subtle bg-surface-muted/50 text-xs font-semibold text-text-secondary">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {members?.map((member) => {
                  const name = member.user?.name || 'Unknown User';
                  const email = member.user?.email || 'N/A';
                  const isOwner = org.ownerId === member.userId;
                  const isSelf = currentUser?.id === member.userId;
                  const canEditRole = isAdmin && !isOwner && !isSelf;

                  return (
                    <tr key={member.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <button
                          onClick={() => setProfileUserId(member.userId)}
                          className="flex items-center gap-3 text-left"
                        >
                          {member.user?.avatarUrl ? (
                            <img
                              src={member.user.avatarUrl}
                              alt={name}
                              className="h-8 w-8 rounded-full object-cover hover:opacity-80 transition-opacity"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 text-primary font-semibold text-sm hover:opacity-80 transition-opacity">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-text-primary">{name}</span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-text-secondary">{email}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {canEditRole ? (
                          <div className="relative inline-block">
                            <button
                              onClick={() =>
                                setOpenRoleDropdown(
                                  openRoleDropdown === member.userId ? null : member.userId
                                )
                              }
                              className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
                            >
                              <UserCog size={11} />
                              {member.role === 'ORG_ADMIN' ? 'Admin' : 'Member'}
                              <ChevronDown size={11} />
                            </button>
                            {openRoleDropdown === member.userId && (
                              <div className="absolute left-0 top-full z-10 mt-1 w-36 rounded-lg border border-border-subtle bg-white py-1 shadow-modal">
                                {member.role !== 'ORG_ADMIN' && (
                                  <button
                                    onClick={() =>
                                      handleChangeRole(member.userId, 'ORG_ADMIN', name)
                                    }
                                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-surface-muted transition-colors"
                                  >
                                    <Shield size={12} className="text-brand" />
                                    Make Admin
                                  </button>
                                )}
                                {member.role !== 'MEMBER' && (
                                  <button
                                    onClick={() => handleChangeRole(member.userId, 'MEMBER', name)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-surface-muted transition-colors"
                                  >
                                    <UserPlus size={12} />
                                    Make Member
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                            {isOwner ? (
                              <>
                                <Shield size={12} className="text-brand" /> Owner
                              </>
                            ) : member.role === 'ORG_ADMIN' ? (
                              'Admin'
                            ) : (
                              'Member'
                            )}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {isSelf && !isOwner && (
                          <button
                            onClick={handleLeave}
                            disabled={leaveMutation.isPending}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                            title="Leave organization"
                          >
                            <LogOut size={13} />
                            Leave
                          </button>
                        )}
                        {isAdmin && !isOwner && !isSelf && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleBanMember(member.userId, name)}
                              disabled={banMutation.isPending}
                              className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                              title="Ban member"
                            >
                              <Ban size={16} />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.userId, name)}
                              disabled={removeMutation.isPending}
                              className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                              title="Remove member"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Invites Tab */}
      {activeTab === 'invites' && isAdmin && (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-card">
          {invitesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
            </div>
          ) : pendingInvites && pendingInvites.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-muted/50 text-xs font-semibold text-text-secondary">
                  <tr>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Invited By</th>
                    <th className="px-6 py-4">Expires</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pendingInvites.map((invite) => (
                    <tr
                      key={invite.id}
                      className="hover:bg-surface-hover/30 transition-colors"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-text-secondary" />
                          <span className="font-medium text-text-primary">{invite.email}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-text-secondary">
                        {invite.invitedBy?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                          <Clock size={12} />
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <button
                          onClick={() => handleRevokeInvite(invite.id, invite.email)}
                          disabled={revokeInviteMutation.isPending}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft/20 transition-colors disabled:opacity-50"
                        >
                          <X size={13} />
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Mail size={36} className="mb-3 text-text-secondary/40" />
              <p className="text-sm font-medium text-text-secondary">No pending invitations</p>
              <p className="mt-1 text-xs text-text-secondary/70">
                All invites have been accepted or none have been sent.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Banned Users Tab */}
      {activeTab === 'bans' && isAdmin && (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-card">
          {bansLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
            </div>
          ) : bans && bans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-muted/50 text-xs font-semibold text-text-secondary">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Banned By</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {bans.map((ban) => (
                    <tr key={ban.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <p className="font-medium text-text-primary">{ban.user?.name ?? 'Unknown User'}</p>
                          <p className="text-xs text-text-secondary">{ban.user?.email ?? 'N/A'}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-text-secondary">
                        {ban.bannedByUser?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                          <Clock size={12} />
                          {new Date(ban.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <button
                          onClick={() => handleUnbanMember(ban.userId, ban.user?.name ?? 'This user')}
                          disabled={unbanMutation.isPending}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                          Unban
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Ban size={36} className="mb-3 text-text-secondary/40" />
              <p className="text-sm font-medium text-text-secondary">No banned users</p>
              <p className="mt-1 text-xs text-text-secondary/70">
                Members you ban from this workspace will show up here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-modal">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute right-4 top-4 rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
            >
              <X size={16} />
            </button>

            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Mail size={18} className="text-brand" />
              Invite to workspace
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Invite a teammate to join this workspace.
            </p>

            {inviteResult ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-success-soft/15 border border-success/20 p-3.5 text-xs text-success">
                  <p className="font-semibold">Workspace invitation link generated!</p>
                  <p className="mt-1">In development mode, copy the URL below to accept it:</p>
                </div>
                <div className="relative rounded border border-border bg-surface p-2 text-xs font-mono select-all truncate">
                  {inviteResult}
                </div>
                <Button
                  onClick={() => {
                    setInviteResult(null);
                    setInviteEmail('');
                    setShowInviteModal(false);
                  }}
                  className="w-full mt-2"
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="invite-email"
                    className="text-xs font-semibold text-text-secondary"
                  >
                    Email Address
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="teammate@company.com"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={inviteMutation.isPending}
                    className="focus:border-brand"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowInviteModal(false)}
                    disabled={inviteMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteMutation.isPending || !inviteEmail.trim()}
                  >
                    {inviteMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Inviting...
                      </>
                    ) : (
                      'Send Invitation'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Close role dropdown on outside click */}
      {openRoleDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setOpenRoleDropdown(null)}
        />
      )}



      <ConfirmationDialog
        isOpen={activeConfirm === 'remove'}
        onClose={() => { setActiveConfirm(null); setConfirmPayload(null); }}
        onConfirm={confirmRemoveMember}
        title="Remove Member"
        description={`Are you sure you want to remove ${confirmPayload?.name} from this workspace?`}
        confirmText="Remove"
        isDestructive
        isLoading={removeMutation.isPending}
      />

      <ConfirmationDialog
        isOpen={activeConfirm === 'ban'}
        onClose={() => { setActiveConfirm(null); setConfirmPayload(null); }}
        onConfirm={confirmBanMember}
        title="Ban Member"
        description={`Ban ${confirmPayload?.name}? They will be removed and cannot rejoin this workspace unless unbanned.`}
        confirmText="Ban"
        isDestructive
        isLoading={banMutation.isPending}
      />

      <ConfirmationDialog
        isOpen={activeConfirm === 'revoke'}
        onClose={() => { setActiveConfirm(null); setConfirmPayload(null); }}
        onConfirm={confirmRevokeInvite}
        title="Revoke Invitation"
        description={`Revoke invitation for ${confirmPayload?.email}?`}
        confirmText="Revoke"
        isDestructive
        isLoading={revokeInviteMutation.isPending}
      />

      <ConfirmationDialog
        isOpen={activeConfirm === 'leave'}
        onClose={() => setActiveConfirm(null)}
        onConfirm={confirmLeave}
        title="Leave Workspace"
        description={`Are you sure you want to leave ${org?.name}? You will lose access to all projects.`}
        confirmText="Leave"
        isDestructive
        isLoading={leaveMutation.isPending}
      />

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
