import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrganizationInviteEmail,
  sendNotificationEmail,
} from '../services/email.service.js';

async function processEmailJob(job: Job): Promise<void> {
  switch (job.name) {
    case 'send-verification-email':
      return sendVerificationEmail(job.data.to, job.data.token);
    case 'send-password-reset-email':
      return sendPasswordResetEmail(job.data.to, job.data.token);
    case 'send-invite-email':
      return sendOrganizationInviteEmail(
        job.data.to,
        job.data.orgName,
        job.data.token,
        job.data.invitedByName,
      );
    case 'send-notification-email':
      return sendNotificationEmail(job.data.to, job.data.subject, job.data.bodyText, job.data.link);
    default:
      throw new Error(`Unknown email job: ${job.name}`);
  }
}

export function startEmailWorker(): Worker {
  const worker = new Worker('email-queue', processEmailJob, { connection: redisConnection });
  worker.on('failed', (job, err) => {
    console.error(`[email-worker] job ${job?.name} (${job?.id}) failed:`, err);
  });
  return worker;
}
