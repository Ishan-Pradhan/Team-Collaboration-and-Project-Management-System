import type { OrganizationFeatureFlags } from './organization.types';

export interface PlatformStats {
  totalUsers: number;
  blockedUsers: number;
  adminUsers: number;
  totalOrganizations: number;
  suspendedOrgs: number;
  totalProjects: number;
  totalTasks: number;
}

export interface GrowthPoint {
  date: string;
  count: number;
}

export interface GrowthStats {
  users: GrowthPoint[];
  organizations: GrowthPoint[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'SUPER_ADMIN';
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AdminOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  isSuspended: boolean;
  featureFlags: OrganizationFeatureFlags;
  ownerId: string;
  createdAt: string;
  owner?: { id: string; name: string; email: string };
}

export interface AdminOrganizationDetail {
  org: AdminOrganizationSummary;
  memberCount: number;
  projectCount: number;
  taskCount: number;
  attachmentCount: number;
  lastActivityAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: 'user' | 'organization';
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: { items: T[]; meta: PaginationMeta };
}
