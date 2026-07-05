export interface PersonalEvent {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalEventsResponse {
  success: boolean;
  message: string;
  data: PersonalEvent[];
}

export interface PersonalEventResponse {
  success: boolean;
  message: string;
  data: PersonalEvent;
}
