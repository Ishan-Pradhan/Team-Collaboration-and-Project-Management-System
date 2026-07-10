import { queueService, type NotifyUserParams, type NotifyNewMessageParams } from '../services/queue.service.js';

export type { NotifyUserParams, NotifyNewMessageParams };

export async function notifyUser(params: NotifyUserParams): Promise<void> {
  try {
    await queueService.enqueueNotifyUser(params);
  } catch (err) {
    console.error('[notifyUser] failed to enqueue notification job:', err);
  }
}

// Sibling to notifyUser(), not a variant of it — this event type has no
// email option at all, so a message-frequency email can never happen.
export async function notifyNewMessage(params: NotifyNewMessageParams): Promise<void> {
  try {
    await queueService.enqueueNotifyNewMessage(params);
  } catch (err) {
    console.error('[notifyNewMessage] failed to enqueue notification job:', err);
  }
}
