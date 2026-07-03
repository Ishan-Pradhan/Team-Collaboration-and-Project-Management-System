export type NotificationEntityType = 'channel' | 'project' | 'task' | 'organization';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  organizationId: string;
  projectId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface NotificationsResponse {
  success: boolean;
  message: string;
  data: {
    notifications: Notification[];
    meta: PaginationMeta;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  message: string;
  data: { count: number };
}

export interface UnreadChannel {
  channelId: string;
  title: string;
  body: string | null;
  createdAt: string;
}

export interface UnreadChannelsResponse {
  success: boolean;
  message: string;
  data: UnreadChannel[];
}
