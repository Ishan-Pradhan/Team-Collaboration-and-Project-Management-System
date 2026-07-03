# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing-but-unused `Notification` model into a working notification system: in-app real-time delivery (Socket.io + bell/dropdown/full page) and email, triggered by four events (channel member add/remove, project member add/remove, task assignment, task comments).

**Architecture:** A shared `notifyUser()` helper in `backend/src/utils/notify.ts` writes a `Notification` row (via a new repository), pushes it live over the existing `user:${userId}` Socket.io room, and sends an email — six controller call sites across `channel.controller.ts`, `project.controller.ts`, and `task.controller.ts` each call it once. The frontend adds a `notification.repository`-backed API surface (list/unread-count/mark-read), a socket listener that updates TanStack Query cache + fires a toast, and a bell/dropdown in the topbar plus a full `/notifications` page.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, Socket.io, Resend (email), Next.js 16, React 19, TanStack Query, Zustand, Radix UI, Tailwind v4, `sonner` (toasts), `lucide-react` (icons).

## Global Constraints

- Follow RMVCS strictly: controllers hold business logic, repositories hold all Sequelize access, services are third-party integrations only. Controllers never call Sequelize directly.
- Always use the `env` export from `backend/src/config/env.ts`, never `process.env` directly.
- All controllers are wrapped in `asyncHandler` (from `backend/src/utils/AsyncHandler.ts`) and use `ApiError`/`ok` for responses.
- No test runner exists in this repo. Verification is manual: `curl` for the backend, browser interaction for the frontend.
- No commit message in this plan includes a `Co-Authored-By` trailer.
- Frontend query keys follow the `['notifications', ...]` convention (see CLAUDE.md's Query key conventions section).

---

## Task 1: Data layer — `organizationId`/`projectId` on `Notifications`

**Files:**
- Create: `backend/src/sequelize/migrations/20260703000000-add-organization-project-id-to-notifications.js`
- Modify: `backend/src/models/notifications.model.ts`
- Modify: `backend/src/types/notifications.types.ts`
- Modify: `backend/src/controllers/organization.controller.ts:40` (the one existing `Notification.create` call site)

**Interfaces:**
- Consumes: existing `notifications` table (`tableName: 'notifications'`, created in `20260622000000-create-projects-and-related-tables.js`), existing `Organizations` table (`tableName: 'Organizations'`), existing `projects` table (`tableName: 'projects'`).
- Produces: `Notifications.organizationId: string` (required), `Notifications.projectId: string | null` (populated only for `entityType: 'task'` rows — the frontend needs it to build `/org/:slug/projects/:projectId?taskId=:entityId`, since a bare task id isn't a routable path segment on its own, unlike a channel or project id). Consumed by Task 2 (repository) and everything downstream.

- [ ] **Step 1: Write the migration**

Create `backend/src/sequelize/migrations/20260703000000-add-organization-project-id-to-notifications.js`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('notifications', 'organizationId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Organizations', key: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.addColumn('notifications', 'projectId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'projects', key: 'id' },
      onDelete: 'CASCADE',
    });

    // Backfill: the only notification type written before this migration
    // ('member_left') already stores the organization id as entityId
    // (entityType = 'organization').
    await queryInterface.sequelize.query(`
      UPDATE notifications
      SET "organizationId" = "entityId"
      WHERE "entityType" = 'organization' AND "organizationId" IS NULL
    `);

    await queryInterface.changeColumn('notifications', 'organizationId', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.addIndex('notifications', ['userId', 'isRead']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notifications', ['userId', 'isRead']);
    await queryInterface.removeColumn('notifications', 'projectId');
    await queryInterface.removeColumn('notifications', 'organizationId');
  },
};
```

- [ ] **Step 2: Check for rows the backfill can't cover**

Before running the migration, confirm every existing row is either empty or backfillable:

Run: `cd backend && npx sequelize-cli db:migrate:status` (sanity check migrations are in sync), then connect to the dev DB and run:

```sql
SELECT COUNT(*) FROM notifications WHERE "entityType" != 'organization' OR "entityType" IS NULL;
```

Expected: `0` (the only call site that has ever written a row uses `entityType: 'organization'`). If this is nonzero, stop and investigate those rows before proceeding — the `changeColumn` to `NOT NULL` in Step 1 will otherwise fail.

- [ ] **Step 3: Run the migration**

Run: `cd backend && npx sequelize-cli db:migrate`
Expected: `== 20260703000000-add-organization-project-id-to-notifications: migrated`

- [ ] **Step 4: Update the model**

In `backend/src/models/notifications.model.ts`, replace:

```ts
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
```

with:

```ts
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    type: {
```

- [ ] **Step 5: Update the types**

In `backend/src/types/notifications.types.ts`, replace the whole file:

```ts
import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';

export interface Notifications {
  id: string;
  userId: string;
  organizationId: string;
  projectId: string | null;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt?: Date;
  user?: UserInstance;
}

export type NotificationCreationAttributes = Optional<
  Notifications,
  'id' | 'projectId' | 'body' | 'entityType' | 'entityId' | 'isRead' | 'createdAt'
>;

export interface NotificationInstance
  extends Model<Notifications, NotificationCreationAttributes>, Notifications {}
```

- [ ] **Step 6: Fix the one existing call site**

In `backend/src/controllers/organization.controller.ts`, replace:

```ts
  await Promise.all(
    recipients.map((userId) =>
      Notification.create({
        userId,
        type: 'member_left',
        title,
        body,
        entityType: 'organization',
        entityId: organizationId,
      })
    )
  );
```

with:

```ts
  await Promise.all(
    recipients.map((userId) =>
      Notification.create({
        userId,
        organizationId,
        type: 'member_left',
        title,
        body,
        entityType: 'organization',
        entityId: organizationId,
      })
    )
  );
```

- [ ] **Step 7: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd backend
git add src/sequelize/migrations/20260703000000-add-organization-project-id-to-notifications.js \
  src/models/notifications.model.ts src/types/notifications.types.ts src/controllers/organization.controller.ts
git commit -m "feat(notifications): add organizationId/projectId columns to notifications"
```

---

## Task 2: Backend — notification repository

**Files:**
- Create: `backend/src/repositories/notification.repository.ts`

**Interfaces:**
- Consumes: `Notification` model (Task 1), `NotificationCreationAttributes`/`NotificationInstance` types (Task 1).
- Produces: `notificationRepository = { create, findByUser, countByUser, countUnread, markRead, markAllRead }`. Consumed by Task 3 (controller) and Task 4 (`notifyUser` helper).

- [ ] **Step 1: Write the repository**

Create `backend/src/repositories/notification.repository.ts`:

```ts
import { Notification } from '../models/index.js';
import type { NotificationCreationAttributes, NotificationInstance } from '../types/notifications.types.js';

export const notificationRepository = {
  create: async (data: NotificationCreationAttributes): Promise<NotificationInstance> => {
    return await Notification.create(data);
  },

  findByUser: async (userId: string, limit: number, offset: number): Promise<NotificationInstance[]> => {
    return await Notification.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  },

  countByUser: async (userId: string): Promise<number> => {
    return await Notification.count({ where: { userId } });
  },

  countUnread: async (userId: string): Promise<number> => {
    return await Notification.count({ where: { userId, isRead: false } });
  },

  markRead: async (id: string, userId: string): Promise<number> => {
    const [count] = await Notification.update({ isRead: true }, { where: { id, userId } });
    return count;
  },

  markAllRead: async (userId: string): Promise<void> => {
    await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  },
};
```

- [ ] **Step 2: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd backend
git add src/repositories/notification.repository.ts
git commit -m "feat(notifications): add notification repository"
```

---

## Task 3: Backend — serializer, controller, routes

**Files:**
- Create: `backend/src/serializers/notification.serializer.ts`
- Create: `backend/src/controllers/notification.controller.ts`
- Create: `backend/src/validations/notification.validation.ts`
- Create: `backend/src/routes/notification.routes.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `notificationRepository` (Task 2), `getPaginationParams`/`buildPaginationMeta` (`backend/src/utils/pagination.utils.ts`, pre-existing and currently unused anywhere), `verifyJWT` (`backend/src/middlewares/auth.middleware.ts`), `validate` (`backend/src/middlewares/validate.middleware.ts`).
- Produces: `serializeNotification(n: NotificationInstance)`; routes `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/mark-all-read`. Not consumed by any later backend task — this is the read-side API the frontend (Task 8) calls directly.

- [ ] **Step 1: Write the serializer**

Create `backend/src/serializers/notification.serializer.ts`:

```ts
import type { NotificationInstance } from '../types/notifications.types.js';

export const serializeNotification = (n: NotificationInstance) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  entityType: n.entityType,
  entityId: n.entityId,
  organizationId: n.organizationId,
  projectId: n.projectId,
  isRead: n.isRead,
  createdAt: n.createdAt,
});
```

- [ ] **Step 2: Write the validation schema**

Create `backend/src/validations/notification.validation.ts`:

```ts
import { z } from 'zod';

export const notificationParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
};
```

- [ ] **Step 3: Write the controller**

Create `backend/src/controllers/notification.controller.ts`:

```ts
import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { serializeNotification } from '../serializers/notification.serializer.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.utils.js';

export const listNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const { page, limit, offset } = getPaginationParams(req.query as { page?: string; limit?: string });

  const [notifications, totalItems] = await Promise.all([
    notificationRepository.findByUser(user.id, limit, offset),
    notificationRepository.countByUser(user.id),
  ]);

  return ok(
    res,
    {
      notifications: notifications.map(serializeNotification),
      meta: buildPaginationMeta({ totalItems, page, limit, itemCount: notifications.length }),
    },
    'Notifications retrieved successfully'
  );
});

export const getUnreadNotificationCount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const count = await notificationRepository.countUnread(user.id);
  return ok(res, { count }, 'Unread count retrieved successfully');
});

export const markNotificationRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');
  const { id } = req.params as { id: string };

  const updated = await notificationRepository.markRead(id, user.id);
  if (updated === 0) throw new ApiError(404, 'Notification not found');

  return ok(res, null, 'Notification marked as read');
});

export const markAllNotificationsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await notificationRepository.markAllRead(user.id);
  return ok(res, null, 'All notifications marked as read');
});
```

- [ ] **Step 4: Write the routes**

Create `backend/src/routes/notification.routes.ts`:

```ts
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller.js';
import { notificationParamSchema } from '../validations/notification.validation.js';

const router = Router();

router.route('/notifications').get(verifyJWT, listNotifications);
router.route('/notifications/unread-count').get(verifyJWT, getUnreadNotificationCount);
router.route('/notifications/mark-all-read').post(verifyJWT, markAllNotificationsRead);
router.route('/notifications/:id/read').patch(verifyJWT, validate(notificationParamSchema), markNotificationRead);

export default router;
```

- [ ] **Step 5: Mount the routes**

In `backend/src/index.ts`, replace:

```ts
import channelRoutes from './routes/channel.routes.js';
```

with:

```ts
import channelRoutes from './routes/channel.routes.js';
import notificationRoutes from './routes/notification.routes.js';
```

Then replace:

```ts
app.use("/api/v1", channelRoutes);
```

with:

```ts
app.use("/api/v1", channelRoutes);
app.use("/api/v1", notificationRoutes);
```

(`channel.routes.ts` is also not registered in `swagger.config.ts`'s file list — `notification.routes.ts` follows that same existing precedent and is intentionally not added there either.)

- [ ] **Step 6: Verify with curl**

Start the dev server (`cd backend && npm run dev`), log in as a dev account and save cookies to `/tmp/cookies.txt`, then:

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/notifications
```

Expected: `200` with `"data": { "notifications": [], "meta": { "totalItems": 0, ... } }` (empty until Task 5-7 wire up creation).

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/notifications/unread-count
```

Expected: `200` with `"data": { "count": 0 }`.

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/notifications/mark-all-read
```

Expected: `200`.

```bash
curl -b /tmp/cookies.txt -s -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:8080/api/v1/notifications/00000000-0000-0000-0000-000000000000/read
```

Expected: `404` (no such notification for this user).

- [ ] **Step 7: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd backend
git add src/serializers/notification.serializer.ts src/controllers/notification.controller.ts \
  src/validations/notification.validation.ts src/routes/notification.routes.ts src/index.ts
git commit -m "feat(notifications): add list/unread-count/mark-read endpoints"
```

---

## Task 4: Backend — `notifyUser()` helper + notification email template

**Files:**
- Create: `backend/src/utils/notify.ts`
- Modify: `backend/src/services/email.service.ts`

**Interfaces:**
- Consumes: `notificationRepository.create` (Task 2), `serializeNotification` (Task 3), `getIO` (`backend/src/socket/index.ts`).
- Produces: `notifyUser(params: NotifyUserParams): Promise<void>` and `sendNotificationEmail(to, subject, bodyText, link): Promise<void>`. Consumed by Task 5, 6, 7 (the six controller call sites).

- [ ] **Step 1: Add the generic email template + send function**

In `backend/src/services/email.service.ts`, replace:

```ts
// Send organization invitation email
export const sendOrganizationInviteEmail = async (
```

with:

```ts
// Send a generic notification email (channel/project/task events)
export const sendNotificationEmail = async (
  to: string,
  subject: string,
  bodyText: string,
  link: string,
) => {
  const from = env.EMAIL_FROM;
  const resend = getResendClient();

  await resend.emails.send({
    from,
    to,
    subject,
    html: notificationTemplate(subject, bodyText, link),
  });
};

// Send organization invitation email
export const sendOrganizationInviteEmail = async (
```

Then replace:

```ts
const orgInviteTemplate = (orgName: string, inviteLink: string, invitedByName: string) => `
```

with:

```ts
const notificationTemplate = (subject: string, bodyText: string, link: string) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2aaad5;">${subject}</h2>

      <p>${bodyText}</p>

      <a href="${link}"
         style="
           display: inline-block;
           padding: 12px 20px;
           margin: 16px 0;
           background-color: #2aaad5;
           color: #ffffff;
           text-decoration: none;
           border-radius: 6px;
           font-weight: bold;
         ">
         View in app
      </a>

      <p>If the button doesn't work, you can also use this link:</p>
      <p><a href="${link}">${link}</a></p>
    </div>
  `;

const orgInviteTemplate = (orgName: string, inviteLink: string, invitedByName: string) => `
```

- [ ] **Step 2: Write the `notifyUser` helper**

Create `backend/src/utils/notify.ts`:

```ts
import { notificationRepository } from '../repositories/notification.repository.js';
import { serializeNotification } from '../serializers/notification.serializer.js';
import { getIO } from '../socket/index.js';

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
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/utils/notify.ts src/services/email.service.ts
git commit -m "feat(notifications): add notifyUser helper and notification email template"
```

---

## Task 5: Backend — wire channel member add/remove

**Files:**
- Modify: `backend/src/controllers/channel.controller.ts`

**Interfaces:**
- Consumes: `notifyUser` (Task 4), `env.FRONTEND_URL` (`backend/src/config/env.ts`).
- Produces: `channel_member_added` / `channel_member_removed` notifications. No new exports — internal wiring only.

- [ ] **Step 1: Add imports**

In `backend/src/controllers/channel.controller.ts`, replace:

```ts
import { organizationMemberRepository } from '../repositories/organization.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { organizationRepository } from '../repositories/organization.repository.js';
import { getIO } from '../socket/index.js';
```

with:

```ts
import { organizationMemberRepository } from '../repositories/organization.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { organizationRepository } from '../repositories/organization.repository.js';
import { getIO } from '../socket/index.js';
import { notifyUser } from '../utils/notify.js';
import { env } from '../config/env.js';
import type { ChannelInstance } from '../types/channels.types.js';
```

- [ ] **Step 2: Notify on member added**

In `backend/src/controllers/channel.controller.ts`, replace:

```ts
export const inviteChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { userId } = req.body as { userId: string };

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  const org = await organizationRepository.findById(channel.organizationId);
  const targetMembership = await organizationMemberRepository.findOne({
    organizationId: channel.organizationId,
    userId,
  });
  if (!targetMembership && org?.ownerId !== userId) {
    throw new ApiError(400, 'User is not a member of this organization');
  }

  const alreadyMember = await channelMemberRepository.findMember(channelId, userId);
  if (alreadyMember) {
    throw new ApiError(400, 'User is already a member of this channel');
  }

  await channelMemberRepository.addMembers(channelId, [userId]);

  const invitedUser = await userRepository.findById(userId);
  const message = await messageRepository.create({
    channelId,
    senderId: null,
    type: 'SYSTEM',
    content: `${invitedUser?.name ?? 'A member'} joined the channel`,
  });

  const io = getIO();
  io.in(`user:${userId}`).socketsJoin(`channel:${channelId}`);
  io.to(`channel:${channelId}`).emit('member:joined', { channelId, userId });
  io.to(`channel:${channelId}`).emit('message:new', message);

  return res.status(201).json({
    success: true,
    message: 'Member added to channel',
    data: null,
  });
});
```

with:

```ts
export const inviteChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { userId } = req.body as { userId: string };
  const actor = req.user;
  if (!actor) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  const org = await organizationRepository.findById(channel.organizationId);
  const targetMembership = await organizationMemberRepository.findOne({
    organizationId: channel.organizationId,
    userId,
  });
  if (!targetMembership && org?.ownerId !== userId) {
    throw new ApiError(400, 'User is not a member of this organization');
  }

  const alreadyMember = await channelMemberRepository.findMember(channelId, userId);
  if (alreadyMember) {
    throw new ApiError(400, 'User is already a member of this channel');
  }

  await channelMemberRepository.addMembers(channelId, [userId]);

  const invitedUser = await userRepository.findById(userId);
  const message = await messageRepository.create({
    channelId,
    senderId: null,
    type: 'SYSTEM',
    content: `${invitedUser?.name ?? 'A member'} joined the channel`,
  });

  const io = getIO();
  io.in(`user:${userId}`).socketsJoin(`channel:${channelId}`);
  io.to(`channel:${channelId}`).emit('member:joined', { channelId, userId });
  io.to(`channel:${channelId}`).emit('message:new', message);

  await notifyUser({
    userId,
    organizationId: channel.organizationId,
    type: 'channel_member_added',
    title: `${actor.name} added you to #${channel.name}`,
    body: `You were added to the ${channel.name} channel in ${org?.name ?? 'your workspace'}.`,
    entityType: 'channel',
    entityId: channelId,
    email: invitedUser
      ? {
          to: invitedUser.email,
          subject: `${actor.name} added you to #${channel.name}`,
          bodyText: `You were added to the ${channel.name} channel in ${org?.name ?? 'your workspace'}.`,
          link: `${env.FRONTEND_URL.replace(/\/$/, '')}/org/${org?.slug}/chat?channelId=${channelId}`,
        }
      : undefined,
  });

  return res.status(201).json({
    success: true,
    message: 'Member added to channel',
    data: null,
  });
});
```

- [ ] **Step 3: Notify on member removed (not on voluntary leave)**

In `backend/src/controllers/channel.controller.ts`, replace:

```ts
export async function removeMemberAndNotify(
  channelId: string,
  userId: string,
  actorName: string,
  reason: 'left' | 'removed',
): Promise<void> {
  await channelMemberRepository.removeMember(channelId, userId);

  const message = await messageRepository.create({
    channelId,
    senderId: null,
    type: 'SYSTEM',
    content: reason === 'left' ? `${actorName} left the channel` : `${actorName} was removed from the channel`,
  });

  const io = getIO();
  io.to(`channel:${channelId}`).emit('member:left', { channelId, userId });
  io.to(`channel:${channelId}`).emit('message:new', message);
  io.in(`user:${userId}`).socketsLeave(`channel:${channelId}`);
}
```

with:

```ts
export async function removeMemberAndNotify(
  channel: ChannelInstance,
  userId: string,
  actorName: string,
  reason: 'left' | 'removed',
): Promise<void> {
  const channelId = channel.id;
  await channelMemberRepository.removeMember(channelId, userId);

  const message = await messageRepository.create({
    channelId,
    senderId: null,
    type: 'SYSTEM',
    content: reason === 'left' ? `${actorName} left the channel` : `${actorName} was removed from the channel`,
  });

  const io = getIO();
  io.to(`channel:${channelId}`).emit('member:left', { channelId, userId });
  io.to(`channel:${channelId}`).emit('message:new', message);
  io.in(`user:${userId}`).socketsLeave(`channel:${channelId}`);

  // Only notify when someone else removed this user — a voluntary "left" needs no self-notification.
  if (reason === 'removed') {
    const [org, targetUser] = await Promise.all([
      organizationRepository.findById(channel.organizationId),
      userRepository.findById(userId),
    ]);

    await notifyUser({
      userId,
      organizationId: channel.organizationId,
      type: 'channel_member_removed',
      title: `You were removed from #${channel.name}`,
      body: `${actorName} removed you from the ${channel.name} channel in ${org?.name ?? 'your workspace'}.`,
      entityType: 'channel',
      entityId: channelId,
      email: targetUser
        ? {
            to: targetUser.email,
            subject: `You were removed from #${channel.name}`,
            bodyText: `${actorName} removed you from the ${channel.name} channel in ${org?.name ?? 'your workspace'}.`,
            link: `${env.FRONTEND_URL.replace(/\/$/, '')}/org/${org?.slug}/chat`,
          }
        : undefined,
    });
  }
}
```

- [ ] **Step 4: Update the two call sites**

In `backend/src/controllers/channel.controller.ts`, replace:

```ts
  await removeMemberAndNotify(channelId, user.id, user.name, 'left');
  return ok(res, null, 'You have left the channel');
```

with:

```ts
  await removeMemberAndNotify(channel, user.id, user.name, 'left');
  return ok(res, null, 'You have left the channel');
```

Then replace:

```ts
  const targetUser = await userRepository.findById(userId);
  await removeMemberAndNotify(channelId, userId, targetUser?.name ?? 'A member', 'removed');
  return ok(res, null, 'Member removed successfully');
```

with:

```ts
  const targetUser = await userRepository.findById(userId);
  await removeMemberAndNotify(channel, userId, targetUser?.name ?? 'A member', 'removed');
  return ok(res, null, 'Member removed successfully');
```

- [ ] **Step 5: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify with curl**

Start the dev server, log in as two dev accounts in the same org (`USER_A` = channel admin, `USER_B_ID` = target), cookies at `/tmp/cookies_a.txt`:

```bash
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/members \
  -H "Content-Type: application/json" -d '{"userId":"USER_B_ID"}'
```

Expected: `201`. Then as `USER_B`:

```bash
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/notifications
```

Expected: `200` with one notification, `"type":"channel_member_added"`, `"entityType":"channel"`, `"entityId":"CHANNEL_ID"`, `"organizationId"` set.

```bash
curl -b /tmp/cookies_a.txt -s -X DELETE http://localhost:8080/api/v1/channels/CHANNEL_ID/members/USER_B_ID
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/notifications
```

Expected: a second notification, `"type":"channel_member_removed"`.

- [ ] **Step 7: Commit**

```bash
cd backend
git add src/controllers/channel.controller.ts
git commit -m "feat(notifications): notify on channel member add/remove"
```

---

## Task 6: Backend — wire project member add/remove

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

**Interfaces:**
- Consumes: `notifyUser` (Task 4), `env.FRONTEND_URL`.
- Produces: `project_member_added` / `project_member_removed` notifications.

- [ ] **Step 1: Add imports**

In `backend/src/controllers/project.controller.ts`, replace:

```ts
import { projectRepository } from '../repositories/project.repository.js';
import { kanbanColumnRepository } from '../repositories/kanbanColumn.repository.js';
import {
  organizationMemberRepository,
  organizationRepository,
} from '../repositories/organization.repository.js';
```

with:

```ts
import { projectRepository } from '../repositories/project.repository.js';
import { kanbanColumnRepository } from '../repositories/kanbanColumn.repository.js';
import {
  organizationMemberRepository,
  organizationRepository,
} from '../repositories/organization.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { notifyUser } from '../utils/notify.js';
import { env } from '../config/env.js';
```

- [ ] **Step 2: Notify on member added**

In `backend/src/controllers/project.controller.ts`, replace:

```ts
    const { isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);

    if (!isOrgPrivileged && !isProjectManager) {
      throw new ApiError(403, 'Only organization admins or project managers can add members');
    }

    const targetOrgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId,
    });

    if (!targetOrgMembership) {
      throw new ApiError(400, 'User must belong to the organization before joining a project');
    }

    const existing = await projectRepository.findMembership(projectId, userId);
    if (existing) throw new ApiError(400, 'User is already a member of this project');

    const member = await projectRepository.addMember(projectId, userId, 'MEMBER');
    return res.status(201).json({
      success: true,
      message: 'Member added to project successfully',
      data: member,
    });
```

with:

```ts
    const { org, isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);

    if (!isOrgPrivileged && !isProjectManager) {
      throw new ApiError(403, 'Only organization admins or project managers can add members');
    }

    const targetOrgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId,
    });

    if (!targetOrgMembership) {
      throw new ApiError(400, 'User must belong to the organization before joining a project');
    }

    const existing = await projectRepository.findMembership(projectId, userId);
    if (existing) throw new ApiError(400, 'User is already a member of this project');

    const member = await projectRepository.addMember(projectId, userId, 'MEMBER');

    const targetUser = await userRepository.findById(userId);
    await notifyUser({
      userId,
      organizationId: project.organizationId,
      type: 'project_member_added',
      title: `${user.name} added you to ${project.name}`,
      body: `You were added to the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
      entityType: 'project',
      entityId: project.id,
      email: targetUser
        ? {
            to: targetUser.email,
            subject: `${user.name} added you to ${project.name}`,
            bodyText: `You were added to the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
            link: `${env.FRONTEND_URL.replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}`,
          }
        : undefined,
    });

    return res.status(201).json({
      success: true,
      message: 'Member added to project successfully',
      data: member,
    });
```

- [ ] **Step 3: Notify on member removed (not on self-removal)**

In `backend/src/controllers/project.controller.ts`, replace:

```ts
    const { isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);
    const isSelf = user.id === userId;

    if (!isOrgPrivileged && !isProjectManager && !isSelf) {
      throw new ApiError(403, 'You do not have permission to remove this member');
    }

    const removedCount = await projectRepository.removeMember(projectId, userId);
    if (removedCount === 0) throw new ApiError(404, 'Member not found in this project');

    return ok(res, null, 'Member removed from project successfully');
```

with:

```ts
    const { org, isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);
    const isSelf = user.id === userId;

    if (!isOrgPrivileged && !isProjectManager && !isSelf) {
      throw new ApiError(403, 'You do not have permission to remove this member');
    }

    const removedCount = await projectRepository.removeMember(projectId, userId);
    if (removedCount === 0) throw new ApiError(404, 'Member not found in this project');

    // Only notify when someone else removed this user — self-removal needs no self-notification.
    if (!isSelf) {
      const targetUser = await userRepository.findById(userId);
      await notifyUser({
        userId,
        organizationId: project.organizationId,
        type: 'project_member_removed',
        title: `You were removed from ${project.name}`,
        body: `${user.name} removed you from the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
        entityType: 'project',
        entityId: project.id,
        email: targetUser
          ? {
              to: targetUser.email,
              subject: `You were removed from ${project.name}`,
              bodyText: `${user.name} removed you from the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
              link: `${env.FRONTEND_URL.replace(/\/$/, '')}/org/${org?.slug}/projects`,
            }
          : undefined,
      });
    }

    return ok(res, null, 'Member removed from project successfully');
```

- [ ] **Step 4: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify with curl**

As an org admin (`USER_A`), add `USER_B_ID` to `PROJECT_ID`:

```bash
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/projects/PROJECT_ID/members \
  -H "Content-Type: application/json" -d '{"userId":"USER_B_ID"}'
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/notifications
```

Expected: a `"type":"project_member_added"` notification with `"entityType":"project"`, `"entityId":"PROJECT_ID"`.

```bash
curl -b /tmp/cookies_a.txt -s -X DELETE http://localhost:8080/api/v1/projects/PROJECT_ID/members/USER_B_ID
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/notifications
```

Expected: a second notification, `"type":"project_member_removed"`.

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/controllers/project.controller.ts
git commit -m "feat(notifications): notify on project member add/remove"
```

---

## Task 7: Backend — wire task assignment + task comments

**Files:**
- Modify: `backend/src/controllers/task.controller.ts`

**Interfaces:**
- Consumes: `notifyUser` (Task 4), `env.FRONTEND_URL`, `organizationRepository` (`backend/src/repositories/organization.repository.js`, not yet imported in this file).
- Produces: `task_assigned` / `task_comment_added` notifications.

- [ ] **Step 1: Add imports**

In `backend/src/controllers/task.controller.ts`, replace:

```ts
import { organizationMemberRepository } from '../repositories/organization.repository.js';
import { activityLogRepository } from '../repositories/activityLog.repository.js';
```

with:

```ts
import { organizationMemberRepository, organizationRepository } from '../repositories/organization.repository.js';
import { activityLogRepository } from '../repositories/activityLog.repository.js';
import { notifyUser } from '../utils/notify.js';
import { env } from '../config/env.js';
```

- [ ] **Step 2: Notify on assignment during `createTask`**

In `backend/src/controllers/task.controller.ts`, replace:

```ts
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const columns = await kanbanColumnRepository.findByProject(projectId);
    const colExists = columns.some((c) => c.id === columnId);
    if (!colExists) throw new ApiError(400, 'Column does not belong to this project');

    const position = await taskRepository.countByColumn(columnId);

    const task = await taskRepository.create({
      projectId,
      columnId,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority ?? 'MEDIUM',
      dueDate: dueDate || null,
      createdById: user.id,
      position,
    });

    if (assigneeIds && assigneeIds.length > 0) {
      await taskRepository.syncAssignees(task.id, assigneeIds);
    }

    const created = await taskRepository.findById(task.id);

    activityLogRepository.log({
```

with:

```ts
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await requireProjectMembership(projectId, user.id);

    const columns = await kanbanColumnRepository.findByProject(projectId);
    const colExists = columns.some((c) => c.id === columnId);
    if (!colExists) throw new ApiError(400, 'Column does not belong to this project');

    const position = await taskRepository.countByColumn(columnId);

    const task = await taskRepository.create({
      projectId,
      columnId,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority ?? 'MEDIUM',
      dueDate: dueDate || null,
      createdById: user.id,
      position,
    });

    if (assigneeIds && assigneeIds.length > 0) {
      await taskRepository.syncAssignees(task.id, assigneeIds);
    }

    const created = await taskRepository.findById(task.id);

    if (created?.assignees && created.assignees.length > 0) {
      const org = await organizationRepository.findById(project.organizationId);
      await Promise.all(
        created.assignees
          .filter((assignee) => assignee.id !== user.id)
          .map((assignee) =>
            notifyUser({
              userId: assignee.id,
              organizationId: project.organizationId,
              projectId: project.id,
              type: 'task_assigned',
              title: `${user.name} assigned you to "${created.title}"`,
              body: `You were assigned to a task in ${project.name}.`,
              entityType: 'task',
              entityId: created.id,
              email: {
                to: assignee.email,
                subject: `${user.name} assigned you to "${created.title}"`,
                bodyText: `You were assigned to a task in ${project.name}.`,
                link: `${env.FRONTEND_URL.replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}?taskId=${created.id}`,
              },
            })
          )
      );
    }

    activityLogRepository.log({
```

- [ ] **Step 3: Notify on newly-added assignees during `updateTask`**

In `backend/src/controllers/task.controller.ts`, replace:

```ts
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId)
      throw new ApiError(404, 'Task not found');

    await taskRepository.update(taskId, {
      title: title !== undefined ? title.trim() : task.title,
      description: description !== undefined ? description : task.description,
      priority: priority !== undefined ? priority : task.priority,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
    });

    if (assigneeIds !== undefined) {
      await taskRepository.syncAssignees(taskId, assigneeIds);
    }

    const updated = await taskRepository.findById(taskId);
    return ok(res, updated, 'Task updated successfully');
```

with:

```ts
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await requireProjectMembership(projectId, user.id);

    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId)
      throw new ApiError(404, 'Task not found');

    const previousAssigneeIds = new Set((task.assignees ?? []).map((a) => a.id));

    await taskRepository.update(taskId, {
      title: title !== undefined ? title.trim() : task.title,
      description: description !== undefined ? description : task.description,
      priority: priority !== undefined ? priority : task.priority,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
    });

    if (assigneeIds !== undefined) {
      await taskRepository.syncAssignees(taskId, assigneeIds);
    }

    const updated = await taskRepository.findById(taskId);

    if (assigneeIds !== undefined && updated?.assignees) {
      const newlyAssigned = updated.assignees.filter(
        (assignee) => !previousAssigneeIds.has(assignee.id) && assignee.id !== user.id
      );
      if (newlyAssigned.length > 0) {
        const org = await organizationRepository.findById(project.organizationId);
        await Promise.all(
          newlyAssigned.map((assignee) =>
            notifyUser({
              userId: assignee.id,
              organizationId: project.organizationId,
              projectId: project.id,
              type: 'task_assigned',
              title: `${user.name} assigned you to "${updated.title}"`,
              body: `You were assigned to a task in ${project.name}.`,
              entityType: 'task',
              entityId: taskId,
              email: {
                to: assignee.email,
                subject: `${user.name} assigned you to "${updated.title}"`,
                bodyText: `You were assigned to a task in ${project.name}.`,
                link: `${env.FRONTEND_URL.replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}?taskId=${taskId}`,
              },
            })
          )
        );
      }
    }

    return ok(res, updated, 'Task updated successfully');
```

- [ ] **Step 4: Notify assignees on new comments**

In `backend/src/controllers/task.controller.ts`, replace:

```ts
// POST /projects/:projectId/tasks/:taskId/comments
export const createComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId } = req.params as { projectId: string; taskId: string };
  const { content } = req.body as { content: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const task = await taskRepository.findById(taskId);
  if (!task || task.projectId !== projectId) throw new ApiError(404, 'Task not found');

  const comment = await taskCommentRepository.create({ taskId, authorId: user.id, content: content.trim() });

  activityLogRepository.log({
    projectId,
    actorId: user.id,
    type: 'comment_added',
    entityType: 'task',
    entityId: taskId,
    metadata: { taskTitle: task.title, taskId, commentId: comment.id, content: content.trim() },
  }).catch(() => {});

  return res.status(201).json({ success: true, message: 'Comment added', data: comment });
});
```

with:

```ts
// POST /projects/:projectId/tasks/:taskId/comments
export const createComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId } = req.params as { projectId: string; taskId: string };
  const { content } = req.body as { content: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const project = await requireProjectMembership(projectId, user.id);

  const task = await taskRepository.findById(taskId);
  if (!task || task.projectId !== projectId) throw new ApiError(404, 'Task not found');

  const comment = await taskCommentRepository.create({ taskId, authorId: user.id, content: content.trim() });

  const otherAssignees = (task.assignees ?? []).filter((assignee) => assignee.id !== user.id);
  if (otherAssignees.length > 0) {
    const org = await organizationRepository.findById(project.organizationId);
    const trimmedContent = content.trim();
    await Promise.all(
      otherAssignees.map((assignee) =>
        notifyUser({
          userId: assignee.id,
          organizationId: project.organizationId,
          projectId: project.id,
          type: 'task_comment_added',
          title: `${user.name} commented on "${task.title}"`,
          body: trimmedContent.slice(0, 200),
          entityType: 'task',
          entityId: taskId,
          email: {
            to: assignee.email,
            subject: `${user.name} commented on "${task.title}"`,
            bodyText: trimmedContent.slice(0, 200),
            link: `${env.FRONTEND_URL.replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}?taskId=${taskId}`,
          },
        })
      )
    );
  }

  activityLogRepository.log({
    projectId,
    actorId: user.id,
    type: 'comment_added',
    entityType: 'task',
    entityId: taskId,
    metadata: { taskTitle: task.title, taskId, commentId: comment.id, content: content.trim() },
  }).catch(() => {});

  return res.status(201).json({ success: true, message: 'Comment added', data: comment });
});
```

- [ ] **Step 5: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify with curl**

As a project member (`USER_A`), create a task assigned to `USER_B_ID`:

```bash
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/projects/PROJECT_ID/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Notif test task","columnId":"COLUMN_ID","assigneeIds":["USER_B_ID"]}'
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/notifications
```

Expected: a `"type":"task_assigned"` notification, `"entityType":"task"`, `"projectId":"PROJECT_ID"` set.

```bash
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/projects/PROJECT_ID/tasks/TASK_ID/comments \
  -H "Content-Type: application/json" -d '{"content":"Looks good"}'
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/notifications
```

Expected: a `"type":"task_comment_added"` notification for `USER_B` (not for `USER_A`, the commenter).

- [ ] **Step 7: Commit**

```bash
cd backend
git add src/controllers/task.controller.ts
git commit -m "feat(notifications): notify on task assignment and comments"
```

---

## Task 8: Frontend — types, service, hooks

**Files:**
- Create: `frontend/src/types/notification.types.ts`
- Create: `frontend/src/services/notification.service.ts`
- Create: `frontend/src/hooks/useNotification.ts`

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/axios.ts`), backend response shapes from Task 3.
- Produces: `Notification` type; `getNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`; `useNotifications(page)`, `useUnreadCount()`, `useMarkNotificationRead()`, `useMarkAllNotificationsRead()`. Consumed by Task 9 (socket hook) and Task 10/11 (UI).

- [ ] **Step 1: Write the types**

Create `frontend/src/types/notification.types.ts`:

```ts
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
```

- [ ] **Step 2: Write the service**

Create `frontend/src/services/notification.service.ts`:

```ts
import { api } from '@/lib/axios';
import type { Notification, NotificationsResponse, UnreadCountResponse, PaginationMeta } from '@/types/notification.types';

export async function getNotifications(page = 1): Promise<{ notifications: Notification[]; meta: PaginationMeta }> {
  const res = await api.get<NotificationsResponse>('/notifications', { params: { page } });
  return res.data.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<UnreadCountResponse>('/notifications/unread-count');
  return res.data.data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/mark-all-read');
}
```

- [ ] **Step 3: Write the hooks**

Create `frontend/src/hooks/useNotification.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/notification.service';

export const useNotifications = (page = 1) =>
  useQuery({
    queryKey: ['notifications', { page }],
    queryFn: () => getNotifications(page),
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
```

- [ ] **Step 4: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/types/notification.types.ts src/services/notification.service.ts src/hooks/useNotification.ts
git commit -m "feat(notifications): add frontend types/service/hooks"
```

---

## Task 9: Frontend — real-time socket hook

**Files:**
- Create: `frontend/src/hooks/useNotificationSocket.ts`
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `getSocket`/`connectSocket`/`disconnectSocket` (`frontend/src/lib/socket.ts`), `Notification` type (Task 8), `sonner`'s `toast`.
- Produces: `useNotificationSocket(): void`, mounted unconditionally in `DashboardLayout` (independent of org selection, unlike `useChatSocket` which only connects once an org is active). Consumed by Task 10 (bell badge relies on the cache it updates).

- [ ] **Step 1: Write the hook**

Create `frontend/src/hooks/useNotificationSocket.ts`:

```ts
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { Notification } from '@/types/notification.types';

export function useNotificationSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = connectSocket();

    const onNotificationNew = (notification: Notification) => {
      qc.setQueryData<number>(['notifications', 'unread-count'], (old) => (old ?? 0) + 1);
      qc.invalidateQueries({ queryKey: ['notifications'], exact: false });
      toast.info(notification.title);
    };

    socket.on('notification:new', onNotificationNew);

    return () => {
      socket.off('notification:new', onNotificationNew);
    };
  }, [qc]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);
}
```

- [ ] **Step 2: Mount it in `DashboardLayout`**

In `frontend/src/components/layout/DashboardLayout.tsx`, replace:

```ts
import { useChatSocket } from '@/hooks/useChatSocket';
```

with:

```ts
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
```

Then replace:

```ts
  const { connected: chatConnected } = useChatSocket(activeOrg?.id);
```

with:

```ts
  const { connected: chatConnected } = useChatSocket(activeOrg?.id);
  useNotificationSocket();
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/hooks/useNotificationSocket.ts src/components/layout/DashboardLayout.tsx
git commit -m "feat(notifications): add real-time notification socket hook"
```

---

## Task 10: Frontend — Badge, DropdownMenu primitives, and the notification bell

**Files:**
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/ui/dropdown-menu.tsx`
- Create: `frontend/src/components/shared/NotificationRow.tsx`
- Create: `frontend/src/components/shared/NotificationBell.tsx`
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`

**Interfaces:**
- Consumes: `useUnreadCount`, `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead` (Task 8), `useMyOrganizations` (`frontend/src/hooks/useOrganization.ts`), `Notification` type (Task 8), `@radix-ui/react-dropdown-menu` (already an installed dependency, unused until now), `cn` (`frontend/src/lib/utils`).
- Produces: `Badge` component; `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent` primitives; `NotificationRow` (shared row renderer, reused by Task 11's full page); `NotificationBell` (mounted in the topbar). `resolveNotificationLink` (exported from `NotificationBell.tsx`) is reused by Task 11.

- [ ] **Step 1: Write the `Badge` primitive**

Create `frontend/src/components/ui/badge.tsx`:

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'danger';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
        variant === 'danger' ? 'bg-danger text-white' : 'bg-primary text-primary-foreground',
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Write the `DropdownMenu` primitive**

Create `frontend/src/components/ui/dropdown-menu.tsx`:

```tsx
'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        'z-50 min-w-[280px] overflow-hidden rounded-lg border border-border bg-white p-1 shadow-dropdown',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent };
```

- [ ] **Step 3: Write the shared `NotificationRow`**

Create `frontend/src/components/shared/NotificationRow.tsx`:

```tsx
'use client';

import { cn } from '@/lib/utils';
import type { Notification } from '@/types/notification.types';

interface NotificationRowProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationRow({ notification, onClick }: NotificationRowProps) {
  return (
    <button
      onClick={() => onClick(notification)}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted',
        !notification.isRead && 'bg-surface'
      )}
    >
      <div className="flex items-center gap-2">
        {!notification.isRead && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />}
        <span className={cn('truncate', !notification.isRead ? 'font-medium text-text-primary' : 'text-text-secondary')}>
          {notification.title}
        </span>
      </div>
      <span className="pl-3.5 text-xs text-text-muted">{timeAgo(notification.createdAt)}</span>
    </button>
  );
}
```

- [ ] **Step 4: Add `channelId` deep-linking to `ChatPage`**

`KanbanPage.tsx` already supports a `?taskId=` deep link, and `ChatPage.tsx` already supports `?dmUserId=`, but nothing resolves a plain `?channelId=` yet — needed so a channel-type notification click can open that channel. In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`, replace:

```ts
    startDM.mutate(dmUserId, {
      onSuccess: (channel) => setSelectedChannel(channel),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
      onSettled: () => router.replace(`/org/${slug}/chat`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, dms, org]);
```

with:

```ts
    startDM.mutate(dmUserId, {
      onSuccess: (channel) => setSelectedChannel(channel),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
      onSettled: () => router.replace(`/org/${slug}/chat`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, dms, org]);

  useEffect(() => {
    const channelId = searchParams.get('channelId');
    if (!channelId || !channels) return;

    const target = channels.find((c) => c.id === channelId);
    if (target) setSelectedChannel(target);
    router.replace(`/org/${slug}/chat`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, channels]);
```

- [ ] **Step 5: Write `NotificationBell`**

Create `frontend/src/components/shared/NotificationBell.tsx`:

```tsx
'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { NotificationRow } from '@/components/shared/NotificationRow';
import { useUnreadCount, useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotification';
import { useMyOrganizations } from '@/hooks/useOrganization';
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
    default:
      return null;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { data: unreadCount } = useUnreadCount();
  const { data: recent } = useNotifications(1);
  const { data: orgs } = useMyOrganizations();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleRowClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = resolveNotificationLink(notification, orgs);
    if (link) router.push(link);
  };

  const items = recent?.notifications.slice(0, 10) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded p-1.5 text-primary hover:bg-surface-muted transition-colors">
          <Bell size={18} />
          {!!unreadCount && (
            <Badge variant="danger" className="absolute -right-0.5 -top-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold text-text-primary">Notifications</span>
          {!!unreadCount && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs font-medium text-brand hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-text-muted">No notifications yet</p>
          ) : (
            items.map((n) => <NotificationRow key={n.id} notification={n} onClick={handleRowClick} />)
          )}
        </div>
        <div className="border-t border-border-subtle p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => router.push('/notifications')}
          >
            View all
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 6: Mount the bell in the topbar**

In `frontend/src/components/layout/DashboardLayout.tsx`, replace:

```ts
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
```

with:

```ts
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { NotificationBell } from '@/components/shared/NotificationBell';
```

Then replace:

```tsx
            {currentOrg && !chatConnected && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Reconnecting…
                </span>
              )}
            </div>
          </div>
        </header>
```

with:

```tsx
            {currentOrg && !chatConnected && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Reconnecting…
                </span>
              )}
            </div>
          </div>
          <NotificationBell />
        </header>
```

- [ ] **Step 7: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd frontend
git add src/components/ui/badge.tsx src/components/ui/dropdown-menu.tsx \
  src/components/shared/NotificationRow.tsx src/components/shared/NotificationBell.tsx \
  src/components/layout/DashboardLayout.tsx \
  "src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx"
git commit -m "feat(notifications): add bell/dropdown UI in the topbar"
```

---

## Task 11: Frontend — full notifications page + end-to-end verification

**Files:**
- Create: `frontend/src/components/shared/skeletons/NotificationsSkeleton.tsx`
- Create: `frontend/src/app/(dashboard)/notifications/page.tsx`
- Create: `frontend/src/app/(dashboard)/notifications/loading.tsx`
- Create: `frontend/src/app/(dashboard)/notifications/error.tsx`

**Interfaces:**
- Consumes: `useNotifications` (Task 8), `NotificationRow` + `resolveNotificationLink` (Task 10), `Skeleton` (`frontend/src/components/ui/skeleton.tsx`), `ErrorState` (`frontend/src/components/shared/ErrorState.tsx`).
- Produces: `/notifications` route. Terminal task — no later task consumes this.

- [ ] **Step 1: Write the skeleton**

Create `frontend/src/components/shared/skeletons/NotificationsSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function NotificationsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-2 rounded-xl border border-border-subtle bg-white p-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md px-3 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

Create `frontend/src/app/(dashboard)/notifications/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { NotificationRow } from '@/components/shared/NotificationRow';
import { resolveNotificationLink } from '@/components/shared/NotificationBell';
import { NotificationsSkeleton } from '@/components/shared/skeletons/NotificationsSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotification';
import { useMyOrganizations } from '@/hooks/useOrganization';
import type { Notification } from '@/types/notification.types';

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useNotifications(page);
  const { data: orgs } = useMyOrganizations();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  if (isLoading) return <NotificationsSkeleton />;
  if (error || !data) {
    return <ErrorState title="Failed to load notifications" onRetry={() => refetch()} />;
  }

  const handleRowClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = resolveNotificationLink(notification, orgs);
    if (link) router.push(link);
  };

  const { notifications, meta } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Notifications</h1>
        <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
          Mark all as read
        </Button>
      </div>

      <div className="rounded-xl border border-border-subtle bg-white p-2">
        {notifications.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-text-muted">No notifications yet</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onClick={handleRowClick} />
            ))}
          </div>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-text-muted">
            Page {meta.currentPage} of {meta.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `loading.tsx`**

Create `frontend/src/app/(dashboard)/notifications/loading.tsx`:

```tsx
import { NotificationsSkeleton } from '@/components/shared/skeletons/NotificationsSkeleton';

export default function NotificationsLoading() {
  return <NotificationsSkeleton />;
}
```

- [ ] **Step 4: Write `error.tsx`**

Create `frontend/src/app/(dashboard)/notifications/error.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[NotificationsError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle className="text-danger" size={22} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-text-primary">Failed to load notifications</h2>
        <p className="mt-1 max-w-xs text-sm text-text-secondary">
          {error.message || 'Could not load notifications. Check your connection and try again.'}
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify in the browser**

Start both dev servers (`cd backend && npm run dev`, `cd frontend && npm run dev`). Log in as two accounts in the same org, in two separate browser sessions (e.g. one normal window, one incognito):

1. As `USER_A`, add `USER_B` to a channel, a project, and assign `USER_B` a task, then comment on that task.
2. As `USER_B` (already logged in, sitting on any page): confirm a toast pops up live for each action without refreshing, and the bell badge count increments live.
3. Click the bell as `USER_B`: confirm the dropdown lists all four notifications, newest first, unread ones visually distinct.
4. Click the "channel added" row: confirm it navigates to `/org/<slug>/chat` with that channel selected, and the row is now read (no more blue dot, badge count decremented).
5. Click "Mark all as read" from the dropdown: confirm the badge clears to zero.
6. Click "View all": confirm `/notifications` loads the full paginated list.
7. Click a "task assigned" row from the full page: confirm it navigates to the project board with that task's detail panel already open (via `?taskId=`).
8. Check the inbox for `USER_B`'s email address (or the Resend dashboard/logs if using a test mode): confirm four separate notification emails arrived, each with a working "View in app" link.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/components/shared/skeletons/NotificationsSkeleton.tsx "src/app/(dashboard)/notifications"
git commit -m "feat(notifications): add full notifications page"
```
