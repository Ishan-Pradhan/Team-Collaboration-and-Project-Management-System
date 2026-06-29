import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyOrganizations,
  getOrganizationBySlug,
  createOrganization,
  updateOrganization,
  getOrganizationMembers,
  inviteUser,
  acceptInvite,
  removeMember,
} from '@/services/organization.service';

export const useMyOrganizations = () =>
  useQuery({ queryKey: ['organizations'], queryFn: getMyOrganizations });

export const useOrganizationBySlug = (slug: string) =>
  useQuery({
    queryKey: ['organizations', 'slug', slug],
    queryFn: () => getOrganizationBySlug(slug),
    enabled: !!slug,
  });

export const useCreateOrganization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
};

export const useUpdateOrganization = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string | null }) =>
      updateOrganization(organizationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
};

export const useOrganizationMembers = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'members'],
    queryFn: () => getOrganizationMembers(organizationId),
    enabled: !!organizationId,
  });

export const useInviteUser = (organizationId: string) =>
  useMutation({ mutationFn: (email: string) => inviteUser(organizationId, email) });

export const useAcceptInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
};

export const useRemoveMember = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(organizationId, userId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] }),
  });
};
