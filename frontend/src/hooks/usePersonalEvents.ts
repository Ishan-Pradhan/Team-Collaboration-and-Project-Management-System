import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPersonalEvents, createPersonalEvent, deletePersonalEvent } from '@/services/personalEvent.service';

export const usePersonalEvents = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'personal-events'],
    queryFn: () => getPersonalEvents(organizationId),
    enabled: !!organizationId,
  });

export const useCreatePersonalEvent = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; dueDate: string }) => createPersonalEvent(organizationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'personal-events'] }),
  });
};

export const useDeletePersonalEvent = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => deletePersonalEvent(organizationId, eventId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'personal-events'] }),
  });
};
