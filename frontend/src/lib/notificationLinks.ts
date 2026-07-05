import type { Notification } from '@/types/notification.types';

export function resolveNotificationLink(
  notification: Notification,
  orgs: { id: string; slug: string }[] | undefined
): string | null {
  const org = orgs?.find((o) => o.id === notification.organizationId);
  if (!org) return null;

  switch (notification.entityType) {
    case 'channel':
      return `/org/${org.slug}/chat?channelId=${notification.entityId}`;
    case 'project':
      return `/org/${org.slug}/projects/${notification.entityId}`;
    case 'task':
      return notification.projectId
        ? `/org/${org.slug}/projects/${notification.projectId}?taskId=${notification.entityId}`
        : null;
    case 'personal_event':
      return `/org/${org.slug}/calendar`;
    default:
      return null;
  }
}
