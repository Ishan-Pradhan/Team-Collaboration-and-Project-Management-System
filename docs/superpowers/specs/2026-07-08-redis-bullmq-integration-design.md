# Redis + BullMQ Integration

**Status:** Approved for planning
**Scope:** Introduce Redis to this backend for the first time, used exclusively as the BullMQ broker. Move all transactional email sending, in-app notification creation/broadcast, and the due-date reminder job off the request path and off `setInterval` and onto BullMQ queues processed by in-process workers. No caching layer, no session/refresh-token store, no Socket.io Redis adapter, no distributed rate limiting — those are separate, deferred subsystems from the original Technical Specification and are explicitly out of scope here.

## Background

`.agents/Technical Specification.md` describes Redis as backing four things: caching, BullMQ, refresh-token/session storage, and a Socket.io pub/sub adapter. None of that exists yet — this is a greenfield Redis integration. The actual current backend diverges from that spec in ways that matter for this work:

- Refresh tokens live in Postgres (`user.refreshToken`, set in `src/utils/token.utils.ts`), not Redis. Unchanged by this work.
- `src/utils/notify.ts`'s `notifyUser` and `notifyNewMessage` do everything inline and synchronously: mute-check → `notificationRepository.create`/`upsertMessageNotification` → `getIO().emit(...)` → (for `notifyUser` only) an **awaited** call to `sendNotificationEmail`, which itself awaits a Resend API call. A slow or failing Resend call currently delays whatever request triggered the notification.
- Four places call into `src/services/email.service.ts` synchronously and await a live Resend API call inside the request: `auth.controller.ts` (register, forgot-password), `verifications.controller.ts` (resend verification), `organization.controller.ts` (send invite), and `notify.ts` (generic notification email). Three of these also return a generated link (`verifyLink` / `resetLink` / `inviteLink`) in the API response.
- `src/jobs/dueDateReminders.job.ts` runs via `setInterval(run, 60 * 60 * 1000)`, started once from `index.ts`. It writes `Notification` rows directly via `notificationRepository.create` — no socket emit, no email. This behavior is intentionally preserved as-is; only the scheduling mechanism changes.
- Socket.io (`src/socket/index.ts`) runs single-instance with the in-memory adapter. Unchanged — workers run in the same process as the API server, so `getIO()` continues to work without any adapter.

## Design Principles

- Redis is introduced for exactly one purpose here: the BullMQ broker. Anything else from the Technical Specification's Redis section is a separate future spec.
- Workers run **in-process** with the Express server (`src/index.ts`), not as a separate deployable. This matches how the due-date job and Socket.io already run today, and keeps `getIO()` directly callable from worker code with no cross-process pub/sub needed.
- All transactional email — verification, password reset, org invite, and generic notification email — goes through `email-queue`. No direct `resend.emails.send` calls remain in controllers or in `notify.ts`.
- Link generation (`verifyLink`, `resetLink`, `inviteLink`) must stay synchronous because three controllers return the link in the HTTP response. This is solved by splitting each email-service function into a pure link-builder and a separate send step, not by blocking the response on the queue.
- The due-date reminder job's actual logic (`runTaskReminders`, `runPersonalEventReminders`) does not change at all — only its trigger moves from `setInterval` to a BullMQ repeatable job, gaining idempotent-across-restarts scheduling and automatic retry on failure.
- RMVCS still applies to background code: workers are orchestrators (like controllers) that call repositories and services; the queue connection setup is a `config/`, and enqueue helpers are a `service/` (third-party integration), matching how `email.service.ts` is already scoped.

## 1. Redis infrastructure

`backend/docker-compose.yml` gets a new `redis` service, mirroring the existing `db` service's style:

```yaml
redis:
  image: redis:7-alpine
  container_name: backend_redis
  restart: always
  ports:
    - "${DOCKER_REDIS_PORT:-6380}:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - backend_network
```

(Host port defaults to `6380` to avoid clashing with a locally-installed Redis, same reasoning as `DOCKER_DB_PORT` defaulting to `5433`.) The `app` service's `environment` block gets `REDIS_HOST=redis` / `REDIS_PORT=6379` added alongside the existing `DB_HOST=db` pattern.

`src/config/env.ts` gets a new required var:
```ts
REDIS_URL: z.string().min(1),
```
placed near the Database block. No default — matches how `DB_HOST` etc. have no defaults either; forces an explicit value in every environment.

New `src/config/redis.ts`:
```ts
import IORedis from 'ioredis';
import { env } from './env.js';

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
```
`maxRetriesPerRequest: null` is BullMQ's documented requirement for the connection it's handed — without it, BullMQ's blocking commands (`BRPOPLPUSH` etc.) can fail under retry.

New dependencies: `bullmq`, `ioredis`.

**What you need to do:** after this lands, run `docker compose up -d redis` from `backend/` (or `docker compose up -d` for the full stack), and add `REDIS_URL=redis://localhost:6380` (or `redis://redis:6379` if running the app in Docker too) to `backend/.env`.

## 2. Queues and workers (`src/services/queue.service.ts`, `src/workers/`)

Two queues, both connected via `redisConnection`:

```ts
export const emailQueue = new Queue('email-queue', { connection: redisConnection });
export const notificationQueue = new Queue('notification-queue', { connection: redisConnection });
```

Default job options, applied per-queue:
- `email-queue`: `attempts: 3`, `backoff: { type: 'exponential', delay: 1000 }`, `removeOnComplete: { count: 500 }`, `removeOnFail: { count: 1000 }`.
- `notification-queue`: `attempts: 3`, `backoff: { type: 'exponential', delay: 500 }`, same removal limits.

`queue.service.ts` exposes typed enqueue helpers rather than letting callers construct job payloads ad hoc:
```ts
enqueueVerificationEmail({ to, token }: { to: string; token: string }): Promise<void>
enqueuePasswordResetEmail({ to, token }: { to: string; token: string }): Promise<void>
enqueueInviteEmail({ to, orgName, token, invitedByName }): Promise<void>
enqueueNotificationEmail({ to, subject, bodyText, link }): Promise<void>
enqueueNotifyUser(params: NotifyUserParams): Promise<void>          // mirrors current notifyUser params
enqueueNotifyNewMessage(params: NotifyNewMessageParams): Promise<void>
```
Each is a thin `queue.add(jobName, payload)` call. This keeps job-name strings and payload shapes defined in exactly one place.

Workers are created and `.run()` (or started on construction, per BullMQ default) from `src/index.ts`, after the Redis connection and DB connection are both established, alongside where `startDueDateReminderJob()` is called today (that call is removed — see §4).

## 3. Email flow

`src/services/email.service.ts` splits each of the three link-bearing functions into a pure builder plus a send function that calls it:

```ts
export const buildVerifyLink = (token: string) => `...`;
export const buildResetLink = (token: string) => `...`;
export const buildInviteLink = (token: string) => `...`;

export const sendVerificationEmail = async (to: string, token: string) => {
  const verifyLink = buildVerifyLink(token);
  await getResendClient().emails.send({ ...html: verifyEmailTemplate(verifyLink) });
};
// sendPasswordResetEmail, sendOrganizationInviteEmail follow the same split
```
`sendVerificationEmail` etc. no longer return `{ verifyLink }` — callers that need the link call `buildVerifyLink` directly. `sendNotificationEmail` needs no split; it already takes a precomputed `link`.

Call-site changes (all four):

- **`auth.controller.ts` register** (currently line ~68): compute `const verifyLink = buildVerifyLink(verificationToken)` synchronously for the response; replace `await sendVerificationEmail(...)` with `await queueService.enqueueVerificationEmail({ to: newUser.email, token: verificationToken })`. `verificationEmailSent` is set to `true` once enqueue resolves (enqueue only fails if Redis itself is unreachable, same try/catch-and-log pattern as today).
- **`auth.controller.ts` forgot-password** (currently line ~360): same pattern — `sendPasswordResetEmail` call becomes `enqueuePasswordResetEmail`; no link is returned here today so no builder call needed at the call site.
- **`verifications.controller.ts` resendVerificationEmail** (currently line ~100): same as register — `buildVerifyLink` for the response, `enqueueVerificationEmail` for sending.
- **`organization.controller.ts` invite** (currently line ~201): `buildInviteLink(token)` for the response, `enqueueInviteEmail({ to, orgName, token, invitedByName })` for sending.
- **`notify.ts`** (currently line ~60-61): the dynamic `import('../services/email.service.js')` + `sendNotificationEmail` call is removed entirely from `notify.ts` — email dispatch for notifications moves into `notification.worker.ts` (see §5), which calls `queueService.enqueueNotificationEmail` after handling the in-app notification.

`src/workers/email.worker.ts`:
```ts
new Worker('email-queue', async (job) => {
  switch (job.name) {
    case 'send-verification-email': return sendVerificationEmail(job.data.to, job.data.token);
    case 'send-password-reset-email': return sendPasswordResetEmail(job.data.to, job.data.token);
    case 'send-invite-email': return sendOrganizationInviteEmail(job.data.to, job.data.orgName, job.data.token, job.data.invitedByName);
    case 'send-notification-email': return sendNotificationEmail(job.data.to, job.data.subject, job.data.bodyText, job.data.link);
  }
}, { connection: redisConnection });
```
A job throwing (Resend API error) is retried per the queue's default `attempts`/`backoff`; after exhausting retries it lands in the failed set (bounded by `removeOnFail`), matching today's "log and move on" behavior but with automatic retries first.

## 4. Notification flow

`src/utils/notify.ts`'s two exports become producers only:
```ts
export async function notifyUser(params: NotifyUserParams): Promise<void> {
  await queueService.enqueueNotifyUser(params);
}
export async function notifyNewMessage(params: NotifyNewMessageParams): Promise<void> {
  await queueService.enqueueNotifyNewMessage(params);
}
```
All current call sites of `notifyUser`/`notifyNewMessage` are unchanged — they already treat this as fire-and-forget-ish async calls, so swapping the body for an enqueue is transparent to callers.

`src/workers/notification.worker.ts` gets the logic moved out of `notify.ts` verbatim:
```ts
new Worker('notification-queue', async (job) => {
  if (job.name === 'notify-user') {
    const { email, userId, organizationId, projectId, type, title, body, entityType, entityId } = job.data;
    if (await isOrgMuted(userId, organizationId)) return;
    const notification = await notificationRepository.create({ userId, organizationId, projectId: projectId ?? null, type, title, body, entityType, entityId });
    getIO().to(`user:${userId}`).emit('notification:new', serializeNotification(notification));
    if (email) await queueService.enqueueNotificationEmail(email);
  }
  if (job.name === 'notify-new-message') {
    const { userId, organizationId, channelId } = job.data;
    if (await isOrgMuted(userId, organizationId)) return;
    if (await isChannelMuted(userId, channelId)) return;
    const notification = await notificationRepository.upsertMessageNotification(job.data);
    getIO().to(`user:${userId}`).emit('notification:new', serializeNotification(notification));
  }
}, { connection: redisConnection });
```
`isOrgMuted`/`isChannelMuted` helper functions move from `notify.ts` into this worker file (they're only used here now). Error handling inside `notifyUser`'s current try/catch-and-log becomes BullMQ's retry-then-fail — a transient DB or socket error now gets retried automatically instead of being swallowed on the first attempt.

## 5. Due-date reminder job

`src/jobs/dueDateReminders.job.ts` keeps `runTaskReminders` and `runPersonalEventReminders` completely unchanged. What changes:

- `startDueDateReminderJob()` (the `setInterval` wrapper) is deleted.
- `src/workers/dueDateReminder.worker.ts` is added:
  ```ts
  new Worker('notification-queue', async (job) => {
    if (job.name === 'due-date-check') {
      await runTaskReminders();
      await runPersonalEventReminders();
    }
  }, { connection: redisConnection });
  ```
  This runs on the same `notification-queue` as §4 rather than a third queue — it's a scheduling trigger, not a distinct broker concern, and one queue means one place to look at for notification-related background activity. (In practice this worker's processor can be merged into `notification.worker.ts` as a third `job.name` branch rather than a separate file — final file layout is an implementation-time call, not a design constraint.)
- Registered once at startup via BullMQ's job scheduler, not a raw `repeat` option, so restarts don't create duplicate schedules:
  ```ts
  await notificationQueue.upsertJobScheduler(
    'due-date-check-scheduler',
    { every: 60 * 60 * 1000 },
    { name: 'due-date-check' }
  );
  ```
  Called once from `src/index.ts` at startup, replacing the removed `startDueDateReminderJob()` call. `upsertJobScheduler` alone does not run immediately — the first scheduled run happens up to an hour after boot. The original job intentionally ran immediately on startup to avoid reminders lagging by up to an hour after every deploy, so that property is preserved explicitly: `index.ts` also calls `notificationQueue.add('due-date-check', {})` once at startup, in addition to registering the scheduler.

## 6. File-level summary

| File | Change |
|---|---|
| `backend/docker-compose.yml` | + `redis` service, `app` env additions |
| `backend/package.json` | + `bullmq`, `ioredis` |
| `src/config/env.ts` | + `REDIS_URL` |
| `src/config/redis.ts` | new — shared `ioredis` connection |
| `src/services/queue.service.ts` | new — `Queue` instances + typed enqueue helpers |
| `src/workers/email.worker.ts` | new |
| `src/workers/notification.worker.ts` | new — includes due-date-check handling (see §5 note) |
| `src/services/email.service.ts` | split send functions into builder + send |
| `src/utils/notify.ts` | body replaced with enqueue calls; mute-check helpers move to worker |
| `src/jobs/dueDateReminders.job.ts` | remove `startDueDateReminderJob`; keep reminder functions, export them for the worker |
| `src/controllers/auth.controller.ts` | 2 call sites: builder + enqueue instead of direct send |
| `src/controllers/verifications.controller.ts` | 1 call site: builder + enqueue |
| `src/controllers/organization.controller.ts` | 1 call site: builder + enqueue |
| `src/index.ts` | start workers, register job scheduler, remove old job start call |

## Explicitly out of scope

- Caching (`user:{id}`, `org:{id}:members`, etc. from the Technical Specification's §9) — no cache reads/writes added anywhere.
- Refresh-token/session storage — stays in Postgres.
- Socket.io Redis adapter — not needed while workers are in-process and Socket.io remains single-instance.
- Distributed rate limiting — `express-rate-limit`'s in-memory store is unchanged.

These were surfaced during scoping as candidate uses of Redis but were explicitly deferred in favor of the BullMQ-only integration described here.
