'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { useOrgStore } from '@/store/org.store';

interface OrgScopedPayload {
  organizationId: string;
}

// Mirrors useChatSocket/useProjectSocket: one shared connection is joined to
// every org room the user belongs to, so handlers filter by organizationId
// before invalidating anything.
export function useOrgSocket(organizationId: string | undefined) {
  const qc = useQueryClient();
  const router = useRouter();
  const { currentOrg, clearCurrentOrg } = useOrgStore();

  useEffect(() => {
    if (!organizationId) return;

    const socket = connectSocket();

    const invalidateProjects = () => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'projects'] });
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'analytics'] });
    };

    const onProjectChanged = (project: { organizationId: string }) => {
      if (project.organizationId !== organizationId) return;
      invalidateProjects();
    };

    const onProjectDeleted = ({ organizationId: eventOrgId }: { id: string; organizationId: string }) => {
      if (eventOrgId !== organizationId) return;
      invalidateProjects();
    };

    const onProjectMemberUpdated = ({ projectId, organizationId: eventOrgId }: { projectId: string; organizationId: string }) => {
      if (eventOrgId !== organizationId) return;
      invalidateProjects();
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
    };

    const onOrgMemberChanged = ({ organizationId: eventOrgId }: OrgScopedPayload) => {
      if (eventOrgId !== organizationId) return;
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'bans'] });
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'dashboard'] });
    };

    const onOrgUpdated = (org: { id: string; slug: string }) => {
      if (org.id !== organizationId) return;
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['organizations', 'slug', org.slug] });
    };

    const onOrgDeleted = ({ id }: { id: string }) => {
      if (id !== organizationId) return;
      qc.invalidateQueries({ queryKey: ['organizations'] });
      if (currentOrg?.id === id) {
        clearCurrentOrg();
        router.push('/auth/workspace');
      }
    };

    socket.on('project:created', onProjectChanged);
    socket.on('project:updated', onProjectChanged);
    socket.on('project:deleted', onProjectDeleted);
    socket.on('project:member:updated', onProjectMemberUpdated);
    socket.on('org:member:removed', onOrgMemberChanged);
    socket.on('org:member:role-updated', onOrgMemberChanged);
    socket.on('org:member:banned', onOrgMemberChanged);
    socket.on('org:member:unbanned', onOrgMemberChanged);
    socket.on('org:updated', onOrgUpdated);
    socket.on('org:deleted', onOrgDeleted);

    return () => {
      socket.off('project:created', onProjectChanged);
      socket.off('project:updated', onProjectChanged);
      socket.off('project:deleted', onProjectDeleted);
      socket.off('project:member:updated', onProjectMemberUpdated);
      socket.off('org:member:removed', onOrgMemberChanged);
      socket.off('org:member:role-updated', onOrgMemberChanged);
      socket.off('org:member:banned', onOrgMemberChanged);
      socket.off('org:member:unbanned', onOrgMemberChanged);
      socket.off('org:updated', onOrgUpdated);
      socket.off('org:deleted', onOrgDeleted);
    };
    // currentOrg/clearCurrentOrg/router are stable-enough refs from their
    // respective libraries; re-subscribing only on organizationId keeps this
    // from tearing the listeners down on every unrelated org-store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, qc]);
}
