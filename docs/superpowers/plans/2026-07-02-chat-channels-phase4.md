# Chat Phase 4 (Private Direct Messages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 1:1 direct messages between any two organization members, per `docs/superpowers/specs/2026-07-02-chat-channels-phase4-design.md`. Reuses the existing `Channel`/`ChannelMember`/`Message` infrastructure wholesale — a DM is a `Channel` with `type: 'DM'`.

**Architecture:** No new tables, no new socket events. `Channel.name` becomes nullable (DMs have none) and gains a `dmKey` column (sorted `userIdA:userIdB`) with a partial unique index, making "start a DM" idempotent. Messaging, reactions, deletion, and file sharing all work on DM channels unchanged since they're keyed purely off `channelId`/`ChannelMember` rows. New code is limited to DM creation/listing and a handful of guards on channel-management endpoints that don't apply to a fixed, adminless 2-person conversation.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, Socket.IO, Next.js 16 / React 19, TanStack Query, sonner.

## Global Constraints

- No test runner exists in this repo. Every task's deliverable is verified manually via `curl` and/or the browser.
- **Deleting a DM message is sender-only — no org-admin override.** This is a deliberate narrowing of Phase 2's rule, not a bug.
- `deleteChannel`, `inviteChannelMember` (invite), `leaveChannel`, `removeChannelMember` (force-remove) all reject `type: 'DM'` channels with `400`. `GET` members stays unguarded (harmless).
- No commit message in this plan includes a `Co-Authored-By` trailer.

---

## Task 1: Data layer — nullable `Channel.name`, `dmKey` column and partial unique index

**Files:**
- Create: `backend/src/sequelize/migrations/20260702060000-add-dm-support.js`
- Modify: `backend/src/models/channels.model.ts`
- Modify: `backend/src/types/channels.types.ts`

**Interfaces:**
- Consumes: `Channel` model (Phase 1).
- Produces: `Channel.type` including `'DM'`; `Channel.name` nullable; `Channel.dmKey` field. Task 2 consumes all of these.

- [ ] **Step 1: Write the migration**

Create `backend/src/sequelize/migrations/20260702060000-add-dm-support.js`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_channels_type" ADD VALUE IF NOT EXISTS 'DM'`);

    await queryInterface.changeColumn('channels', 'name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn('channels', 'dmKey', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX channels_organization_id_dm_key_unique ON "channels" ("organizationId", "dmKey") WHERE "dmKey" IS NOT NULL`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS channels_organization_id_dm_key_unique`);
    await queryInterface.removeColumn('channels', 'dmKey');

    await queryInterface.sequelize.query(`UPDATE "channels" SET type = 'PRIVATE' WHERE type = 'DM'`);
    await queryInterface.sequelize.query(`UPDATE "channels" SET name = 'unnamed-' || id WHERE name IS NULL`);

    await queryInterface.changeColumn('channels', 'name', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });

    await queryInterface.sequelize.query(`ALTER TABLE "channels" ALTER COLUMN type TYPE VARCHAR(255)`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_channels_type"`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_channels_type" AS ENUM ('PUBLIC', 'PRIVATE')`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "channels" ALTER COLUMN type TYPE "enum_channels_type" USING type::"enum_channels_type"`
    );
  },
};
```

- [ ] **Step 2: Update the `Channel` model**

In `backend/src/models/channels.model.ts`, replace:

```ts
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('PUBLIC', 'PRIVATE'),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
```

with:

```ts
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('PUBLIC', 'PRIVATE', 'DM'),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    dmKey: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
  },
```

- [ ] **Step 3: Update the types file**

In `backend/src/types/channels.types.ts`, replace:

```ts
export interface Channels {
  id: string;
  organizationId: string;
  name: string;
  type: 'PUBLIC' | 'PRIVATE';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ChannelCreationAttributes = Optional<
  Channels,
  'id' | 'createdAt' | 'updatedAt'
>;
```

with:

```ts
export interface Channels {
  id: string;
  organizationId: string;
  name: string | null;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
  createdBy: string;
  dmKey?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ChannelCreationAttributes = Optional<
  Channels,
  'id' | 'createdAt' | 'updatedAt' | 'name' | 'dmKey'
>;
```

- [ ] **Step 4: Run the migration and verify**

```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:status
```

Expected: `20260702060000-add-dm-support: migrated`, status shows it `up`.

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add backend/src/sequelize/migrations/20260702060000-add-dm-support.js \
  backend/src/models/channels.model.ts backend/src/types/channels.types.ts
git commit -m "feat(chat): add DM channel type, nullable name, and dmKey column"
```

---

## Task 2: Backend — start/list DM endpoints, DM guards, close the admin-override privacy gap

**Files:**
- Modify: `backend/src/repositories/channel.repository.ts`
- Modify: `backend/src/controllers/channel.controller.ts`
- Modify: `backend/src/routes/channel.routes.ts`
- Modify: `backend/src/validations/channel.validation.ts`

**Interfaces:**
- Consumes: `Channel`/`ChannelMember` models (Task 1), `getIO` (Phase 1), `organizationMemberRepository`/`organizationRepository`/`userRepository` (already imported in `channel.controller.ts`).
- Produces: `channelRepository.findOrCreateDM`, `channelRepository.findDMsForUser`; `startDM`, `listDMs` controllers. No later task in this phase depends on this beyond the frontend consuming the routes.

- [ ] **Step 1: Fix `findVisibleToUser` to exclude DM channels**

DM channels have `Channel.name: null`, and without this fix they'd leak into the regular (non-DM) channel list wherever the requesting user is one of the two participants — showing up twice (once as a nameless "channel," once correctly under Direct Messages) in the sidebar.

In `backend/src/repositories/channel.repository.ts`, replace:

```ts
  findVisibleToUser: async (organizationId: string, userId: string): Promise<ChannelInstance[]> => {
    const memberships = await ChannelMember.findAll({
      where: { userId },
      attributes: ['channelId'],
    });
    const memberChannelIds = memberships.map((m) => m.channelId);

    return await Channel.findAll({
      where: {
        organizationId,
        [Op.or]: [{ type: 'PUBLIC' }, { id: { [Op.in]: memberChannelIds } }],
      },
      order: [['createdAt', 'ASC']],
    });
  },
```

with:

```ts
  findVisibleToUser: async (organizationId: string, userId: string): Promise<ChannelInstance[]> => {
    const memberships = await ChannelMember.findAll({
      where: { userId },
      attributes: ['channelId'],
    });
    const memberChannelIds = memberships.map((m) => m.channelId);

    return await Channel.findAll({
      where: {
        organizationId,
        type: { [Op.ne]: 'DM' },
        [Op.or]: [{ type: 'PUBLIC' }, { id: { [Op.in]: memberChannelIds } }],
      },
      order: [['createdAt', 'ASC']],
    });
  },
```

- [ ] **Step 2: Add DM lookup/creation to the repository**

In `backend/src/repositories/channel.repository.ts`, add this function directly above `export const channelRepository = {`:

```ts
function buildDmKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}
```

Then add these two methods inside `channelRepository`, directly after `delete`:

```ts

  findOrCreateDM: async (
    organizationId: string,
    userIdA: string,
    userIdB: string,
  ): Promise<{ channel: ChannelInstance; created: boolean }> => {
    const dmKey = buildDmKey(userIdA, userIdB);
    const existing = await Channel.findOne({ where: { organizationId, dmKey } });
    if (existing) return { channel: existing, created: false };

    const channel = await Channel.create({
      organizationId,
      name: null,
      type: 'DM',
      createdBy: userIdA,
      dmKey,
    });
    await ChannelMember.bulkCreate([
      { channelId: channel.id, userId: userIdA },
      { channelId: channel.id, userId: userIdB },
    ]);
    return { channel, created: true };
  },

  findDMsForUser: async (organizationId: string, userId: string): Promise<ChannelInstance[]> => {
    const memberships = await ChannelMember.findAll({
      where: { userId },
      attributes: ['channelId'],
    });
    const memberChannelIds = memberships.map((m) => m.channelId);
    if (memberChannelIds.length === 0) return [];
    return await Channel.findAll({
      where: {
        organizationId,
        type: 'DM',
        id: { [Op.in]: memberChannelIds },
      },
      order: [['createdAt', 'DESC']],
    });
  },
```

- [ ] **Step 3: Add DM guards to existing endpoints**

In `backend/src/controllers/channel.controller.ts`, replace:

```ts
export const deleteChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  await channelRepository.delete(channelId);
```

with:

```ts
export const deleteChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  await channelRepository.delete(channelId);
```

Replace:

```ts
export const inviteChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { userId } = req.body as { userId: string };

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const org = await organizationRepository.findById(channel.organizationId);
```

with:

```ts
export const inviteChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { userId } = req.body as { userId: string };

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  const org = await organizationRepository.findById(channel.organizationId);
```

Replace:

```ts
export const leaveChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const membership = await channelMemberRepository.findMember(channelId, user.id);
  if (!membership) throw new ApiError(404, 'You are not a member of this channel');
```

with:

```ts
export const leaveChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  const membership = await channelMemberRepository.findMember(channelId, user.id);
  if (!membership) throw new ApiError(404, 'You are not a member of this channel');
```

Replace:

```ts
export const removeChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const userId = req.params.userId as string;

  const membership = await channelMemberRepository.findMember(channelId, userId);
  if (!membership) throw new ApiError(404, 'Member not found in this channel');
```

with:

```ts
export const removeChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const userId = req.params.userId as string;

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');
  if (channel.type === 'DM') throw new ApiError(400, 'Not applicable to direct messages');

  const membership = await channelMemberRepository.findMember(channelId, userId);
  if (!membership) throw new ApiError(404, 'Member not found in this channel');
```

- [ ] **Step 4: Close the DM admin-override privacy gap in `deleteMessage`**

In `backend/src/controllers/channel.controller.ts`, replace:

```ts
  const isSender = message.senderId === user.id;
  let isAdmin = false;
  if (!isSender) {
    const channel = await channelRepository.findById(channelId);
    if (channel) {
      const org = await organizationRepository.findById(channel.organizationId);
```

with:

```ts
  const isSender = message.senderId === user.id;
  let isAdmin = false;
  if (!isSender) {
    const channel = await channelRepository.findById(channelId);
    if (channel && channel.type !== 'DM') {
      const org = await organizationRepository.findById(channel.organizationId);
```

(The rest of the `if` block is unchanged — this just adds `&& channel.type !== 'DM'` to the condition, so `isAdmin` stays `false` for any DM message, regardless of the caller's org role.)

- [ ] **Step 5: Add `startDM`/`listDMs` controllers**

In `backend/src/controllers/channel.controller.ts`, append at the end of the file:

```ts

export const startDM = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const { userId: targetUserId } = req.body as { userId: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  if (targetUserId === user.id) throw new ApiError(400, 'Cannot start a DM with yourself');

  const org = await organizationRepository.findById(organizationId);
  const targetMembership = await organizationMemberRepository.findOne({ organizationId, userId: targetUserId });
  if (!targetMembership && org?.ownerId !== targetUserId) {
    throw new ApiError(400, 'User is not a member of this organization');
  }

  const { channel, created } = await channelRepository.findOrCreateDM(organizationId, user.id, targetUserId);

  if (created) {
    const io = getIO();
    io.in(`user:${user.id}`).socketsJoin(`channel:${channel.id}`);
    io.in(`user:${targetUserId}`).socketsJoin(`channel:${channel.id}`);
  }

  const targetUser = await userRepository.findById(targetUserId);
  const data = {
    ...channel.get({ plain: true }),
    dmParticipant: targetUser ? { id: targetUser.id, name: targetUser.name, avatarUrl: targetUser.avatarUrl } : null,
  };

  return res.status(created ? 201 : 200).json({
    success: true,
    message: created ? 'Direct message started' : 'Direct message already exists',
    data,
  });
});

export const listDMs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channels = await channelRepository.findDMsForUser(organizationId, user.id);

  const data = await Promise.all(
    channels.map(async (channel) => {
      const members = await channelMemberRepository.findMembers(channel.id);
      const other = members.find((m) => m.userId !== user.id);
      return {
        ...channel.get({ plain: true }),
        dmParticipant: other?.user
          ? { id: other.user.id, name: other.user.name, avatarUrl: other.user.avatarUrl }
          : null,
      };
    })
  );

  return ok(res, data, 'Direct messages retrieved successfully');
});
```

- [ ] **Step 6: Add validation schema and routes**

In `backend/src/validations/channel.validation.ts`, append at the end of the file:

```ts

export const startDMSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
};
```

In `backend/src/routes/channel.routes.ts`, update the controller import:

```ts
import {
  createChannel,
  listChannels,
  deleteChannel,
  listChannelMembers,
  inviteChannelMember,
  leaveChannel,
  removeChannelMember,
  sendMessage,
  listMessages,
  addReaction,
  removeReaction,
  deleteMessage,
  uploadFile,
  listFiles,
  downloadFile,
} from '../controllers/channel.controller.js';
```

to:

```ts
import {
  createChannel,
  listChannels,
  deleteChannel,
  listChannelMembers,
  inviteChannelMember,
  leaveChannel,
  removeChannelMember,
  sendMessage,
  listMessages,
  addReaction,
  removeReaction,
  deleteMessage,
  uploadFile,
  listFiles,
  downloadFile,
  startDM,
  listDMs,
} from '../controllers/channel.controller.js';
```

and the validation import:

```ts
import {
  createChannelSchema,
  organizationChannelsParamSchema,
  channelParamSchema,
  inviteChannelMemberSchema,
  channelMemberParamSchema,
  sendMessageSchema,
  listMessagesSchema,
  addReactionSchema,
  removeReactionSchema,
  messageParamSchema,
} from '../validations/channel.validation.js';
```

to:

```ts
import {
  createChannelSchema,
  organizationChannelsParamSchema,
  channelParamSchema,
  inviteChannelMemberSchema,
  channelMemberParamSchema,
  sendMessageSchema,
  listMessagesSchema,
  addReactionSchema,
  removeReactionSchema,
  messageParamSchema,
  startDMSchema,
} from '../validations/channel.validation.js';
```

Then add before `export default router;`:

```ts

router
  .route('/organizations/:organizationId/dms')
  .post(verifyJWT, isOrganizationMember, validate(startDMSchema), startDM)
  .get(verifyJWT, isOrganizationMember, validate(organizationChannelsParamSchema), listDMs);
```

- [ ] **Step 7: Verify with curl**

Start the dev server, log in as two dev users (`USER_A`/`cookies_a.txt`, `USER_B`/`cookies_b.txt`) in the same org (`ORG_ID`, with `USER_B_ID` known):

```bash
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/organizations/ORG_ID/dms \
  -H "Content-Type: application/json" -d "{\"userId\":\"USER_B_ID\"}"
```

Expected: `201` with `"data": { "type": "DM", "name": null, "dmParticipant": { "name": "...B's name..." }, ... }`. Copy the returned `id` as `DM_ID`.

```bash
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/organizations/ORG_ID/dms \
  -H "Content-Type: application/json" -d "{\"userId\":\"USER_B_ID\"}"
```

Expected: `200` (idempotent — same DM, not a new one).

```bash
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/organizations/ORG_ID/dms
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/organizations/ORG_ID/dms
```

Expected: each shows the one DM, with `dmParticipant` being *the other* user in each case.

```bash
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/organizations/ORG_ID/channels
```

Expected: the DM does **not** appear in this list (regular channel list stays DM-free).

```bash
curl -b /tmp/cookies_b.txt -s -X POST http://localhost:8080/api/v1/channels/DM_ID/messages \
  -H "Content-Type: application/json" -d '{"content":"hey from B"}'
```

Expected: `201` — messaging works unchanged. Copy the returned message `id` as `B_MSG_ID`.

```bash
curl -b /tmp/cookies_a.txt -s -X DELETE http://localhost:8080/api/v1/channels/DM_ID/messages/B_MSG_ID
```

Expected: `403` — `USER_A` is the org owner (normally admin-override eligible) but is not the sender of this DM message, and the admin override no longer applies inside DMs.

```bash
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/api/v1/channels/DM_ID
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/api/v1/channels/DM_ID/members/me
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/channels/DM_ID/members \
  -H "Content-Type: application/json" -d '{"userId":"USER_B_ID"}'
```

Expected: all three `400` (delete-channel, leave, and invite are all rejected for a DM).

- [ ] **Step 8: Commit**

```bash
git add backend/src/repositories/channel.repository.ts backend/src/controllers/channel.controller.ts \
  backend/src/routes/channel.routes.ts backend/src/validations/channel.validation.ts
git commit -m "feat(chat): add DM start/list endpoints, DM guards, and DM message-delete privacy fix"
```

---

## Task 3: Frontend plumbing — types, service, hooks for DMs

**Files:**
- Modify: `frontend/src/types/channel.types.ts`
- Modify: `frontend/src/services/channel.service.ts`
- Modify: `frontend/src/hooks/useChannel.ts`

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/axios.ts`), existing `Channel` type.
- Produces: `Channel.type` including `'DM'`; `Channel.name: string | null`; `Channel.dmParticipant`; `getDMs`, `startDM` service functions; `useDMs`, `useStartDM` hooks. Consumed by Task 4.

- [ ] **Step 1: Extend the `Channel` type**

In `frontend/src/types/channel.types.ts`, replace:

```ts
export type ChannelType = 'PUBLIC' | 'PRIVATE';

export interface Channel {
  id: string;
  organizationId: string;
  name: string;
  type: ChannelType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

with:

```ts
export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM';

export interface Channel {
  id: string;
  organizationId: string;
  name: string | null;
  type: ChannelType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dmParticipant?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}
```

- [ ] **Step 2: Add service functions**

In `frontend/src/services/channel.service.ts`, append at the end of the file:

```ts

export async function getDMs(organizationId: string): Promise<Channel[]> {
  const res = await api.get<ChannelsResponse>(`/organizations/${organizationId}/dms`);
  return res.data.data;
}

export async function startDM(organizationId: string, userId: string): Promise<Channel> {
  const res = await api.post<ChannelResponse>(`/organizations/${organizationId}/dms`, { userId });
  return res.data.data;
}
```

- [ ] **Step 3: Add hooks**

In `frontend/src/hooks/useChannel.ts`, change the import line:

```ts
import {
  getChannels,
  createChannel,
  deleteChannel,
  getChannelMembers,
  inviteChannelMember,
  leaveChannel,
  removeChannelMember,
  getMessages,
  sendMessage,
  addReaction,
  removeReaction,
  deleteMessage,
  getFiles,
  uploadFile,
} from '@/services/channel.service';
```

to:

```ts
import {
  getChannels,
  createChannel,
  deleteChannel,
  getChannelMembers,
  inviteChannelMember,
  leaveChannel,
  removeChannelMember,
  getMessages,
  sendMessage,
  addReaction,
  removeReaction,
  deleteMessage,
  getFiles,
  uploadFile,
  getDMs,
  startDM,
} from '@/services/channel.service';
```

Then append at the end of the file:

```ts

export const useDMs = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'dms'],
    queryFn: () => getDMs(organizationId),
    enabled: !!organizationId,
  });

export const useStartDM = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => startDM(organizationId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'dms'] }),
  });
};
```

- [ ] **Step 4: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/channel.types.ts frontend/src/services/channel.service.ts frontend/src/hooks/useChannel.ts
git commit -m "feat(chat): add frontend types/service/hooks for direct messages"
```

---

## Task 4: Frontend UI — Direct Messages sidebar, user picker, DM-aware channel header

**Files:**
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`

**Interfaces:**
- Consumes: `useDMs`, `useStartDM` (Task 3); existing `useOrganizationMembers`; existing `MessagePane`/`FileList` (reused unchanged for DMs).
- Produces: fully interactive direct messaging. Last task in this phase.

- [ ] **Step 1: Add the user-picker modal and DM state to `ChatPage.tsx`**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`, replace:

```tsx
import { use, useEffect, useState } from 'react';
import { Hash, Lock, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useChannels, useCreateChannel } from '@/hooks/useChannel';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatSkeleton } from '@/components/shared/skeletons/ChatSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import type { Channel } from '@/types/channel.types';
import ChannelView from './ChannelView';
```

with:

```tsx
import { use, useEffect, useState } from 'react';
import { Hash, Lock, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useChannels, useCreateChannel, useDMs, useStartDM } from '@/hooks/useChannel';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatSkeleton } from '@/components/shared/skeletons/ChatSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import type { Channel } from '@/types/channel.types';
import ChannelView from './ChannelView';
```

Then, directly after the closing brace of `CreateChannelModal` (before `export default function ChatPage`), add a new modal component:

```tsx

function NewDMModal({
  onClose,
  onSelect,
  members,
  isPending,
}: {
  onClose: () => void;
  onSelect: (userId: string) => void;
  members: { userId: string; user?: { id: string; name: string; avatarUrl: string | null } }[];
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-gray-800">New Direct Message</h2>
        <p className="mt-0.5 text-xs text-gray-400">Pick someone in your organization to message.</p>

        <div className="mt-4 max-h-80 space-y-1 overflow-y-auto">
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={() => onSelect(m.userId)}
              disabled={isPending}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(m.user?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{m.user?.name ?? 'Unknown'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire DM state, the new sidebar section, and the modal**

Replace:

```tsx
export default function ChatPage({ params }: Props) {
  const { slug } = use(params);
  const { user } = useAuthStore();

  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const createChannel = useCreateChannel(org?.id ?? '');

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (selectedChannel && channels && !channels.some((c) => c.id === selectedChannel.id)) {
      setSelectedChannel(null);
    }
  }, [channels, selectedChannel]);
```

with:

```tsx
export default function ChatPage({ params }: Props) {
  const { slug } = use(params);
  const { user } = useAuthStore();

  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: dms } = useDMs(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const createChannel = useCreateChannel(org?.id ?? '');
  const startDM = useStartDM(org?.id ?? '');

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);

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

Replace:

```tsx
  const handleCreate = (name: string, type: 'PUBLIC' | 'PRIVATE') => {
    createChannel.mutate(
      { name, type },
      {
        onSuccess: (channel) => {
          toast.success('Channel created');
          setShowCreateModal(false);
          setSelectedChannel(channel);
        },
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      }
    );
  };
```

with:

```tsx
  const handleCreate = (name: string, type: 'PUBLIC' | 'PRIVATE') => {
    createChannel.mutate(
      { name, type },
      {
        onSuccess: (channel) => {
          toast.success('Channel created');
          setShowCreateModal(false);
          setSelectedChannel(channel);
        },
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      }
    );
  };

  const handleStartDM = (userId: string) => {
    startDM.mutate(userId, {
      onSuccess: (channel) => {
        setShowDMModal(false);
        setSelectedChannel(channel);
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };
```

Replace:

```tsx
        </div>
      </aside>

      <div className="flex-1 rounded-xl border border-border-subtle bg-white overflow-hidden">
```

with:

```tsx
        </div>
      </aside>

      <aside className="flex w-64 shrink-0 flex-col rounded-xl border border-border-subtle bg-white">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Direct Messages</span>
          <button
            onClick={() => setShowDMModal(true)}
            className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
            title="New direct message"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
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
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {(dm.dmParticipant?.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{dm.dmParticipant?.name ?? 'Unknown'}</span>
              </button>
            ))
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No direct messages yet.</p>
          )}
        </div>
      </aside>

      <div className="flex-1 rounded-xl border border-border-subtle bg-white overflow-hidden">
```

Finally, replace:

```tsx
      {showCreateModal && (
        <CreateChannelModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isPending={createChannel.isPending}
        />
      )}
    </div>
  );
}
```

with:

```tsx
      {showCreateModal && (
        <CreateChannelModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isPending={createChannel.isPending}
        />
      )}

      {showDMModal && (
        <NewDMModal
          onClose={() => setShowDMModal(false)}
          onSelect={handleStartDM}
          members={(orgMembers ?? []).filter((m) => m.userId !== user?.id)}
          isPending={startDM.isPending}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Make `ChannelView`'s header DM-aware**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`, replace:

```tsx
        <div className="flex items-center gap-2">
          {channel.type === 'PUBLIC' ? <Hash size={15} className="text-text-secondary" /> : <Lock size={15} className="text-text-secondary" />}
          <h2 className="text-sm font-semibold text-text-primary">{channel.name}</h2>
          <span className="text-xs text-text-secondary">{members?.length ?? 0} members</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveView(activeView === 'files' ? 'messages' : 'files')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activeView === 'files' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-muted'
            }`}
          >
            <Paperclip size={13} /> Files
          </button>
          <button
            onClick={() => setShowMembersModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <Users size={13} /> Members
          </button>
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <LogOut size={13} /> Leave
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft/20 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
```

with:

```tsx
        <div className="flex items-center gap-2">
          {channel.type === 'DM' ? (
            <>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {(channel.dmParticipant?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <h2 className="text-sm font-semibold text-text-primary">{channel.dmParticipant?.name ?? 'Unknown'}</h2>
            </>
          ) : (
            <>
              {channel.type === 'PUBLIC' ? <Hash size={15} className="text-text-secondary" /> : <Lock size={15} className="text-text-secondary" />}
              <h2 className="text-sm font-semibold text-text-primary">{channel.name}</h2>
              <span className="text-xs text-text-secondary">{members?.length ?? 0} members</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveView(activeView === 'files' ? 'messages' : 'files')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activeView === 'files' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-muted'
            }`}
          >
            <Paperclip size={13} /> Files
          </button>
          {channel.type !== 'DM' && (
            <>
              <button
                onClick={() => setShowMembersModal(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
              >
                <Users size={13} /> Members
              </button>
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
              >
                <LogOut size={13} /> Leave
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft/20 transition-colors"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </>
          )}
        </div>
```

- [ ] **Step 4: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 5: Verify in the browser**

Log in, open the chat page — expect a new "Direct Messages" section below "Channels" with a "+" button. Click it — expect a modal listing org members (excluding yourself); click one — expect it to open a new conversation (or reopen the existing one if you've already messaged them), showing that person's name in the header instead of a channel name/icon, with no Members/Leave/Delete buttons but the Files toggle still present. Send a message — expect it to work exactly like a channel message, including reactions, deletion (only your own messages), and live delivery to the other person's open session.

- [ ] **Step 6: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx"
git commit -m "feat(chat): add direct messages sidebar, user picker, and DM-aware channel header"
```
