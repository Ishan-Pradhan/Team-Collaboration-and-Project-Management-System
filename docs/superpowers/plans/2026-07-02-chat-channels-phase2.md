# Chat Phase 2 (Message Reactions & Deletion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add emoji reactions (multiple per user, full picker) and soft-delete (sender or org admin, content permanently discarded) to messages, per `docs/superpowers/specs/2026-07-02-chat-channels-phase2-design.md`. Builds directly on the Phase 1 `Message` model, REST/Socket.IO pipeline, and `MessagePane` component.

**Architecture:** No new transport or channel concepts. All writes go through REST (`routes → middlewares → controllers → repositories → models`); Socket.IO stays push-only, emitting to the existing `channel:<id>` room after a successful DB write, exactly like Phase 1's `message:new`. Reactions live in a new `MessageReaction` join table; deletion is a soft delete via two new columns on `Message`.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, Socket.IO, Next.js 16 / React 19, TanStack Query, Zod, sonner, `emoji-picker-react` (new).

## Global Constraints

- No test runner exists in this repo. Every task's deliverable is verified manually via `curl` against a running dev server and/or the browser — never claim a task done without running its verification commands.
- Backend layering is RMVCS: controllers never call Sequelize directly, only repositories.
- New migration goes in `backend/src/sequelize/migrations/` with a `YYYYMMDDHHMMSS-description.js` filename and the `up`/`down` shape used by every existing migration in that folder.
- Reactions/deletion reuse the existing `['channels', channelId, 'messages']` TanStack Query key — no new query keys are introduced, since reaction and deletion data both ride inside the existing message list/send payloads.
- All frontend error handling uses `parseApiError(err).message` with `sonner`'s `toast.error(...)`.
- Deleted message content is permanently discarded from the DB (not retained-but-hidden) — the repository overwrites `content` to `''` in the same update that sets `deletedAt`/`deletedBy`.
- Reactions and deletion apply only to `type: 'TEXT'` messages, never `SYSTEM` messages — enforced in controllers, not the schema.

---

## Task 1: Data layer — Message soft-delete columns, MessageReaction model/migration, association wiring

**Files:**
- Create: `backend/src/sequelize/migrations/20260702040000-add-message-deletion-and-reactions.js`
- Create: `backend/src/models/messageReactions.model.ts`
- Modify: `backend/src/models/messages.model.ts`
- Modify: `backend/src/types/channels.types.ts`
- Modify: `backend/src/models/index.ts`

**Interfaces:**
- Consumes: `Message`, `User` models and `MessageInstance` type from Phase 1.
- Produces: `MessageReaction` Sequelize model (exported from `models/index.ts`); `MessageReactionInstance`, `MessageReactionCreationAttributes`, `ReactionSummary`, `MessageWithReactions` types from `types/channels.types.ts`. Tasks 2 and 3 consume all of these.

- [ ] **Step 1: Write the migration**

Create `backend/src/sequelize/migrations/20260702040000-add-message-deletion-and-reactions.js`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'deletedBy', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.createTable('message_reactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      messageId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'messages', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      emoji: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('message_reactions', ['messageId']);
    await queryInterface.addIndex('message_reactions', ['messageId', 'userId', 'emoji'], {
      unique: true,
      name: 'message_reactions_message_id_user_id_emoji_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('message_reactions');
    await queryInterface.removeColumn('messages', 'deletedBy');
    await queryInterface.removeColumn('messages', 'deletedAt');
  },
};
```

- [ ] **Step 2: Extend the types file**

In `backend/src/types/channels.types.ts`, replace:

```ts
export interface Messages {
  id: string;
  channelId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM';
  content: string;
  createdAt?: Date;
  sender?: UserInstance;
}

export type MessageCreationAttributes = Optional<
  Messages,
  'id' | 'senderId' | 'type' | 'createdAt'
>;

export interface MessageInstance
  extends Model<Messages, MessageCreationAttributes>, Messages {}
```

with:

```ts
export interface Messages {
  id: string;
  channelId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM';
  content: string;
  createdAt?: Date;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  sender?: UserInstance;
}

export type MessageCreationAttributes = Optional<
  Messages,
  'id' | 'senderId' | 'type' | 'createdAt' | 'deletedAt' | 'deletedBy'
>;

export interface MessageInstance
  extends Model<Messages, MessageCreationAttributes>, Messages {}

export interface MessageReactions {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt?: Date;
  user?: UserInstance;
}

export type MessageReactionCreationAttributes = Optional<
  MessageReactions,
  'id' | 'createdAt'
>;

export interface MessageReactionInstance
  extends Model<MessageReactions, MessageReactionCreationAttributes>, MessageReactions {}

export interface ReactionSummary {
  emoji: string;
  userIds: string[];
}

export interface MessageWithReactions {
  id: string;
  channelId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM';
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  sender?: { id: string; name: string; avatarUrl: string | null } | null;
  reactions: ReactionSummary[];
}
```

- [ ] **Step 3: Add the two columns to the `Message` model**

In `backend/src/models/messages.model.ts`, replace:

```ts
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'messages',
    timestamps: true,
    updatedAt: false,
  },
);
```

with:

```ts
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deletedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: 'messages',
    timestamps: true,
    updatedAt: false,
  },
);
```

Do **not** set `paranoid: true` on the model options — that would activate Sequelize's built-in paranoid behavior (which hides "deleted" rows from normal queries entirely). This is a plain manual soft-delete column; deleted messages must still be returned by `findAll`/`findByPk` so the tombstone can render in place.

- [ ] **Step 4: Write the `MessageReaction` model**

Create `backend/src/models/messageReactions.model.ts`:

```ts
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { MessageReactionInstance } from '../types/channels.types.js';

export const MessageReaction = sequelize.define<MessageReactionInstance>(
  'MessageReaction',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    messageId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    emoji: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
  },
  {
    tableName: 'message_reactions',
    timestamps: true,
    updatedAt: false,
  },
);
```

- [ ] **Step 5: Wire associations into `models/index.ts`**

Add the import, next to the other model imports:

```ts
import { Message } from './messages.model.js';
import { MessageReaction } from './messageReactions.model.js';
```

(the `Message` import line already exists — only add the `MessageReaction` line directly below it).

Then, directly after this existing block:

```ts
Channel.hasMany(Message, { foreignKey: 'channelId', onDelete: 'CASCADE', as: 'messages' });
Message.belongsTo(Channel, { foreignKey: 'channelId', as: 'channel' });
Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
```

add:

```ts
Message.belongsTo(User, { as: 'deleter', foreignKey: 'deletedBy' });
Message.hasMany(MessageReaction, { foreignKey: 'messageId', onDelete: 'CASCADE', as: 'reactions' });
MessageReaction.belongsTo(Message, { foreignKey: 'messageId', as: 'message' });
MessageReaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
```

Finally, add `MessageReaction` to the final `export { ... }` block, next to `Message`:

```ts
  Channel,
  ChannelMember,
  Message,
  MessageReaction,
  Notification,
  ActivityLog,
};
```

- [ ] **Step 6: Run the migration and verify**

```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:status
```

Expected: `20260702040000-add-message-deletion-and-reactions: migrated` printed, and the status output shows it as `up`.

```bash
npx tsc --noEmit
```

Expected: no output (clean type-check).

```bash
npm run dev
```

Expected console output: `Database connected successfully` then `app is listening at 8080`, no association or model-loading errors. Stop with Ctrl+C once confirmed.

- [ ] **Step 7: Commit**

```bash
git add backend/src/sequelize/migrations/20260702040000-add-message-deletion-and-reactions.js \
  backend/src/models/messageReactions.model.ts backend/src/models/messages.model.ts \
  backend/src/types/channels.types.ts backend/src/models/index.ts
git commit -m "feat(chat): add message soft-delete columns and MessageReaction model"
```

---

## Task 2: Reaction endpoints — add, remove, and expose on message reads

**Files:**
- Modify: `backend/src/repositories/channel.repository.ts`
- Modify: `backend/src/controllers/channel.controller.ts`
- Modify: `backend/src/routes/channel.routes.ts`
- Modify: `backend/src/validations/channel.validation.ts`

**Interfaces:**
- Consumes: `MessageReaction` model, `MessageWithReactions`/`ReactionSummary` types (Task 1); `getIO` (Phase 1 Task 2); `isChannelMember` middleware (Phase 1 Task 3).
- Produces: `messageReactionRepository` (`add`, `remove`); `messageRepository.findById`/`findByChannel` now return `MessageWithReactions` (grouped reactions included) instead of `MessageInstance` — **this changes the return type consumed by `sendMessage`/`listMessages` from Phase 1 automatically, no controller changes needed there**; `addReaction`, `removeReaction` controllers. Task 3 consumes `messageRepository.findById`'s new `MessageWithReactions` shape (specifically `.type` and `.deletedAt`) for its own permission checks.

- [ ] **Step 1: Add validation schemas**

In `backend/src/validations/channel.validation.ts`, append at the end of the file:

```ts

export const messageParamSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
    messageId: z.string().uuid('Invalid message ID'),
  }),
};

export const addReactionSchema = {
  params: messageParamSchema.params,
  body: z.object({
    emoji: z.string().min(1, 'Emoji is required').max(64, 'Invalid emoji'),
  }),
};

export const removeReactionSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
    messageId: z.string().uuid('Invalid message ID'),
    emoji: z.string().min(1, 'Emoji is required').max(64, 'Invalid emoji'),
  }),
};
```

- [ ] **Step 2: Extend the repository — reactions + grouped reads**

In `backend/src/repositories/channel.repository.ts`, replace the import block:

```ts
import { Op } from 'sequelize';
import { Channel, ChannelMember, Message, User } from '../models/index.js';
import type {
  ChannelCreationAttributes,
  ChannelInstance,
  ChannelMemberInstance,
  MessageCreationAttributes,
  MessageInstance,
} from '../types/channels.types.js';
```

with:

```ts
import { Op } from 'sequelize';
import { Channel, ChannelMember, Message, MessageReaction, User } from '../models/index.js';
import type {
  ChannelCreationAttributes,
  ChannelInstance,
  ChannelMemberInstance,
  MessageCreationAttributes,
  MessageInstance,
  MessageWithReactions,
  ReactionSummary,
} from '../types/channels.types.js';

function groupReactions(rows: { emoji: string; userId: string }[]): ReactionSummary[] {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.emoji);
    if (existing) {
      existing.push(row.userId);
    } else {
      map.set(row.emoji, [row.userId]);
    }
  }
  return Array.from(map.entries()).map(([emoji, userIds]) => ({ emoji, userIds }));
}
```

Then replace the whole `messageRepository` object:

```ts
export const messageRepository = {
  create: async (data: MessageCreationAttributes): Promise<MessageInstance> => {
    return await Message.create(data);
  },

  findById: async (id: string): Promise<MessageWithReactions | null> => {
    const message = await Message.findByPk(id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] },
        { model: MessageReaction, as: 'reactions', attributes: ['emoji', 'userId'] },
      ],
    });
    if (!message) return null;
    const plain = message.get({ plain: true }) as MessageWithReactions & {
      reactions: { emoji: string; userId: string }[];
    };
    return { ...plain, reactions: groupReactions(plain.reactions) };
  },

  findByChannel: async (
    channelId: string,
    options: { before?: string; limit: number },
  ): Promise<MessageWithReactions[]> => {
    const where: Record<string, unknown> = { channelId };
    if (options.before) {
      where.createdAt = { [Op.lt]: options.before };
    }
    const messages = await Message.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] },
        { model: MessageReaction, as: 'reactions', attributes: ['emoji', 'userId'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: options.limit,
    });
    const plain = messages.map(
      (m) =>
        m.get({ plain: true }) as MessageWithReactions & {
          reactions: { emoji: string; userId: string }[];
        },
    );
    return plain.reverse().map((m) => ({ ...m, reactions: groupReactions(m.reactions) }));
  },
};

export const messageReactionRepository = {
  add: async (messageId: string, userId: string, emoji: string): Promise<void> => {
    await MessageReaction.findOrCreate({ where: { messageId, userId, emoji } });
  },

  remove: async (messageId: string, userId: string, emoji: string): Promise<number> => {
    return await MessageReaction.destroy({ where: { messageId, userId, emoji } });
  },
};
```

- [ ] **Step 3: Add reaction controllers**

In `backend/src/controllers/channel.controller.ts`, change the import line:

```ts
import { channelRepository, channelMemberRepository, messageRepository } from '../repositories/channel.repository.js';
```

to:

```ts
import { channelRepository, channelMemberRepository, messageRepository, messageReactionRepository } from '../repositories/channel.repository.js';
```

Then append at the end of the file:

```ts

export const addReaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;
  const { emoji } = req.body as { emoji: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const message = await messageRepository.findById(messageId);
  if (!message || message.channelId !== channelId) throw new ApiError(404, 'Message not found');
  if (message.type !== 'TEXT') throw new ApiError(400, 'Cannot react to a system message');
  if (message.deletedAt) throw new ApiError(400, 'Cannot react to a deleted message');

  await messageReactionRepository.add(messageId, user.id, emoji);

  getIO().to(`channel:${channelId}`).emit('reaction:added', { messageId, channelId, emoji, userId: user.id });

  return res.status(201).json({
    success: true,
    message: 'Reaction added',
    data: null,
  });
});

export const removeReaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;
  const emoji = req.params.emoji as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const message = await messageRepository.findById(messageId);
  if (!message || message.channelId !== channelId) throw new ApiError(404, 'Message not found');

  const removed = await messageReactionRepository.remove(messageId, user.id, emoji);
  if (removed === 0) throw new ApiError(404, 'Reaction not found');

  getIO().to(`channel:${channelId}`).emit('reaction:removed', { messageId, channelId, emoji, userId: user.id });

  return ok(res, null, 'Reaction removed');
});
```

- [ ] **Step 4: Add routes**

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
} from '../validations/channel.validation.js';
```

Then add before `export default router;`:

```ts

router
  .route('/channels/:channelId/messages/:messageId/reactions')
  .post(verifyJWT, isChannelMember, validate(addReactionSchema), addReaction);

router
  .route('/channels/:channelId/messages/:messageId/reactions/:emoji')
  .delete(verifyJWT, isChannelMember, validate(removeReactionSchema), removeReaction);
```

- [ ] **Step 5: Verify with curl**

Start the dev server (`cd backend && npm run dev`), log in, and send a message in an existing channel you're a member of (replace `CHANNEL_ID` with a real one from your dev data):

```bash
curl -c /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"email":"YOUR_DEV_EMAIL","password":"YOUR_DEV_PASSWORD"}'

curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages \
  -H "Content-Type: application/json" -d '{"content":"react to me"}'
```

Copy the returned `id` as `MESSAGE_ID`. Confirm the response already includes an empty `"reactions":[]` array.

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID/reactions \
  -H "Content-Type: application/json" -d '{"emoji":"👍"}'

curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID/reactions \
  -H "Content-Type: application/json" -d '{"emoji":"🎉"}'
```

Expected: both `201`.

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/messages
```

Expected: the message's `reactions` array now shows `[{"emoji":"👍","userIds":["<your id>"]},{"emoji":"🎉","userIds":["<your id>"]}]` (order may vary).

```bash
curl -b /tmp/cookies.txt -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID/reactions \
  -H "Content-Type: application/json" -d '{"emoji":"👍"}'
```

Expected: `201` again (idempotent re-add, not an error), and the follow-up `GET` still shows only one `userId` in the `👍` group (no duplicate).

```bash
curl -b /tmp/cookies.txt -s -X DELETE "http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID/reactions/%F0%9F%91%8D"
```

(`%F0%9F%91%8D` is the URL-encoded 👍 emoji.) Expected: `{"success":true,"message":"Reaction removed",...}`.

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/messages
```

Expected: `reactions` now shows only the `🎉` group; `👍` is gone entirely (not an empty-array entry).

```bash
curl -b /tmp/cookies.txt -s -o /dev/null -w "%{http_code}\n" -X DELETE "http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID/reactions/%F0%9F%91%8D"
```

Expected: `404` (already removed).

- [ ] **Step 6: Commit**

```bash
git add backend/src/repositories/channel.repository.ts backend/src/controllers/channel.controller.ts \
  backend/src/routes/channel.routes.ts backend/src/validations/channel.validation.ts
git commit -m "feat(chat): add message reaction add/remove endpoints"
```

---

## Task 3: Message deletion endpoint

**Files:**
- Modify: `backend/src/repositories/channel.repository.ts`
- Modify: `backend/src/controllers/channel.controller.ts`
- Modify: `backend/src/routes/channel.routes.ts`

**Interfaces:**
- Consumes: `messageRepository.findById` (Task 2, now returns `MessageWithReactions`), `MessageReaction` model (Task 1), `channelRepository.findById`, `organizationRepository`/`organizationMemberRepository` (already imported in `channel.controller.ts` since Phase 1), `getIO` (Phase 1 Task 2), `messageParamSchema` (Task 2).
- Produces: `messageRepository.delete`; `deleteMessage` controller. No later task in this phase depends on this one.

- [ ] **Step 1: Add the delete method to the repository**

In `backend/src/repositories/channel.repository.ts`, append inside `messageRepository`, directly after the `findByChannel` method (add a comma after its closing `},` and insert this before the object's closing `};`):

```ts

  delete: async (id: string, deletedBy: string): Promise<void> => {
    await Message.update(
      { content: '', deletedAt: new Date(), deletedBy },
      { where: { id } },
    );
    await MessageReaction.destroy({ where: { messageId: id } });
  },
```

So the full `messageRepository` object now ends with:

```ts
    return plain.reverse().map((m) => ({ ...m, reactions: groupReactions(m.reactions) }));
  },

  delete: async (id: string, deletedBy: string): Promise<void> => {
    await Message.update(
      { content: '', deletedAt: new Date(), deletedBy },
      { where: { id } },
    );
    await MessageReaction.destroy({ where: { messageId: id } });
  },
};
```

- [ ] **Step 2: Add the `deleteMessage` controller**

In `backend/src/controllers/channel.controller.ts`, append at the end of the file:

```ts

export const deleteMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const message = await messageRepository.findById(messageId);
  if (!message || message.channelId !== channelId) throw new ApiError(404, 'Message not found');
  if (message.type !== 'TEXT') throw new ApiError(400, 'Cannot delete a system message');
  if (message.deletedAt) throw new ApiError(400, 'Message already deleted');

  const isSender = message.senderId === user.id;
  let isAdmin = false;
  if (!isSender) {
    const channel = await channelRepository.findById(channelId);
    if (channel) {
      const org = await organizationRepository.findById(channel.organizationId);
      if (org?.ownerId === user.id) {
        isAdmin = true;
      } else {
        const membership = await organizationMemberRepository.findOne({
          organizationId: channel.organizationId,
          userId: user.id,
        });
        isAdmin = membership?.role === 'ORG_ADMIN';
      }
    }
  }
  if (!isSender && !isAdmin) {
    throw new ApiError(403, 'Unauthorized request. Only the sender or an organization admin can delete this message.');
  }

  await messageRepository.delete(messageId, user.id);

  getIO().to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });

  return ok(res, null, 'Message deleted successfully');
});
```

- [ ] **Step 3: Add the route**

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
} from '../validations/channel.validation.js';
```

Then add before `export default router;`:

```ts

router
  .route('/channels/:channelId/messages/:messageId')
  .delete(verifyJWT, isChannelMember, validate(messageParamSchema), deleteMessage);
```

- [ ] **Step 4: Verify with curl**

Using the dev server from Task 2, send a fresh message as your logged-in user (`USER_A`) and capture its `id` as `MESSAGE_ID`:

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages \
  -H "Content-Type: application/json" -d '{"content":"delete me"}'
```

As a second dev user (`USER_B`, logged in via `/tmp/user_b_cookies.txt`, a member of the same channel but not an org admin/owner) attempt to delete it:

```bash
curl -b /tmp/user_b_cookies.txt -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID
```

Expected: `403`.

Now delete it as the sender:

```bash
curl -b /tmp/cookies.txt -s -X DELETE http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID
```

Expected: `{"success":true,"message":"Message deleted successfully",...}`.

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/messages
```

Expected: that message now has `"content":""`, a non-null `"deletedAt"`, and `"reactions":[]` — even if it had reactions before deletion.

```bash
curl -b /tmp/cookies.txt -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID
```

Expected: `400` (already deleted).

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/channel.repository.ts backend/src/controllers/channel.controller.ts \
  backend/src/routes/channel.routes.ts
git commit -m "feat(chat): add message soft-delete endpoint"
```

---

## Task 4: Frontend plumbing — types, service, hooks, emoji picker dependency

**Files:**
- Modify: `frontend/src/types/channel.types.ts`
- Modify: `frontend/src/services/channel.service.ts`
- Modify: `frontend/src/hooks/useChannel.ts`
- Modify: `frontend/package.json` (add `emoji-picker-react`)

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/axios.ts`), existing `Message`/`Channel` types (Phase 1).
- Produces: `ReactionSummary` type; `Message.reactions`/`deletedAt`/`deletedBy` fields; `addReaction`/`removeReaction`/`deleteMessage` service functions; `useAddReaction`, `useRemoveReaction`, `useDeleteMessage` hooks. Consumed by Task 5.

- [ ] **Step 1: Install `emoji-picker-react`**

```bash
cd frontend && npm install emoji-picker-react
```

- [ ] **Step 2: Extend the `Message` type**

In `frontend/src/types/channel.types.ts`, replace:

```ts
export type MessageType = 'TEXT' | 'SYSTEM';

export interface Message {
  id: string;
  channelId: string;
  senderId: string | null;
  type: MessageType;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}
```

with:

```ts
export type MessageType = 'TEXT' | 'SYSTEM';

export interface ReactionSummary {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string | null;
  type: MessageType;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  reactions: ReactionSummary[];
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}
```

- [ ] **Step 3: Add service functions**

In `frontend/src/services/channel.service.ts`, append at the end of the file:

```ts

export async function addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  await api.post(`/channels/${channelId}/messages/${messageId}/reactions`, { emoji });
}

export async function removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  await api.delete(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
}

export async function deleteMessage(channelId: string, messageId: string): Promise<void> {
  await api.delete(`/channels/${channelId}/messages/${messageId}`);
}
```

- [ ] **Step 4: Add hooks**

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
} from '@/services/channel.service';
```

Then append at the end of the file:

```ts

export const useAddReaction = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      addReaction(channelId, messageId, emoji),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] }),
  });
};

export const useRemoveReaction = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      removeReaction(channelId, messageId, emoji),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] }),
  });
};

export const useDeleteMessage = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => deleteMessage(channelId, messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] }),
  });
};
```

- [ ] **Step 5: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/channel.types.ts frontend/src/services/channel.service.ts \
  frontend/src/hooks/useChannel.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(chat): add frontend types/service/hooks for reactions and message deletion"
```

---

## Task 5: Message UI — reaction picker, reaction chips, delete action, tombstone

**Files:**
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`

**Interfaces:**
- Consumes: `useAddReaction`, `useRemoveReaction`, `useDeleteMessage` (Task 4); `emoji-picker-react`'s `EmojiPicker` component and `EmojiClickData` type; existing `ConfirmationDialog`.
- Produces: fully interactive reactions and deletion in the message pane. No later backend task depends on this; Task 6 wires the real-time side of what this task builds.

- [ ] **Step 1: Update `MessagePane`'s imports and props**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx`, replace:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/axios';
import { useChannelMessages, useSendMessage } from '@/hooks/useChannel';
import { getMessages } from '@/services/channel.service';
import { useAuthStore } from '@/store/auth.store';
import type { Channel, Message } from '@/types/channel.types';

interface Props {
  channel: Channel;
}
```

with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Smile, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { parseApiError } from '@/lib/axios';
import {
  useChannelMessages,
  useSendMessage,
  useAddReaction,
  useRemoveReaction,
  useDeleteMessage,
} from '@/hooks/useChannel';
import { getMessages } from '@/services/channel.service';
import { useAuthStore } from '@/store/auth.store';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { Channel, Message } from '@/types/channel.types';

interface Props {
  channel: Channel;
  isAdmin: boolean;
}
```

- [ ] **Step 2: Add reaction/delete state and mutations**

Replace:

```tsx
export default function MessagePane({ channel }: Props) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: messages, isLoading } = useChannelMessages(channel.id);
  const sendMessage = useSendMessage(channel.id);
  const [content, setContent] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
```

with:

```tsx
export default function MessagePane({ channel, isAdmin }: Props) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: messages, isLoading } = useChannelMessages(channel.id);
  const sendMessage = useSendMessage(channel.id);
  const addReaction = useAddReaction(channel.id);
  const removeReaction = useRemoveReaction(channel.id);
  const deleteMessage = useDeleteMessage(channel.id);
  const [content, setContent] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Add reaction/delete handlers**

Replace:

```tsx
  const handleLoadMore = async () => {
    if (!messages || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await getMessages(channel.id, messages[0].createdAt);
      qc.setQueryData<Message[]>(['channels', channel.id, 'messages'], (old) =>
        old ? [...older, ...old] : older
      );
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  };

  if (isLoading) {
```

with:

```tsx
  const handleLoadMore = async () => {
    if (!messages || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await getMessages(channel.id, messages[0].createdAt);
      qc.setQueryData<Message[]>(['channels', channel.id, 'messages'], (old) =>
        old ? [...older, ...old] : older
      );
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleReaction = (message: Message, emoji: string) => {
    const reaction = message.reactions.find((r) => r.emoji === emoji);
    const alreadyReacted = !!user && !!reaction?.userIds.includes(user.id);
    if (alreadyReacted) {
      removeReaction.mutate(
        { messageId: message.id, emoji },
        { onError: (err: unknown) => toast.error(parseApiError(err).message) }
      );
    } else {
      addReaction.mutate(
        { messageId: message.id, emoji },
        { onError: (err: unknown) => toast.error(parseApiError(err).message) }
      );
    }
  };

  const handlePickEmoji = (message: Message, emojiData: EmojiClickData) => {
    addReaction.mutate(
      { messageId: message.id, emoji: emojiData.emoji },
      { onError: (err: unknown) => toast.error(parseApiError(err).message) }
    );
    setOpenPickerFor(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMessage.mutate(deleteTarget, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  if (isLoading) {
```

- [ ] **Step 4: Replace the message list rendering**

Replace:

```tsx
        {messages && messages.length > 0 ? (
          messages.map((message) =>
            message.type === 'SYSTEM' ? (
              <p key={message.id} className="text-center text-xs italic text-text-secondary">
                {message.content}
              </p>
            ) : (
              <div key={message.id} className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {(message.sender?.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {message.sender?.id === user?.id ? 'You' : message.sender?.name ?? 'Unknown'}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary">{message.content}</p>
                </div>
              </div>
            )
          )
        ) : (
          <p className="py-8 text-center text-sm text-text-secondary">No messages yet. Say hello!</p>
        )}
```

with:

```tsx
        {messages && messages.length > 0 ? (
          messages.map((message) =>
            message.type === 'SYSTEM' ? (
              <p key={message.id} className="text-center text-xs italic text-text-secondary">
                {message.content}
              </p>
            ) : (
              <div key={message.id} className="group relative flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {(message.sender?.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {message.sender?.id === user?.id ? 'You' : message.sender?.name ?? 'Unknown'}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {message.deletedAt ? (
                    <p className="text-sm italic text-text-secondary">This message was deleted</p>
                  ) : (
                    <>
                      <p className="text-sm text-text-primary">{message.content}</p>

                      {message.reactions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {message.reactions.map((reaction) => {
                            const reacted = !!user && reaction.userIds.includes(user.id);
                            return (
                              <button
                                key={reaction.emoji}
                                onClick={() => handleToggleReaction(message, reaction.emoji)}
                                className={`rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
                                  reacted
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border-subtle text-text-secondary hover:bg-surface-muted'
                                }`}
                              >
                                {reaction.emoji} {reaction.userIds.length}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!message.deletedAt && (
                  <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-lg border border-border-subtle bg-white p-0.5 shadow-sm group-hover:flex">
                    <button
                      onClick={() => setOpenPickerFor(openPickerFor === message.id ? null : message.id)}
                      className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
                      title="Add reaction"
                    >
                      <Smile size={14} />
                    </button>
                    {(message.sender?.id === user?.id || isAdmin) && (
                      <button
                        onClick={() => setDeleteTarget(message.id)}
                        className="rounded p-1 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors"
                        title="Delete message"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}

                {openPickerFor === message.id && (
                  <div className="absolute right-2 top-6 z-20">
                    <EmojiPicker onEmojiClick={(emojiData) => handlePickEmoji(message, emojiData)} />
                  </div>
                )}
              </div>
            )
          )
        ) : (
          <p className="py-8 text-center text-sm text-text-secondary">No messages yet. Say hello!</p>
        )}
```

- [ ] **Step 5: Add the delete confirmation dialog**

Replace:

```tsx
        <button
          type="submit"
          disabled={sendMessage.isPending || !content.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-colors disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
```

with:

```tsx
        <button
          type="submit"
          disabled={sendMessage.isPending || !content.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-colors disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </form>

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Message"
        description="Delete this message? This cannot be undone."
        confirmText="Delete"
        isDestructive
        isLoading={deleteMessage.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 6: Pass `isAdmin` down from `ChannelView`**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`, replace:

```tsx
      <div className="flex-1 overflow-hidden">
        <MessagePane channel={channel} />
      </div>
```

with:

```tsx
      <div className="flex-1 overflow-hidden">
        <MessagePane channel={channel} isAdmin={isAdmin} />
      </div>
```

- [ ] **Step 7: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 8: Verify in the browser**

Start both dev servers, log in, open a channel with at least one message. Hover over your own message — expect a small toolbar (smiley + trash icons) to fade in above it. Click the smiley — expect the emoji picker to open anchored near the message; pick an emoji — expect a reaction chip (e.g. `👍 1`) to appear under the message, highlighted since you reacted. Click that chip again — expect it to disappear (reaction removed). Pick two different emoji on the same message — expect two separate chips. Click the trash icon — expect the delete confirmation dialog; confirm — expect the message to be replaced in place by muted italic "This message was deleted" text, with no toolbar or reaction chips on hover afterward. As a non-sender, non-admin member, hover over someone else's message — expect only the smiley icon, no trash icon.

- [ ] **Step 9: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx"
git commit -m "feat(chat): add reaction picker, reaction chips, and message deletion UI"
```

---

## Task 6: Live socket wiring — reactions and deletion

**Files:**
- Modify: `frontend/src/hooks/useChatSocket.ts`

**Interfaces:**
- Consumes: query key `['channels', channelId, 'messages']` (Phase 1/Task 2-3 payload shape, now including `reactions`/`deletedAt`).
- Produces: fully live reactions and deletion — this is the last task in this phase.

- [ ] **Step 1: Add the three new event handlers**

In `frontend/src/hooks/useChatSocket.ts`, replace:

```ts
    const onMessageNew = (message: Message) => {
      qc.setQueryData<Message[]>(['channels', message.channelId, 'messages'], (old) =>
        old ? [...old, message] : [message]
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('channel:created', onChannelCreated);
    socket.on('channel:deleted', onChannelDeleted);
    socket.on('member:joined', onMemberJoined);
    socket.on('member:left', onMemberLeft);
    socket.on('message:new', onMessageNew);

    setConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('channel:created', onChannelCreated);
      socket.off('channel:deleted', onChannelDeleted);
      socket.off('member:joined', onMemberJoined);
      socket.off('member:left', onMemberLeft);
      socket.off('message:new', onMessageNew);
    };
```

with:

```ts
    const onMessageNew = (message: Message) => {
      qc.setQueryData<Message[]>(['channels', message.channelId, 'messages'], (old) =>
        old ? [...old, message] : [message]
      );
    };

    const onReactionAdded = ({
      messageId,
      channelId,
      emoji,
      userId,
    }: {
      messageId: string;
      channelId: string;
      emoji: string;
      userId: string;
    }) => {
      qc.setQueryData<Message[]>(['channels', channelId, 'messages'], (old) =>
        old?.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            if (existing.userIds.includes(userId)) return m;
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r
              ),
            };
          }
          return { ...m, reactions: [...m.reactions, { emoji, userIds: [userId] }] };
        })
      );
    };

    const onReactionRemoved = ({
      messageId,
      channelId,
      emoji,
      userId,
    }: {
      messageId: string;
      channelId: string;
      emoji: string;
      userId: string;
    }) => {
      qc.setQueryData<Message[]>(['channels', channelId, 'messages'], (old) =>
        old?.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: m.reactions
              .map((r) => (r.emoji === emoji ? { ...r, userIds: r.userIds.filter((id) => id !== userId) } : r))
              .filter((r) => r.userIds.length > 0),
          };
        })
      );
    };

    const onMessageDeleted = ({ messageId, channelId }: { messageId: string; channelId: string }) => {
      qc.setQueryData<Message[]>(['channels', channelId, 'messages'], (old) =>
        old?.map((m) =>
          m.id === messageId ? { ...m, content: '', deletedAt: new Date().toISOString(), reactions: [] } : m
        )
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('channel:created', onChannelCreated);
    socket.on('channel:deleted', onChannelDeleted);
    socket.on('member:joined', onMemberJoined);
    socket.on('member:left', onMemberLeft);
    socket.on('message:new', onMessageNew);
    socket.on('reaction:added', onReactionAdded);
    socket.on('reaction:removed', onReactionRemoved);
    socket.on('message:deleted', onMessageDeleted);

    setConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('channel:created', onChannelCreated);
      socket.off('channel:deleted', onChannelDeleted);
      socket.off('member:joined', onMemberJoined);
      socket.off('member:left', onMemberLeft);
      socket.off('message:new', onMessageNew);
      socket.off('reaction:added', onReactionAdded);
      socket.off('reaction:removed', onReactionRemoved);
      socket.off('message:deleted', onMessageDeleted);
    };
```

- [ ] **Step 2: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 3: Verify live updates in the browser**

Open two browser sessions (e.g. a normal window and an incognito window) logged in as two different members of the same org who are both members of the same channel, with that channel open in both.

In session A, react to a message. Expected: the reaction chip appears in session B within about a second, with no manual refresh. Remove the reaction in session A. Expected: it disappears in session B just as fast.

In session A, delete a message you sent (or, as an admin, delete someone else's). Expected: session B immediately shows "This message was deleted" in place of the original content, with no refresh.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useChatSocket.ts
git commit -m "feat(chat): wire live socket updates for reactions and message deletion"
```
