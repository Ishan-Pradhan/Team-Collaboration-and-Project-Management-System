'use client';

import { use, useState } from 'react';
import { useOrganizationBySlug, useOrganizationMembers, useInviteUser, useRemoveMember } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import {
  Loader2,
  Mail,
  Plus,
  Shield,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function OrgMembersPage({ params }: PageProps) {
  const { slug } = use(params);
  const { user: currentUser } = useAuthStore();
  const { data: org, isLoading: orgLoading } = useOrganizationBySlug(slug);
  const { data: members, isLoading: membersLoading, refetch } = useOrganizationMembers(org?.id || '');

  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  const inviteMutation = useInviteUser(org?.id || '');
  const removeMutation = useRemoveMember(org?.id || '');

  if (orgLoading || membersLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-text-secondary" size={24} />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/10 p-6 text-center">
        <h2 className="text-lg font-semibold text-danger">Organization not found</h2>
      </div>
    );
  }

  // Check roles
  const currentUserMembership = members?.find((m) => m.userId === currentUser?.id);
  const isAdmin = org.ownerId === currentUser?.id || currentUserMembership?.role === 'ORG_ADMIN';

  const handleInviteSubmit = async (e: React.FormEvent) => {
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
      onError: (err: any) => {
        const errMsg = err.response?.data?.message || 'Failed to send invitation';
        toast.error(errMsg);
      },
    });
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from this workspace?`)) return;

    removeMutation.mutate(userId, {
      onSuccess: () => {
        toast.success(`${name} removed successfully`);
        refetch();
      },
      onError: (err: any) => {
        const errMsg = err.response?.data?.message || 'Failed to remove member';
        toast.error(errMsg);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Title + Invite CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Members</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage users who have access to this workspace.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setInviteResult(null); setShowInviteModal(true); }} className="flex items-center gap-1.5">
            <UserPlus size={16} />
            <span>Invite Member</span>
          </Button>
        )}
      </div>

      {/* Members table */}
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border-subtle bg-surface-muted/50 text-xs font-semibold text-text-secondary">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {members?.map((member) => {
                const name = member.user?.name || 'Unknown User';
                const email = member.user?.email || 'N/A';
                const isOwner = org.ownerId === member.userId;

                return (
                  <tr key={member.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 text-primary font-semibold text-sm">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-text-primary">{name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-text-secondary">
                      {email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
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
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {!isOwner && member.userId !== currentUser?.id && (
                          <button
                            onClick={() => handleRemoveMember(member.userId, name)}
                            className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal overlay */}
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
                <Button onClick={() => { setInviteResult(null); setInviteEmail(''); setShowInviteModal(false); }} className="w-full mt-2">
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="invite-email" className="text-xs font-semibold text-text-secondary">
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
                  <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()}>
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
    </div>
  );
}
