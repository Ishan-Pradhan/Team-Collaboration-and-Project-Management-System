import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { serializeNotification } from '../serializers/notification.serializer.js';
import { getIO } from '../socket/index.js';
import { channelMemberRepository } from '../repositories/channel.repository.js';
import { organizationMemberRepository } from '../repositories/organization.repository.js';
import { queueService, type NotifyUserParams, type NotifyNewMessageParams } from '../services/queue.service.js';
import { runTaskReminders, runPersonalEventReminders } from '../jobs/dueDateReminders.job.js';

async function isOrgMuted(userId: string, organizationId: string): Promise<boolean> {
  const membership = await organizationMemberRepository.findOne({ organizationId, userId });
  return membership?.isMuted ?? false;
}

async function isChannelMuted(userId: string, channelId: string): Promise<boolean> {
  const membership = await channelMemberRepository.findMember(channelId, userId);
  return membership?.isMuted ?? false;
}

async function processNotifyUser(data: NotifyUserParams): Promise<void> {
  const { email, userId, organizationId, projectId, type, title, body, entityType, entityId } = data;

  if (await isOrgMuted(userId, organizationId)) return;

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

  if (email) {
    await queueService.enqueueNotificationEmail(email);
  }
}

async function processNotifyNewMessage(data: NotifyNewMessageParams): Promise<void> {
  const { userId, organizationId, channelId } = data;

  if (await isOrgMuted(userId, organizationId)) return;
  if (await isChannelMuted(userId, channelId)) return;

  const notification = await notificationRepository.upsertMessageNotification(data);
  getIO().to(`user:${userId}`).emit('notification:new', serializeNotification(notification));
}

async function processNotificationJob(job: Job): Promise<void> {
  switch (job.name) {
    case 'notify-user':
      return processNotifyUser(job.data);
    case 'notify-new-message':
      return processNotifyNewMessage(job.data);
    case 'due-date-check':
      await runTaskReminders();
      await runPersonalEventReminders();
      return;
    default:
      throw new Error(`Unknown notification job: ${job.name}`);
  }
}

export function startNotificationWorker(): Worker {
  const worker = new Worker('notification-queue', processNotificationJob, {
    connection: redisConnection,
    drainDelay: 30000,
    stalledInterval: 60000,
  });
  worker.on('error', (err) => {
    console.error('[notification-worker] Queue error:', err.message);
  });
  worker.on('failed', (job, err) => {
    console.error(`[notification-worker] job ${job?.name} (${job?.id}) failed:`, err);
  });
  return worker;
}
