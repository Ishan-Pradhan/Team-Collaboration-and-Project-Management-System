'use client';

import { toast } from 'sonner';
import { Loader2, UserPlus, X } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import {
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
} from '@/hooks/useProject';
import { useOrganizationMembers } from '@/hooks/useOrganization';

interface Props {
  projectId: string;
  organizationId: string;
  createdById: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ManageProjectMembersModal({
  projectId,
  organizationId,
  createdById,
  isOpen,
  onClose,
}: Props) {
  const { data: projectMembers, isLoading: projectMembersLoading } =
    useProjectMembers(projectId);
  const { data: orgMembers, isLoading: orgMembersLoading } =
    useOrganizationMembers(organizationId);

  const addMember = useAddProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);

  if (!isOpen) return null;

  const projectMemberUserIds = new Set(projectMembers?.map((m) => m.userId) ?? []);
  const addableMembers = orgMembers?.filter((m) => !projectMemberUserIds.has(m.userId)) ?? [];

  const handleAdd = (userId: string, name: string) => {
    addMember.mutate(userId, {
      onSuccess: () => toast.success(`${name} added to project`),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleRemove = (userId: string, name: string) => {
    removeMember.mutate(userId, {
      onSuccess: () => toast.success(`${name} removed from project`),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const isLoading = projectMembersLoading || orgMembersLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Manage Project Members</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              Add or remove members from this project.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : (
          <div className="divide-y divide-border-subtle max-h-[70vh] overflow-y-auto">
            {/* Current Members Section */}
            <div className="px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Current Members ({projectMembers?.length ?? 0})
              </h3>
              {projectMembers && projectMembers.length > 0 ? (
                <ul className="space-y-2">
                  {projectMembers.map((member) => {
                    const name = member.user?.name ?? 'Unknown User';
                    const email = member.user?.email ?? '';
                    const isCreator = member.userId === createdById;

                    return (
                      <li
                        key={member.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/5 text-sm font-semibold text-primary">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary leading-none">
                              {name}
                              {isCreator && (
                                <span className="ml-2 rounded bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-text-secondary">
                                  Creator
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-xs text-text-secondary">{email}</p>
                          </div>
                        </div>
                        {!isCreator && (
                          <button
                            onClick={() => handleRemove(member.userId, name)}
                            disabled={removeMember.isPending}
                            className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                            title="Remove from project"
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

            {/* Add Members Section */}
            <div className="px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Add Members ({addableMembers.length} available)
              </h3>
              {addableMembers.length > 0 ? (
                <ul className="space-y-2">
                  {addableMembers.map((orgMember) => {
                    const name = orgMember.user?.name ?? 'Unknown User';
                    const email = orgMember.user?.email ?? '';

                    return (
                      <li
                        key={orgMember.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-text-secondary">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary leading-none">
                              {name}
                            </p>
                            <p className="mt-0.5 text-xs text-text-secondary">{email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAdd(orgMember.userId, name)}
                          disabled={addMember.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
                        >
                          <UserPlus size={12} />
                          Add
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">
                  All organization members are already in this project.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
