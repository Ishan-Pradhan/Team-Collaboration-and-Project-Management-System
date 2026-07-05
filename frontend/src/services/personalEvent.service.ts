import { api } from '@/lib/axios';
import type { PersonalEvent, PersonalEventsResponse, PersonalEventResponse } from '@/types/personalEvent.types';

export async function getPersonalEvents(organizationId: string): Promise<PersonalEvent[]> {
  const res = await api.get<PersonalEventsResponse>(`/organizations/${organizationId}/personal-events`);
  return res.data.data;
}

export async function createPersonalEvent(
  organizationId: string,
  data: { title: string; dueDate: string },
): Promise<PersonalEvent> {
  const res = await api.post<PersonalEventResponse>(`/organizations/${organizationId}/personal-events`, data);
  return res.data.data;
}

export async function deletePersonalEvent(organizationId: string, eventId: string): Promise<void> {
  await api.delete(`/organizations/${organizationId}/personal-events/${eventId}`);
}
