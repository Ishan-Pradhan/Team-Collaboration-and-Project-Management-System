import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

const defaultJobOptions = {
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
};

export const emailQueue = new Queue('email-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

export const notificationQueue = new Queue('notification-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    backoff: { type: 'exponential', delay: 500 },
  },
});

export interface NotifyEmailOptions {
  to: string;
  subject: string;
  bodyText: string;
  link: string;
}

export interface NotifyUserParams {
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

export interface NotifyNewMessageParams {
  userId: string;
  organizationId: string;
  channelId: string;
  title: string;
  body: string;
}

export const queueService = {
  enqueueVerificationEmail: async (data: { to: string; token: string }): Promise<void> => {
    await emailQueue.add('send-verification-email', data);
  },

  enqueuePasswordResetEmail: async (data: { to: string; token: string }): Promise<void> => {
    await emailQueue.add('send-password-reset-email', data);
  },

  enqueueInviteEmail: async (data: {
    to: string;
    orgName: string;
    token: string;
    invitedByName: string;
  }): Promise<void> => {
    await emailQueue.add('send-invite-email', data);
  },

  enqueueNotificationEmail: async (data: NotifyEmailOptions): Promise<void> => {
    await emailQueue.add('send-notification-email', data);
  },

  enqueueNotifyUser: async (data: NotifyUserParams): Promise<void> => {
    await notificationQueue.add('notify-user', data);
  },

  enqueueNotifyNewMessage: async (data: NotifyNewMessageParams): Promise<void> => {
    await notificationQueue.add('notify-new-message', data);
  },
};
