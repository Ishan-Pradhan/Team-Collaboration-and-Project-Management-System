import { notificationRepository } from '../repositories/notification.repository.js';
import { serializeNotification } from '../serializers/notification.serializer.js';
import { getIO } from '../socket/index.js';
import { channelMemberRepository } from '../repositories/channel.repository.js';
import { organizationMemberRepository } from '../repositories/organization.repository.js';

async function isOrgMuted(userId: string, organizationId: string): Promise<boolean> {
  const membership = await organizationMemberRepository.findOne({ organizationId, userId });
  return membership?.isMuted ?? false;
}

async function isChannelMuted(userId: string, channelId: string): Promise<boolean> {
  const membership = await channelMemberRepository.findMember(channelId, userId);
  return membership?.isMuted ?? false;
}

interface NotifyEmailOptions {
  to: string;
  subject: string;
  bodyText: string;
  link: string;
}

interface NotifyUserParams {
  userId: string;
  organizationId: string;
  projectId?: string | null;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  email?: NotifyEmailOptions;
}

export async function notifyUser(params: NotifyUserParams): Promise<void> {
  const { email, userId, organizationId, projectId, type, title, body, entityType, entityId } = params;

  if (await isOrgMuted(userId, organizationId)) return;

  try {
    const notification = await notificationRepository.create({
      userId,
      organizationId,
      projectId: projectId ?? null,
      type,
      title,
      body,
      entityType,
      entityId,
    });

    getIO().to(`user:${userId}`).emit('notification:new', serializeNotification(notification));
  } catch (err) {
    console.error('[notifyUser] failed to create/push notification:', err);
  }

  if (email) {
    try {
      const { sendNotificationEmail } = await import('../services/email.service.js');
      await sendNotificationEmail(email.to, email.subject, email.bodyText, email.link);
    } catch (err) {
      console.error('[notifyUser] failed to send notification email:', err);
    }
  }
}

interface NotifyNewMessageParams {
  userId: string;
  organizationId: string;
  channelId: string;
  title: string;
  body: string;
}

// Sibling to notifyUser(), not a variant of it — this event type has no
// email option at all, so a message-frequency email can never happen.
export async function notifyNewMessage(params: NotifyNewMessageParams): Promise<void> {
  const { userId, organizationId, channelId } = params;

  if (await isOrgMuted(userId, organizationId)) return;
  if (await isChannelMuted(userId, channelId)) return;

  try {
    const notification = await notificationRepository.upsertMessageNotification(params);
    getIO().to(`user:${params.userId}`).emit('notification:new', serializeNotification(notification));
  } catch (err) {
    console.error('[notifyNewMessage] failed to upsert/push message notification:', err);
  }
}
