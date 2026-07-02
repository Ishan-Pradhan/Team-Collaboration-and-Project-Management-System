import { api } from '@/lib/axios';
import type {
  Organization,
  OrganizationMember,
  OrganizationsResponse,
  CreateOrganizationResponse,
  OrganizationMembersResponse,
  InviteUserResponse,
  AcceptInviteResponse,
  PendingInvite,
  PendingInvitesResponse,
  OrganizationBan,
  OrganizationBansResponse,
} from '@/types/organization.types';

export async function getMyOrganizations(): Promise<Organization[]> {
  const res = await api.get<OrganizationsResponse>('/organizations');
  return res.data.data;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization> {
  const res = await api.get<{ success: boolean; data: Organization }>(
    `/organizations/slug/${slug}`
  );
  return res.data.data;
}

export async function createOrganization(name: string): Promise<Organization> {
  const res = await api.post<CreateOrganizationResponse>('/organizations', { name });
  return res.data.data;
}

export async function updateOrganization(
  organizationId: string,
  data: { name: string; description?: string | null },
): Promise<Organization> {
  const res = await api.put<CreateOrganizationResponse>(`/organizations/${organizationId}`, data);
  return res.data.data;
}

export async function getOrganizationMembers(organizationId: string) {
  const res = await api.get<OrganizationMembersResponse>(
    `/organizations/${organizationId}/members`
  );
  return res.data.data;
}

export async function inviteUser(organizationId: string, email: string) {
  const res = await api.post<InviteUserResponse>(
    `/organizations/${organizationId}/invites`,
    { email }
  );
  return res.data.data;
}

export async function acceptInvite(token: string) {
  const res = await api.post<AcceptInviteResponse>('/organizations/accept-invite', { token });
  return res.data.data;
}

export async function removeMember(organizationId: string, userId: string): Promise<void> {
  await api.delete(`/organizations/${organizationId}/members/${userId}`);
}

export async function listPendingInvites(organizationId: string): Promise<PendingInvite[]> {
  const res = await api.get<PendingInvitesResponse>(`/organizations/${organizationId}/invites`);
  return res.data.data;
}

export async function revokeInvite(organizationId: string, inviteId: string): Promise<void> {
  await api.delete(`/organizations/${organizationId}/invites/${inviteId}`);
}

export async function changeMemberRole(
  organizationId: string,
  userId: string,
  role: 'ORG_ADMIN' | 'MEMBER'
): Promise<OrganizationMember> {
  const res = await api.patch<{ success: boolean; data: OrganizationMember }>(
    `/organizations/${organizationId}/members/${userId}/role`,
    { role }
  );
  return res.data.data;
}

export async function leaveOrganization(organizationId: string): Promise<void> {
  await api.delete(`/organizations/${organizationId}/members/me`);
}

export async function deleteOrganization(organizationId: string): Promise<void> {
  await api.delete(`/organizations/${organizationId}`);
}

export async function getOrganizationBans(organizationId: string): Promise<OrganizationBan[]> {
  const res = await api.get<OrganizationBansResponse>(`/organizations/${organizationId}/bans`);
  return res.data.data;
}

export async function banMember(organizationId: string, userId: string): Promise<void> {
  await api.post(`/organizations/${organizationId}/members/${userId}/ban`);
}

export async function unbanMember(organizationId: string, userId: string): Promise<void> {
  await api.delete(`/organizations/${organizationId}/bans/${userId}`);
}
