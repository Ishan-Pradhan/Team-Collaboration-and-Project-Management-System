import { api } from '@/lib/axios';
import type {
  PlatformStats,
  GrowthStats,
  AdminUser,
  AdminOrganizationSummary,
  AdminOrganizationDetail,
  AuditLogEntry,
  PaginatedResponse,
} from '@/types/admin.types';

export async function getPlatformStats(): Promise<PlatformStats> {
  const res = await api.get<{ success: boolean; message: string; data: PlatformStats }>('/admin/stats');
  return res.data.data;
}

export async function getGrowthStats(days = 30): Promise<GrowthStats> {
  const res = await api.get<{ success: boolean; message: string; data: GrowthStats }>('/admin/stats/growth', {
    params: { days },
  });
  return res.data.data;
}

export async function getAdminUsers(params: { page?: number; limit?: number; search?: string }) {
  const res = await api.get<PaginatedResponse<AdminUser>>('/admin/users', { params });
  return res.data.data;
}

export async function toggleBlockUser(userId: string): Promise<void> {
  await api.patch(`/admin/toggle-block/${userId}`);
}

export async function promoteUser(userId: string): Promise<AdminUser> {
  const res = await api.patch<{ success: boolean; message: string; data: AdminUser }>(`/admin/users/${userId}/promote`);
  return res.data.data;
}

export async function demoteUser(userId: string): Promise<AdminUser> {
  const res = await api.patch<{ success: boolean; message: string; data: AdminUser }>(`/admin/users/${userId}/demote`);
  return res.data.data;
}

export async function getAdminOrganizations(): Promise<AdminOrganizationSummary[]> {
  const res = await api.get<{ success: boolean; message: string; data: AdminOrganizationSummary[] }>('/admin/organizations');
  return res.data.data;
}

export async function getAdminOrganizationDetail(organizationId: string): Promise<AdminOrganizationDetail> {
  const res = await api.get<{ success: boolean; message: string; data: AdminOrganizationDetail }>(
    `/admin/organizations/${organizationId}`
  );
  return res.data.data;
}

export async function toggleSuspendOrganization(organizationId: string): Promise<void> {
  await api.patch(`/admin/organizations/${organizationId}/toggle-suspend`);
}

export async function toggleOrgFeature(
  organizationId: string,
  flag: 'chatEnabled' | 'calendarEnabled',
  enabled: boolean,
): Promise<void> {
  await api.patch(`/admin/organizations/${organizationId}/features`, { flag, enabled });
}

export async function getAuditLog(params: { page?: number; limit?: number }) {
  const res = await api.get<PaginatedResponse<AuditLogEntry>>('/admin/audit-log', { params });
  return res.data.data;
}
