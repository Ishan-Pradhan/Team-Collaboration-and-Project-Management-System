import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import {
  Organization,
  OrganizationsResponse,
  CreateOrganizationResponse,
  OrganizationMembersResponse,
  InviteUserResponse,
  AcceptInviteResponse,
} from '@/types/organization.types';

// ─────────────────────────────────────────────────────────────
// GET /organizations  →  list current user's organizations
// ─────────────────────────────────────────────────────────────
export const useMyOrganizations = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await api.get<OrganizationsResponse>('/organizations');
      return res.data.data;
    },
  });
};

// ─────────────────────────────────────────────────────────────
// GET /organizations/slug/:slug  →  get organization by slug
// ─────────────────────────────────────────────────────────────
export const useOrganizationBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['organizations', 'slug', slug],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Organization }>(
        `/organizations/slug/${slug}`
      );
      return res.data.data;
    },
    enabled: !!slug,
  });
};

// ─────────────────────────────────────────────────────────────
// POST /organizations  →  create a new organization
// ─────────────────────────────────────────────────────────────
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post<CreateOrganizationResponse>('/organizations', { name });
      return res.data.data;
    },
    onSuccess: () => {
      // Refresh org list after creating
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};

// ─────────────────────────────────────────────────────────────
// GET /organizations/:orgId/members  →  list members
// ─────────────────────────────────────────────────────────────
export const useOrganizationMembers = (organizationId: string) => {
  return useQuery({
    queryKey: ['organizations', organizationId, 'members'],
    queryFn: async () => {
      const res = await api.get<OrganizationMembersResponse>(
        `/organizations/${organizationId}/members`
      );
      return res.data.data;
    },
    enabled: !!organizationId,
  });
};

// ─────────────────────────────────────────────────────────────
// POST /organizations/:orgId/invites  →  invite user by email
// ─────────────────────────────────────────────────────────────
export const useInviteUser = (organizationId: string) => {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await api.post<InviteUserResponse>(
        `/organizations/${organizationId}/invites`,
        { email }
      );
      return res.data.data;
    },
  });
};

// ─────────────────────────────────────────────────────────────
// POST /organizations/accept-invite  →  accept an invite token
// ─────────────────────────────────────────────────────────────
export const useAcceptInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const res = await api.post<AcceptInviteResponse>('/organizations/accept-invite', { token });
      return res.data.data;
    },
    onSuccess: () => {
      // Refresh org list after joining
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};

// ─────────────────────────────────────────────────────────────
// DELETE /organizations/:orgId/members/:userId  →  remove member
// ─────────────────────────────────────────────────────────────
export const useRemoveMember = (organizationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/organizations/${organizationId}/members/${userId}`);
    },
    onSuccess: () => {
      // Refresh member list
      queryClient.invalidateQueries({
        queryKey: ['organizations', organizationId, 'members'],
      });
    },
  });
};
