'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  useAdminOrganizations,
  useAdminOrganizationDetail,
  useToggleSuspendOrganization,
  useToggleOrgFeature,
} from '@/hooks/useAdmin';
import { parseApiError } from '@/lib/axios';
import { avatarColor } from '@/lib/avatarColor';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { AdminListSkeleton } from '@/components/shared/skeletons/AdminListSkeleton';

export default function AdminOrganizationsPage() {
  const { data: organizations, isLoading } = useAdminOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string; isSuspended: boolean } | null>(null);

  const { data: detail, isLoading: detailLoading } = useAdminOrganizationDetail(selectedOrgId);
  const toggleSuspend = useToggleSuspendOrganization();
  const toggleFeature = useToggleOrgFeature();

  const handleToggleFeature = (organizationId: string, flag: 'chatEnabled' | 'calendarEnabled', enabled: boolean) => {
    toggleFeature.mutate(
      { organizationId, flag, enabled },
      { onError: (err) => toast.error(parseApiError(err).message) }
    );
  };

  const confirmToggleSuspend = () => {
    if (!suspendTarget) return;
    toggleSuspend.mutate(suspendTarget.id, {
      onSuccess: () => {
        toast.success(suspendTarget.isSuspended ? 'Organization unsuspended' : 'Organization suspended');
        setSuspendTarget(null);
      },
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  if (isLoading) return <AdminListSkeleton rows={6} />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Organizations</h1>

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
        {organizations?.map((org) => (
          <div
            key={org.id}
            className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 hover:bg-surface-hover transition-colors"
          >
            <button onClick={() => setSelectedOrgId(org.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: avatarColor(org.name) }}
              >
                {org.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{org.name}</p>
                <p className="truncate text-xs text-text-muted">{org.owner?.email ?? 'Unknown owner'}</p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-3">
              {org.isSuspended ? (
                <span className="badge-danger">Suspended</span>
              ) : (
                <span className="badge-success">Active</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSuspendTarget({ id: org.id, name: org.name, isSuspended: org.isSuspended })}
              >
                {org.isSuspended ? 'Unsuspend' : 'Suspend'}
              </Button>
            </div>
          </div>
        ))}
        {organizations?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
              <Building2 className="text-text-muted" size={18} />
            </div>
            <p className="text-sm font-medium text-text-primary">No organizations yet</p>
            <p className="mt-1 text-sm text-text-muted">Workspaces will show up here once people create them.</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedOrgId} onOpenChange={(open) => !open && setSelectedOrgId(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{detail?.org.name ?? 'Organization'}</DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-text-secondary" size={20} />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-text-muted">Members</p>
                  <p className="font-medium text-text-primary">{detail.memberCount}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Projects</p>
                  <p className="font-medium text-text-primary">{detail.projectCount}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Tasks</p>
                  <p className="font-medium text-text-primary">{detail.taskCount}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Attachments</p>
                  <p className="font-medium text-text-primary">{detail.attachmentCount}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-text-muted">Last activity</p>
                  <p className="font-medium text-text-primary">
                    {detail.lastActivityAt ? new Date(detail.lastActivityAt).toLocaleString() : 'No activity yet'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-border-subtle pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Features</p>
                <label className="flex items-center gap-2.5 text-sm text-text-primary">
                  <Checkbox
                    checked={detail.org.featureFlags.chatEnabled}
                    onCheckedChange={(checked) => handleToggleFeature(detail.org.id, 'chatEnabled', checked === true)}
                  />
                  Chat enabled
                </label>
                <label className="flex items-center gap-2.5 text-sm text-text-primary">
                  <Checkbox
                    checked={detail.org.featureFlags.calendarEnabled}
                    onCheckedChange={(checked) => handleToggleFeature(detail.org.id, 'calendarEnabled', checked === true)}
                  />
                  Calendar enabled
                </label>
              </div>

              <div className="flex items-center gap-2 border-t border-border-subtle pt-4 text-xs text-text-secondary">
                {detail.org.isSuspended ? (
                  <>
                    <ShieldAlert size={14} className="text-danger" /> This organization is suspended
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} className="text-success" /> This organization is active
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={confirmToggleSuspend}
        title={suspendTarget?.isSuspended ? 'Unsuspend organization' : 'Suspend organization'}
        description={
          suspendTarget?.isSuspended
            ? `${suspendTarget?.name} will regain full access immediately.`
            : `${suspendTarget?.name} will lose access immediately. Members won't be able to use the app until unsuspended.`
        }
        confirmText={suspendTarget?.isSuspended ? 'Unsuspend' : 'Suspend'}
        isDestructive={!suspendTarget?.isSuspended}
        isLoading={toggleSuspend.isPending}
      />
    </div>
  );
}
