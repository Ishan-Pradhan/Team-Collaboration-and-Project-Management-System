# Chat Unread Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live per-channel/DM unread tracking — a sidebar dot + "who messaged" preview in chat, a matching entry in the existing notification bell/list, both driven by the same upserted `Notification` row so they can never drift out of sync.

**Architecture:** Reuses the `Notification` model (no schema change) with a new `message_received` type and upsert-instead-of-insert semantics: one row per `(user, channel)` that updates in place as new messages arrive. `sendMessage`/`uploadFile` call a new `notifyNewMessage()` helper (a sibling to the existing `notifyUser()`, with no email option at all). A new Zustand store tracks which channel is currently open so the frontend can suppress unread state for a channel you're already looking at.

**Tech Stack:** Same as the shipped notifications feature — Express 5, Sequelize 6, Socket.io, Next.js 16, TanStack Query, Zustand.

## Global Constraints

- Follow RMVCS: controllers hold business logic, repositories hold all Sequelize access.
- Always use the `env` export, never `process.env` directly.
- No test runner exists in this repo. Verification is manual: `curl` for the backend, browser interaction for the frontend.
- No commit message in this plan includes a `Co-Authored-By` trailer.
- `message_received` notifications never send email — the helper that creates them has no `email` parameter at all, not merely an unset one.

---

## Task 1: Backend — repository upsert/read methods + `notifyNewMessage` helper

**Files:**
- Modify: `backend/src/repositories/notification.repository.ts`
- Modify: `backend/src/utils/notify.ts`

**Interfaces:**
- Consumes: `Notification` model, `serializeNotification`, `getIO` (all already in place from the shipped notifications feature).
- Produces: `notificationRepository.upsertMessageNotification(params)`, `notificationRepository.markReadByEntity(userId, entityType, entityId)`, `notificationRepository.findUnreadChannels(userId)`; `notifyNewMessage(params): Promise<void>`. Consumed by Task 2 (endpoints) and Task 3 (message wiring).

- [ ] **Step 1: Add the repository methods**

In `backend/src/repositories/notification.repository.ts`, replace:

```ts
  markAllRead: async (userId: string): Promise<void> => {
    await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  },
};
```

with:

```ts
  markAllRead: async (userId: string): Promise<void> => {
    await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  },

  // Collapses a burst of messages in the same channel into one updating row
  // instead of one row per message.
  upsertMessageNotification: async (params: {
    userId: string;
    organizationId: string;
    channelId: string;
    title: string;
    body: string;
  }): Promise<NotificationInstance> => {
    const existing = await Notification.findOne({
      where: {
        userId: params.userId,
        entityType: 'channel',
        entityId: params.channelId,
        type: 'message_received',
        isRead: false,
      },
    });

    if (existing) {
      return await existing.update({ title: params.title, body: params.body, createdAt: new Date() });
    }

    return await Notification.create({
      userId: params.userId,
      organizationId: params.organizationId,
      type: 'message_received',
      title: params.title,
      body: params.body,
      entityType: 'channel',
      entityId: params.channelId,
    });
  },

  markReadByEntity: async (userId: string, entityType: string, entityId: string): Promise<void> => {
    await Notification.update({ isRead: true }, { where: { userId, entityType, entityId, isRead: false } });
  },

  findUnreadChannels: async (userId: string): Promise<NotificationInstance[]> => {
    return await Notification.findAll({
      where: { userId, entityType: 'channel', type: 'message_received', isRead: false },
      order: [['createdAt', 'DESC']],
    });
  },
};
```

- [ ] **Step 2: Add the `notifyNewMessage` helper**

In `backend/src/utils/notify.ts`, replace:

```ts
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

with:

```ts
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
  try {
    const notification = await notificationRepository.upsertMessageNotification(params);
    getIO().to(`user:${params.userId}`).emit('notification:new', serializeNotification(notification));
  } catch (err) {
    console.error('[notifyNewMessage] failed to upsert/push message notification:', err);
  }
}
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/repositories/notification.repository.ts src/utils/notify.ts
git commit -m "feat(chat): add message-notification upsert repository methods and helper"
```

---

## Task 2: Backend — `/notifications/unread-channels` and `/notifications/read-by-entity` endpoints

**Files:**
- Modify: `backend/src/controllers/notification.controller.ts`
- Modify: `backend/src/validations/notification.validation.ts`
- Modify: `backend/src/routes/notification.routes.ts`

**Interfaces:**
- Consumes: `notificationRepository.findUnreadChannels`/`markReadByEntity` (Task 1).
- Produces: `GET /api/v1/notifications/unread-channels` → `{ channelId, title, body, createdAt }[]`; `POST /api/v1/notifications/read-by-entity` body `{ entityType, entityId }`. Consumed by Task 4 (frontend service).

- [ ] **Step 1: Add the validation schema**

In `backend/src/validations/notification.validation.ts`, replace:

```ts
import { z } from 'zod';

export const notificationParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
};
```

with:

```ts
import { z } from 'zod';

export const notificationParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
};

export const readByEntitySchema = {
  body: z.object({
    entityType: z.string().min(1, 'entityType is required'),
    entityId: z.string().uuid('Invalid entity ID'),
  }),
};
```

- [ ] **Step 2: Add the controllers**

In `backend/src/controllers/notification.controller.ts`, replace:

```ts
export const markAllNotificationsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await notificationRepository.markAllRead(user.id);
  return ok(res, null, 'All notifications marked as read');
});
```

with:

```ts
export const markAllNotificationsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await notificationRepository.markAllRead(user.id);
  return ok(res, null, 'All notifications marked as read');
});

export const getUnreadChannels = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const notifications = await notificationRepository.findUnreadChannels(user.id);
  return ok(
    res,
    notifications.map((n) => ({
      channelId: n.entityId,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
    })),
    'Unread channels retrieved successfully'
  );
});

export const markReadByEntity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');
  const { entityType, entityId } = req.body as { entityType: string; entityId: string };

  await notificationRepository.markReadByEntity(user.id, entityType, entityId);
  return ok(res, null, 'Marked as read');
});
```

- [ ] **Step 3: Add the routes**

In `backend/src/routes/notification.routes.ts`, replace:

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

with:

```ts
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadChannels,
  markReadByEntity,
} from '../controllers/notification.controller.js';
import { notificationParamSchema, readByEntitySchema } from '../validations/notification.validation.js';

const router = Router();

router.route('/notifications').get(verifyJWT, listNotifications);
router.route('/notifications/unread-count').get(verifyJWT, getUnreadNotificationCount);
router.route('/notifications/unread-channels').get(verifyJWT, getUnreadChannels);
router.route('/notifications/mark-all-read').post(verifyJWT, markAllNotificationsRead);
router.route('/notifications/read-by-entity').post(verifyJWT, validate(readByEntitySchema), markReadByEntity);
router.route('/notifications/:id/read').patch(verifyJWT, validate(notificationParamSchema), markNotificationRead);

export default router;
```

Note: `/notifications/unread-channels` and `/notifications/read-by-entity` are registered *before* `/notifications/:id/read` would otherwise be ambiguous — Express matches routes in registration order and these paths don't collide with the `:id` pattern's position (`:id/read` requires exactly two path segments after `/notifications`, while these are single-segment), so order doesn't actually matter here, but keeping the more specific routes grouped together with the other GET/POST routes above the PATCH keeps the file readable.

- [ ] **Step 4: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify with curl**

Start the dev server, log in as a dev account, cookies at `/tmp/cookies.txt`:

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/notifications/unread-channels
```

Expected: `200` with `"data": []` (empty until Task 3 wires up message sending).

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/notifications/read-by-entity \
  -H "Content-Type: application/json" -d '{"entityType":"channel","entityId":"00000000-0000-0000-0000-000000000000"}'
```

Expected: `200` (no-op, since nothing matches — this only proves the endpoint accepts the shape and doesn't error).

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/controllers/notification.controller.ts src/validations/notification.validation.ts src/routes/notification.routes.ts
git commit -m "feat(chat): add unread-channels and read-by-entity endpoints"
```

---

## Task 3: Backend — wire `sendMessage` and `uploadFile`

**Files:**
- Modify: `backend/src/controllers/channel.controller.ts`

**Interfaces:**
- Consumes: `notifyNewMessage` (Task 1), `channelMemberRepository.findMembers` (already imported in this file).
- Produces: `message_received` notifications on every text/file message send. No new exports.

- [ ] **Step 1: Import `notifyNewMessage`**

In `backend/src/controllers/channel.controller.ts`, replace:

```ts
import { notifyUser } from '../utils/notify.js';
```

with:

```ts
import { notifyUser, notifyNewMessage } from '../utils/notify.js';
```

- [ ] **Step 2: Wire `sendMessage`**

Replace:

```ts
export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { content } = req.body as { content: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const created = await messageRepository.create({
    channelId,
    senderId: user.id,
    type: 'TEXT',
    content: content.trim(),
  });
  const message = await messageRepository.findById(created.id);

  getIO().to(`channel:${channelId}`).emit('message:new', message);

  return res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: message,
  });
});
```

with:

```ts
export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { content } = req.body as { content: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const trimmedContent = content.trim();
  const created = await messageRepository.create({
    channelId,
    senderId: user.id,
    type: 'TEXT',
    content: trimmedContent,
  });
  const message = await messageRepository.findById(created.id);

  getIO().to(`channel:${channelId}`).emit('message:new', message);

  const members = await channelMemberRepository.findMembers(channelId);
  const title = channel.type === 'DM'
    ? `${user.name} sent you a message`
    : `${user.name} sent a message in #${channel.name}`;
  await Promise.all(
    members
      .filter((m) => m.userId !== user.id)
      .map((m) =>
        notifyNewMessage({
          userId: m.userId,
          organizationId: channel.organizationId,
          channelId,
          title,
          body: `${user.name}: ${trimmedContent.slice(0, 200)}`,
        })
      )
  );

  return res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: message,
  });
});
```

- [ ] **Step 3: Wire `uploadFile`**

Replace:

```ts
export const uploadFile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const file = req.file;
  if (!file) throw new ApiError(400, 'No file uploaded');

  const uploaded = await uploadToCloudinary(file.buffer, {
    folder: `chat-files/${channelId}`,
    resourceType: 'auto',
  });

  const created = await messageRepository.create({
    channelId,
    senderId: user.id,
    type: 'FILE',
    content: '',
    fileName: file.originalname,
    fileUrl: uploaded.url,
    cloudinaryPublicId: uploaded.publicId,
    fileType: file.mimetype,
    fileSize: file.size,
  });
  const message = await messageRepository.findById(created.id);

  getIO().to(`channel:${channelId}`).emit('message:new', message);

  return res.status(201).json({
    success: true,
    message: 'File shared successfully',
    data: message,
  });
});
```

with:

```ts
export const uploadFile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const file = req.file;
  if (!file) throw new ApiError(400, 'No file uploaded');

  const uploaded = await uploadToCloudinary(file.buffer, {
    folder: `chat-files/${channelId}`,
    resourceType: 'auto',
  });

  const created = await messageRepository.create({
    channelId,
    senderId: user.id,
    type: 'FILE',
    content: '',
    fileName: file.originalname,
    fileUrl: uploaded.url,
    cloudinaryPublicId: uploaded.publicId,
    fileType: file.mimetype,
    fileSize: file.size,
  });
  const message = await messageRepository.findById(created.id);

  getIO().to(`channel:${channelId}`).emit('message:new', message);

  const members = await channelMemberRepository.findMembers(channelId);
  const title = channel.type === 'DM'
    ? `${user.name} sent you a message`
    : `${user.name} sent a message in #${channel.name}`;
  await Promise.all(
    members
      .filter((m) => m.userId !== user.id)
      .map((m) =>
        notifyNewMessage({
          userId: m.userId,
          organizationId: channel.organizationId,
          channelId,
          title,
          body: `${user.name}: Sent a file: ${file.originalname}`,
        })
      )
  );

  return res.status(201).json({
    success: true,
    message: 'File shared successfully',
    data: message,
  });
});
```

- [ ] **Step 4: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify with curl**

Using two dev accounts in the same channel (`USER_A`, `USER_B`, `CHANNEL_ID`), cookies at `/tmp/cookies_a.txt` / `/tmp/cookies_b.txt`:

```bash
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages \
  -H "Content-Type: application/json" -d '{"content":"hey"}' -o /dev/null -w "%{http_code}\n"
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages \
  -H "Content-Type: application/json" -d '{"content":"you there?"}' -o /dev/null -w "%{http_code}\n"
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/notifications/unread-channels
```

Expected: exactly **one** entry for `CHANNEL_ID` (not two — the second message updates the same row in place), with `"body"` reflecting the *second* message ("you there?"), proving the upsert-in-place behavior.

```bash
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/notifications | python3 -c "import json,sys; d=json.load(sys.stdin); print([n['type'] for n in d['data']['notifications'][:1]])"
```

Expected: `['message_received']` as the most recent notification, confirming it also appears in the regular bell list.

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/controllers/channel.controller.ts
git commit -m "feat(chat): notify channel members on new messages"
```

---

## Task 4: Frontend — types, service, hooks

**Files:**
- Modify: `frontend/src/types/notification.types.ts`
- Modify: `frontend/src/services/notification.service.ts`
- Modify: `frontend/src/hooks/useNotification.ts`

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/axios.ts`), backend response shapes from Task 2.
- Produces: `UnreadChannel` type; `getUnreadChannels`, `markReadByEntity`; `useUnreadChannels()`, `useMarkReadByEntity()`. Consumed by Task 5 (socket hook) and Task 6 (ChatPage UI).

- [ ] **Step 1: Add the types**

In `frontend/src/types/notification.types.ts`, replace:

```ts
export interface UnreadCountResponse {
  success: boolean;
  message: string;
  data: { count: number };
}
```

with:

```ts
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
```

- [ ] **Step 2: Add the service functions**

In `frontend/src/services/notification.service.ts`, replace:

```ts
import { api } from '@/lib/axios';
import type { Notification, NotificationsResponse, UnreadCountResponse, PaginationMeta } from '@/types/notification.types';
```

with:

```ts
import { api } from '@/lib/axios';
import type {
  Notification,
  NotificationsResponse,
  UnreadCountResponse,
  PaginationMeta,
  UnreadChannel,
  UnreadChannelsResponse,
} from '@/types/notification.types';
```

Then replace:

```ts
export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/mark-all-read');
}
```

with:

```ts
export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/mark-all-read');
}

export async function getUnreadChannels(): Promise<UnreadChannel[]> {
  const res = await api.get<UnreadChannelsResponse>('/notifications/unread-channels');
  return res.data.data;
}

export async function markReadByEntity(entityType: string, entityId: string): Promise<void> {
  await api.post('/notifications/read-by-entity', { entityType, entityId });
}
```

- [ ] **Step 3: Add the hooks**

In `frontend/src/hooks/useNotification.ts`, replace:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/notification.service';
```

with:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadChannels,
  markReadByEntity,
} from '@/services/notification.service';
import type { UnreadChannel } from '@/types/notification.types';
```

Then replace:

```ts
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

with:

```ts
export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useUnreadChannels = () =>
  useQuery({
    queryKey: ['notifications', 'unread-channels'],
    queryFn: getUnreadChannels,
  });

export const useMarkReadByEntity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: string; entityId: string }) =>
      markReadByEntity(entityType, entityId),
    onSuccess: (_data, variables) => {
      qc.setQueryData<UnreadChannel[]>(['notifications', 'unread-channels'], (old) =>
        old?.filter((c) => c.channelId !== variables.entityId)
      );
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
git commit -m "feat(chat): add frontend types/service/hooks for unread channels"
```

---

## Task 5: Frontend — active-channel store + notification socket updates

**Files:**
- Create: `frontend/src/store/chat.store.ts`
- Modify: `frontend/src/hooks/useNotificationSocket.ts`

**Interfaces:**
- Consumes: `markReadByEntity` (Task 4), `UnreadChannel`/`Notification` types.
- Produces: `useChatStore` — `{ activeChannelId: string | null, setActiveChannelId: (id: string | null) => void }`. Consumed by Task 6 (`ChatPage.tsx` sets it; this task's socket hook reads it).

- [ ] **Step 1: Write the store**

Create `frontend/src/store/chat.store.ts`:

```ts
import { create } from 'zustand';

interface ChatState {
  activeChannelId: string | null;
  setActiveChannelId: (channelId: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeChannelId: null,
  setActiveChannelId: (channelId) => set({ activeChannelId: channelId }),
}));
```

- [ ] **Step 2: Update `useNotificationSocket`**

Replace the entire contents of `frontend/src/hooks/useNotificationSocket.ts`:

```ts
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { markReadByEntity } from '@/services/notification.service';
import { useChatStore } from '@/store/chat.store';
import type { Notification, UnreadChannel } from '@/types/notification.types';

export function useNotificationSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = connectSocket();

    const onNotificationNew = (notification: Notification) => {
      const isMessage = notification.type === 'message_received';
      const activeChannelId = useChatStore.getState().activeChannelId;

      // Never show a channel you're already looking at as unread.
      if (isMessage && notification.entityId === activeChannelId) {
        markReadByEntity('channel', notification.entityId as string).catch(() => {});
        return;
      }

      if (isMessage) {
        const channelId = notification.entityId as string;
        const wasAlreadyUnread = (qc.getQueryData<UnreadChannel[]>(['notifications', 'unread-channels']) ?? []).some(
          (c) => c.channelId === channelId
        );

        qc.setQueryData<UnreadChannel[]>(['notifications', 'unread-channels'], (old) => {
          const next = (old ?? []).filter((c) => c.channelId !== channelId);
          next.unshift({
            channelId,
            title: notification.title,
            body: notification.body,
            createdAt: notification.createdAt,
          });
          return next;
        });

        // Only bump the badge once per newly-unread channel, not once per
        // message — a burst of messages upserts the same underlying row.
        if (!wasAlreadyUnread) {
          qc.setQueryData<number>(['notifications', 'unread-count'], (old) => (old ?? 0) + 1);
        }
        qc.invalidateQueries({ queryKey: ['notifications'], exact: false });
        return;
      }

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

- [ ] **Step 3: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/store/chat.store.ts src/hooks/useNotificationSocket.ts
git commit -m "feat(chat): suppress unread for the active channel and dedupe badge increments"
```

---

## Task 6: Frontend — `ChatPage.tsx` sidebar unread UI

**Files:**
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`

**Interfaces:**
- Consumes: `useUnreadChannels`, `useMarkReadByEntity` (Task 4), `useChatStore` (Task 5).
- Produces: sidebar unread dot + sender preview on both the Channels and Direct Messages lists; mark-read-on-select. Terminal task for this plan — no later task depends on it.

- [ ] **Step 1: Import the new hooks and store**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`, replace:

```ts
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useChannels, useCreateChannel, useDMs, useStartDM } from '@/hooks/useChannel';
import { useAuthStore } from '@/store/auth.store';
```

with:

```ts
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useChannels, useCreateChannel, useDMs, useStartDM } from '@/hooks/useChannel';
import { useUnreadChannels, useMarkReadByEntity } from '@/hooks/useNotification';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
```

- [ ] **Step 2: Fetch unread state and wire the active-channel effects**

Replace:

```ts
  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: dms } = useDMs(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const createChannel = useCreateChannel(org?.id ?? '');
  const startDM = useStartDM(org?.id ?? '');

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    if (
      selectedChannel &&
      channels &&
      dms &&
      !channels.some((c) => c.id === selectedChannel.id) &&
      !dms.some((c) => c.id === selectedChannel.id)
    ) {
      setSelectedChannel(null);
    }
  }, [channels, dms, selectedChannel]);
```

with:

```ts
  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: dms } = useDMs(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const { data: unreadChannels } = useUnreadChannels();
  const createChannel = useCreateChannel(org?.id ?? '');
  const startDM = useStartDM(org?.id ?? '');
  const markReadByEntity = useMarkReadByEntity();

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const unreadMap = new Map((unreadChannels ?? []).map((c) => [c.channelId, c]));

  useEffect(() => {
    if (
      selectedChannel &&
      channels &&
      dms &&
      !channels.some((c) => c.id === selectedChannel.id) &&
      !dms.some((c) => c.id === selectedChannel.id)
    ) {
      setSelectedChannel(null);
    }
  }, [channels, dms, selectedChannel]);

  useEffect(() => {
    useChatStore.getState().setActiveChannelId(selectedChannel?.id ?? null);
    return () => {
      useChatStore.getState().setActiveChannelId(null);
    };
  }, [selectedChannel?.id]);

  useEffect(() => {
    if (!selectedChannel) return;
    if (unreadChannels?.some((c) => c.channelId === selectedChannel.id)) {
      markReadByEntity.mutate({ entityType: 'channel', entityId: selectedChannel.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel?.id, unreadChannels]);
```

- [ ] **Step 3: Show the unread dot and preview on channel rows**

Replace:

```tsx
        <div className="space-y-0.5 p-2">
          {channels && channels.length > 0 ? (
            channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  selectedChannel?.id === channel.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-muted'
                }`}
              >
                {channel.type === 'PUBLIC' ? <Hash size={13} /> : <Lock size={13} />}
                <span className="truncate">{channel.name}</span>
              </button>
            ))
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No channels yet.</p>
          )}
        </div>
```

with:

```tsx
        <div className="space-y-0.5 p-2">
          {channels && channels.length > 0 ? (
            channels.map((channel) => {
              const unread = unreadMap.get(channel.id);
              return (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    selectedChannel?.id === channel.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {channel.type === 'PUBLIC' ? <Hash size={13} className="mt-0.5 shrink-0" /> : <Lock size={13} className="mt-0.5 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{channel.name}</span>
                      {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    </span>
                    {unread && (
                      <span className="block truncate text-xs font-semibold text-text-primary">{unread.body}</span>
                    )}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No channels yet.</p>
          )}
        </div>
```

- [ ] **Step 4: Show the unread dot and preview on DM rows**

Replace:

```tsx
        <div className="space-y-0.5 p-2">
          {dms && dms.length > 0 ? (
            dms.map((dm) => (
              <button
                key={dm.id}
                onClick={() => setSelectedChannel(dm)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  selectedChannel?.id === dm.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-muted'
                }`}
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dm.dmParticipant) setProfileUserId(dm.dmParticipant.id);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary hover:opacity-80 transition-opacity"
                >
                  {(dm.dmParticipant?.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{dm.dmParticipant?.name ?? 'Unknown'}</span>
              </button>
            ))
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No direct messages yet.</p>
          )}
        </div>
```

with:

```tsx
        <div className="space-y-0.5 p-2">
          {dms && dms.length > 0 ? (
            dms.map((dm) => {
              const unread = unreadMap.get(dm.id);
              return (
                <button
                  key={dm.id}
                  onClick={() => setSelectedChannel(dm)}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    selectedChannel?.id === dm.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dm.dmParticipant) setProfileUserId(dm.dmParticipant.id);
                    }}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary hover:opacity-80 transition-opacity"
                  >
                    {(dm.dmParticipant?.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{dm.dmParticipant?.name ?? 'Unknown'}</span>
                      {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    </span>
                    {unread && (
                      <span className="block truncate text-xs font-semibold text-text-primary">{unread.body}</span>
                    )}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No direct messages yet.</p>
          )}
        </div>
```

- [ ] **Step 5: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify in the browser**

Start both dev servers. Log in as two accounts in the same org, in two separate browser sessions:

1. As `USER_A`, with `USER_B` sitting on any page other than the chat page (or with a different channel open), send several messages in a row to a channel/DM `USER_B` is in.
2. As `USER_B`: confirm no toast fires (chat messages are silent by design), the sidebar dot appears with `"{USER_A's name}: {latest message}"` as the preview, and the bell badge count increments by exactly 1 for this burst (not once per message).
3. Click into that channel as `USER_B`: confirm the dot and preview disappear immediately, and the corresponding entry in the bell dropdown is now marked read.
4. With `USER_B` sitting inside that same channel already, have `USER_A` send another message: confirm it never flashes unread — no dot appears at all.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add "src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx"
git commit -m "feat(chat): show unread indicators and sender previews in the chat sidebar"
```
