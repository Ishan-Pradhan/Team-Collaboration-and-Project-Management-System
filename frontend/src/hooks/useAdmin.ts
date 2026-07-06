import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPlatformStats,
  getGrowthStats,
  getAdminUsers,
  toggleBlockUser,
  promoteUser,
  demoteUser,
  getAdminOrganizations,
  getAdminOrganizationDetail,
  toggleSuspendOrganization,
  toggleOrgFeature,
  getAuditLog,
} from '@/services/admin.service';

export const useAdminStats = () =>
  useQuery({ queryKey: ['admin', 'stats'], queryFn: getPlatformStats });

export const useAdminGrowth = (days = 30) =>
  useQuery({ queryKey: ['admin', 'stats', 'growth', days], queryFn: () => getGrowthStats(days) });

export const useAdminUsers = (params: { page?: number; limit?: number; search?: string }) =>
  useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => getAdminUsers(params),
  });

export const useToggleBlockUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleBlockUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const usePromoteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: promoteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useDemoteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: demoteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useAdminOrganizations = () =>
  useQuery({ queryKey: ['admin', 'organizations'], queryFn: getAdminOrganizations });

export const useAdminOrganizationDetail = (organizationId: string | null) =>
  useQuery({
    queryKey: ['admin', 'organizations', organizationId],
    queryFn: () => getAdminOrganizationDetail(organizationId as string),
    enabled: !!organizationId,
  });

export const useToggleSuspendOrganization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleSuspendOrganization,
    // Also invalidate the member-facing org queries (sidebar org switcher,
    // org overview) — otherwise anyone with the org already cached (staleTime
    // is 60s and refetchOnWindowFocus is off) keeps seeing pre-suspend state.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};

export const useToggleOrgFeature = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      flag,
      enabled,
    }: {
      organizationId: string;
      flag: 'chatEnabled' | 'calendarEnabled';
      enabled: boolean;
    }) => toggleOrgFeature(organizationId, flag, enabled),
    // Same reasoning as useToggleSuspendOrganization: the sidebar's nav-hiding
    // reads featureFlags off the member-facing ['organizations'] query, which
    // this mutation would otherwise leave stale for up to a minute.
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      qc.invalidateQueries({ queryKey: ['admin', 'organizations', variables.organizationId] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};

export const useAuditLog = (params: { page?: number; limit?: number }) =>
  useQuery({ queryKey: ['admin', 'audit-log', params], queryFn: () => getAuditLog(params) });
