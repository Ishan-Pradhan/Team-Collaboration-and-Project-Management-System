# Chat Phase 1 (Real-Time Channels) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build org-scoped Slack-style channels with admin-only creation, member invites, self-leave/admin-remove, text messaging, and real-time delivery via Socket.IO, per `docs/superpowers/specs/2026-07-02-chat-channels-phase1-design.md`.

**Architecture:** Socket.IO attaches to the existing Express HTTP server (same process, same Render deploy). All writes go through REST following the existing RMVCS pattern (`routes → middlewares → controllers → repositories → models`); Socket.IO is push-only — controllers emit events to rooms after a successful DB write. Frontend uses a Socket.IO client singleton that updates TanStack Query's cache on incoming events instead of polling.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, Socket.IO (new), Next.js 16 / React 19, TanStack Query, socket.io-client (new), Zod, sonner.

## Global Constraints

- No test runner exists in this repo (no Jest/Vitest/Mocha). Do not add one. Every task's deliverable is verified manually via `curl` against a running dev server and/or the browser — never claim a task done without running its verification commands.
- Backend layering is RMVCS: controllers never call Sequelize directly, only repositories. Controllers use `asyncHandler`, `ApiError`, and `ok()` exactly as existing controllers do.
- New DB tables use snake_case table names (`channels`, `channel_members`, `messages`), matching the most recent migrations (`activity_logs`, `task_attachments`, `subtasks`) rather than the older PascalCase ones.
- All Sequelize migrations go in `backend/src/sequelize/migrations/` with a `YYYYMMDDHHMMSS-description.js` filename and the `up`/`down` shape used by every existing migration in that folder.
- Frontend query keys follow the existing breadcrumb convention: `['organizations', orgId, 'channels']`, `['channels', channelId, 'members']`, `['channels', channelId, 'messages']`.
- All frontend error handling uses `parseApiError(err).message` with `sonner`'s `toast.error(...)`, never `err.response?.data?.message` directly.
- Deployment target is Render free tier: single instance (no Redis adapter needed for Socket.IO), WebSockets supported, service may spin down after ~15 min idle (client must auto-reconnect gracefully).

---

## Task 1: Data layer — Channel/ChannelMember/Message models, migration, and association wiring

**Files:**
- Create: `backend/src/sequelize/migrations/20260702000000-create-channels-messages.js`
- Create: `backend/src/models/channels.model.ts`
- Create: `backend/src/models/channelMembers.model.ts`
- Create: `backend/src/models/messages.model.ts`
- Create: `backend/src/types/channels.types.ts`
- Delete: `backend/src/models/chatMessages.model.ts`
- Delete: `backend/src/types/chatMessages.types.ts`
- Modify: `backend/src/models/index.ts`

**Interfaces:**
- Produces: `Channel`, `ChannelMember`, `Message` Sequelize models (exported from `models/index.ts`); `ChannelInstance`, `ChannelCreationAttributes`, `ChannelMemberInstance`, `ChannelMemberCreationAttributes`, `MessageInstance`, `MessageCreationAttributes` types from `types/channels.types.ts`. All later backend tasks consume these.

- [ ] **Step 1: Delete the unused chatMessages stub**

Confirm it's safe first (no migration, no other consumers):

```bash
cd backend && grep -rn "ChatMessage\|chatMessages" src/
```

Expected: only `src/models/index.ts`, `src/models/chatMessages.model.ts`, `src/types/chatMessages.types.ts` — nothing else.

Delete the two files:

```bash
rm src/models/chatMessages.model.ts src/types/chatMessages.types.ts
```

- [ ] **Step 2: Write the migration**

Create `backend/src/sequelize/migrations/20260702000000-create-channels-messages.js`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('channels', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('PUBLIC', 'PRIVATE'),
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('channels', ['organizationId']);
    await queryInterface.addIndex('channels', ['organizationId', 'name'], {
      unique: true,
      name: 'channels_organization_id_name_unique',
    });

    await queryInterface.createTable('channel_members', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      channelId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'channels', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      joinedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('channel_members', ['channelId']);
    await queryInterface.addIndex('channel_members', ['userId']);
    await queryInterface.addIndex('channel_members', ['channelId', 'userId'], {
      unique: true,
      name: 'channel_members_channel_id_user_id_unique',
    });

    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      channelId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'channels', key: 'id' },
        onDelete: 'CASCADE',
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.ENUM('TEXT', 'SYSTEM'),
        allowNull: false,
        defaultValue: 'TEXT',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('messages', ['channelId', 'createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('channel_members');
    await queryInterface.dropTable('channels');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_channels_type"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_messages_type"');
  },
};
```

- [ ] **Step 3: Write the types file**

Create `backend/src/types/channels.types.ts`:

```ts
import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';

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

export interface ChannelInstance
  extends Model<Channels, ChannelCreationAttributes>, Channels {}

export interface ChannelMembers {
  id: string;
  channelId: string;
  userId: string;
  joinedAt?: Date;
  user?: UserInstance;
  channel?: ChannelInstance;
}

export type ChannelMemberCreationAttributes = Optional<
  ChannelMembers,
  'id' | 'joinedAt'
>;

export interface ChannelMemberInstance
  extends Model<ChannelMembers, ChannelMemberCreationAttributes>, ChannelMembers {}

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

- [ ] **Step 4: Write the three models**

Create `backend/src/models/channels.model.ts`:

```ts
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { ChannelInstance } from '../types/channels.types.js';

export const Channel = sequelize.define<ChannelInstance>(
  'Channel',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
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
  {
    tableName: 'channels',
    timestamps: true,
  },
);
```

Create `backend/src/models/channelMembers.model.ts`:

```ts
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { ChannelMemberInstance } from '../types/channels.types.js';

export const ChannelMember = sequelize.define<ChannelMemberInstance>(
  'ChannelMember',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    tableName: 'channel_members',
    timestamps: false,
  },
);
```

Create `backend/src/models/messages.model.ts`:

```ts
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { MessageInstance } from '../types/channels.types.js';

export const Message = sequelize.define<MessageInstance>(
  'Message',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('TEXT', 'SYSTEM'),
      allowNull: false,
      defaultValue: 'TEXT',
    },
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

- [ ] **Step 5: Wire associations into `models/index.ts`**

Replace the whole file content with (removes `ChatMessage`, adds `Channel`/`ChannelMember`/`Message`):

```ts
import { User } from './users.model.js';
import { Verification } from './verification.model.js';
import { Organization } from './organizations.model.js';
import { OrganizationMember } from './organizationMembers.model.js';
import { Invitation } from './invitations.model.js';
import { Project } from './projects.model.js';
import { ProjectMember } from './projectMembers.model.js';
import { KanbanColumn } from './kanbanColumns.model.js';
import { Task } from './tasks.model.js';
import { TaskAssignee } from './taskAssignees.model.js';
import { TaskComment } from './taskComments.model.js';
import { TaskAttachment } from './taskAttachments.model.js';
import { Subtask } from './subtasks.model.js';
import { Channel } from './channels.model.js';
import { ChannelMember } from './channelMembers.model.js';
import { Message } from './messages.model.js';
import { Notification } from './notifications.model.js';
import { ActivityLog } from './activityLog.model.js';

// Setup associations

// User ↔ Organization (through OrganizationMember)
User.belongsToMany(Organization, { through: OrganizationMember, foreignKey: 'userId' });
Organization.belongsToMany(User, { through: OrganizationMember, foreignKey: 'organizationId' });
Organization.hasMany(OrganizationMember, { foreignKey: 'organizationId', as: 'members' });
OrganizationMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
OrganizationMember.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// Organization → Owner
Organization.belongsTo(User, { as: 'owner', foreignKey: 'ownerId' });

// Organization → Projects
Organization.hasMany(Project, { foreignKey: 'organizationId', onDelete: 'CASCADE', as: 'projects' });
Project.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// User ↔ Project (through ProjectMember)
User.belongsToMany(Project, { through: ProjectMember, foreignKey: 'userId' });
Project.belongsToMany(User, { through: ProjectMember, foreignKey: 'projectId' });
Project.hasMany(ProjectMember, { foreignKey: 'projectId', as: 'members' });
ProjectMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ProjectMember.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Project → Kanban Columns
Project.hasMany(KanbanColumn, { foreignKey: 'projectId', onDelete: 'CASCADE', as: 'columns' });
KanbanColumn.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Column → Tasks
KanbanColumn.hasMany(Task, { foreignKey: 'columnId', as: 'tasks' });
Task.belongsTo(KanbanColumn, { foreignKey: 'columnId', as: 'column' });

// Task associations
Task.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Task.belongsTo(User, { as: 'creator', foreignKey: 'createdById' });
Task.belongsToMany(User, { through: TaskAssignee, foreignKey: 'taskId', otherKey: 'userId', as: 'assignees' });
User.belongsToMany(Task, { through: TaskAssignee, foreignKey: 'userId', otherKey: 'taskId', as: 'assignedTasks' });
Task.hasMany(TaskComment, { foreignKey: 'taskId', onDelete: 'CASCADE', as: 'comments' });
Task.hasMany(TaskAttachment, { foreignKey: 'taskId', onDelete: 'CASCADE', as: 'attachments' });
Task.hasMany(Subtask, { foreignKey: 'taskId', onDelete: 'CASCADE', as: 'subtasks' });

// Task Comments
TaskComment.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });
TaskComment.belongsTo(User, { as: 'author', foreignKey: 'authorId' });

// Task Attachments
TaskAttachment.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });
TaskAttachment.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedById' });

// Subtasks
Subtask.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });
Subtask.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

// Channels
Organization.hasMany(Channel, { foreignKey: 'organizationId', onDelete: 'CASCADE', as: 'channels' });
Channel.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Channel.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
Channel.hasMany(ChannelMember, { foreignKey: 'channelId', onDelete: 'CASCADE', as: 'members' });
ChannelMember.belongsTo(Channel, { foreignKey: 'channelId', as: 'channel' });
ChannelMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Channel.hasMany(Message, { foreignKey: 'channelId', onDelete: 'CASCADE', as: 'messages' });
Message.belongsTo(Channel, { foreignKey: 'channelId', as: 'channel' });
Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });

// Invitations
Invitation.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Invitation.belongsTo(User, { as: 'invitedBy', foreignKey: 'invitedById' });

// Notifications
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Activity Logs
ActivityLog.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
ActivityLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

// User ↔ Verification (if still needed)
User.hasMany(Verification, { foreignKey: 'userId', as: 'verifications' });
Verification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  User,
  Verification,
  Organization,
  OrganizationMember,
  Invitation,
  Project,
  ProjectMember,
  KanbanColumn,
  Task,
  TaskAssignee,
  TaskComment,
  TaskAttachment,
  Subtask,
  Channel,
  ChannelMember,
  Message,
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

Expected: the new migration shows `up` in the status output, and the `db:migrate` command printed `== 20260702000000-create-channels-messages: migrated`.

```bash
npm run dev
```

Expected console output: `Database connected successfully` then `app is listening at 8080`, with no association or model-loading errors. Stop the server with Ctrl+C once confirmed.

- [ ] **Step 7: Commit**

```bash
git add backend/src/sequelize/migrations/20260702000000-create-channels-messages.js \
  backend/src/models/channels.model.ts backend/src/models/channelMembers.model.ts \
  backend/src/models/messages.model.ts backend/src/types/channels.types.ts \
  backend/src/models/index.ts
git rm backend/src/models/chatMessages.model.ts backend/src/types/chatMessages.types.ts
git commit -m "feat(chat): add Channel/ChannelMember/Message data layer"
```

---

## Task 2: Socket.IO server infrastructure

**Files:**
- Create: `backend/src/socket/index.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/package.json` (add `socket.io`)

**Interfaces:**
- Consumes: `Channel`, `ChannelMember`, `OrganizationMember` models and `JwtPayload`/`userRepository` from Task 1 and existing auth code.
- Produces: `initSocket(httpServer): SocketIOServer` and `getIO(): SocketIOServer` from `backend/src/socket/index.js` — every later backend task imports `getIO` to emit events.

- [ ] **Step 1: Install socket.io**

```bash
cd backend && npm install socket.io
```

- [ ] **Step 2: Write the socket module**

Create `backend/src/socket/index.ts`:

```ts
import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/users.repository.js';
import { OrganizationMember, ChannelMember } from '../models/index.js';
import type { JwtPayload } from '../types/auth.types.js';

let io: SocketIOServer | null = null;

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

function readCookie(rawCookieHeader: string, name: string): string | undefined {
  const match = rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      const token = rawCookie ? readCookie(rawCookie, 'accessToken') : undefined;
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as JwtPayload;
      const user = await userRepository.findById(decoded.id);
      if (!user) {
        return next(new Error('Unauthorized'));
      }

      socket.userId = user.id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId as string;
    socket.join(`user:${userId}`);

    const [orgMemberships, channelMemberships] = await Promise.all([
      OrganizationMember.findAll({ where: { userId }, attributes: ['organizationId'] }),
      ChannelMember.findAll({ where: { userId }, attributes: ['channelId'] }),
    ]);

    orgMemberships.forEach((m) => socket.join(`org:${m.organizationId}`));
    channelMemberships.forEach((m) => socket.join(`channel:${m.channelId}`));
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocket first.');
  }
  return io;
};
```

- [ ] **Step 3: Attach Socket.IO to the HTTP server in `index.ts`**

In `backend/src/index.ts`, replace:

```ts
import express, { type Request, type Response } from 'express';
import { sequelize } from './config/db.js';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { limiter } from './middlewares/rateLimiter.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { swaggerSpec } from './config/swagger.config.js';
import './models/index.js';

dotenv.config();

const app = express();
```

with:

```ts
import express, { type Request, type Response } from 'express';
import http from 'http';
import { sequelize } from './config/db.js';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { limiter } from './middlewares/rateLimiter.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { swaggerSpec } from './config/swagger.config.js';
import { initSocket } from './socket/index.js';
import './models/index.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
initSocket(httpServer);
```

Then replace the final block:

```ts
app.listen(process.env.PORT, () => {
  console.log(`app is listening at ${process.env.PORT}`)
})
```

with:

```ts
httpServer.listen(process.env.PORT, () => {
  console.log(`app is listening at ${process.env.PORT}`)
})
```

- [ ] **Step 4: Verify auth rejection and acceptance**

Start the dev server:

```bash
cd backend && npm run dev
```

In another terminal, verify a connection with no/invalid cookie is rejected:

```bash
npx --yes --package socket.io-client -c "node -e \"
const { io } = require('socket.io-client');
const socket = io('http://localhost:8080', { extraHeaders: { Cookie: 'accessToken=invalid' } });
socket.on('connect_error', (err) => { console.log('REJECTED as expected:', err.message); process.exit(0); });
socket.on('connect', () => { console.log('UNEXPECTED: connected'); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 5000);
\""
```

Expected: `REJECTED as expected: Unauthorized`.

Now log in with a real dev account to get a valid `accessToken` cookie value, then verify a valid connection succeeds:

```bash
curl -c /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_DEV_EMAIL","password":"YOUR_DEV_PASSWORD"}' | head -c 200
ACCESS_TOKEN=$(grep accessToken /tmp/cookies.txt | awk '{print $7}')
npx --yes --package socket.io-client -c "node -e \"
const { io } = require('socket.io-client');
const socket = io('http://localhost:8080', { extraHeaders: { Cookie: 'accessToken=$ACCESS_TOKEN' } });
socket.on('connect', () => { console.log('CONNECTED as expected'); process.exit(0); });
socket.on('connect_error', (err) => { console.log('UNEXPECTED rejection:', err.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 5000);
\""
```

Expected: `CONNECTED as expected`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/socket/index.ts backend/src/index.ts backend/package.json backend/package-lock.json
git commit -m "feat(chat): add Socket.IO server with cookie-based auth"
```

---

## Task 3: Channel CRUD — create, list, delete

**Files:**
- Create: `backend/src/repositories/channel.repository.ts`
- Create: `backend/src/validations/channel.validation.ts`
- Create: `backend/src/controllers/channel.controller.ts`
- Create: `backend/src/routes/channel.routes.ts`
- Modify: `backend/src/middlewares/auth.middleware.ts` (add `isChannelMember`, `isChannelOrgAdmin`)
- Modify: `backend/src/index.ts` (mount channel routes)

**Interfaces:**
- Consumes: `Channel`, `ChannelMember`, `Message`, `User` models (Task 1), `getIO` (Task 2), existing `organizationMemberRepository.findAllMembersInOrg` (`backend/src/repositories/organization.repository.ts`).
- Produces: `channelRepository` (`create`, `findById`, `findByOrgAndName`, `findVisibleToUser`, `delete`), `channelMemberRepository.addMembers` from `channel.repository.ts`; `createChannel`, `listChannels`, `deleteChannel` controllers; `isChannelMember`, `isChannelOrgAdmin` middleware. Later tasks (4, 5, 6) all extend `channel.repository.ts` and `channel.controller.ts`.

- [ ] **Step 1: Add channel-scoped auth middleware**

In `backend/src/middlewares/auth.middleware.ts`, after the `isOrganizationMember` function (the last function in the file), add:

```ts

export const isChannelOrgAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelId = req.params.channelId as string;
  if (!channelId) throw new ApiError(400, 'Channel ID is required');

  const { Channel, Organization, OrganizationMember } = await import('../models/index.js');

  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const org = await Organization.findByPk(channel.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (org.ownerId === user.id) {
    return next();
  }

  const member = await OrganizationMember.findOne({
    where: { organizationId: channel.organizationId, userId: user.id },
  });

  if (!member || member.role !== 'ORG_ADMIN') {
    throw new ApiError(403, 'Unauthorized request. Organization Admin role required.');
  }

  next();
};

export const isChannelMember = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelId = req.params.channelId as string;
  if (!channelId) throw new ApiError(400, 'Channel ID is required');

  const { Channel, ChannelMember } = await import('../models/index.js');

  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const membership = await ChannelMember.findOne({ where: { channelId, userId: user.id } });
  if (!membership) {
    throw new ApiError(403, 'Unauthorized request. Channel membership required.');
  }

  next();
};
```

- [ ] **Step 2: Write validation schemas**

Create `backend/src/validations/channel.validation.ts` (full set used across Tasks 3-5, defined once here):

```ts
import { z } from 'zod';

export const createChannelSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    name: z.string().min(1, 'Channel name is required').max(100, 'Name must be 100 characters or less'),
    type: z.enum(['PUBLIC', 'PRIVATE']),
  }),
};

export const organizationChannelsParamSchema = {
  params: z.object({
    organizationId: z.string().uuid('Invalid organization ID'),
  }),
};

export const channelParamSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
};

export const inviteChannelMemberSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
};

export const channelMemberParamSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
    userId: z.string().uuid('Invalid user ID'),
  }),
};

export const sendMessageSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
  body: z.object({
    content: z.string().min(1, 'Message content is required').max(4000, 'Message must be 4000 characters or less'),
  }),
};

export const listMessagesSchema = {
  params: z.object({
    channelId: z.string().uuid('Invalid channel ID'),
  }),
  query: z.object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
};
```

- [ ] **Step 3: Write the repository**

Create `backend/src/repositories/channel.repository.ts`:

```ts
import { Op } from 'sequelize';
import { Channel, ChannelMember, User } from '../models/index.js';
import type {
  ChannelCreationAttributes,
  ChannelInstance,
  ChannelMemberInstance,
} from '../types/channels.types.js';

export const channelRepository = {
  create: async (data: ChannelCreationAttributes): Promise<ChannelInstance> => {
    return await Channel.create(data);
  },

  findById: async (id: string): Promise<ChannelInstance | null> => {
    return await Channel.findByPk(id);
  },

  findByOrgAndName: async (organizationId: string, name: string): Promise<ChannelInstance | null> => {
    return await Channel.findOne({ where: { organizationId, name } });
  },

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

  delete: async (id: string): Promise<boolean> => {
    const channel = await Channel.findByPk(id);
    if (!channel) return false;
    await channel.destroy();
    return true;
  },
};

export const channelMemberRepository = {
  addMembers: async (channelId: string, userIds: string[]): Promise<void> => {
    if (userIds.length === 0) return;
    await ChannelMember.bulkCreate(
      userIds.map((userId) => ({ channelId, userId })),
      { ignoreDuplicates: true },
    );
  },

  findMember: async (channelId: string, userId: string): Promise<ChannelMemberInstance | null> => {
    return await ChannelMember.findOne({ where: { channelId, userId } });
  },

  findMembers: async (channelId: string): Promise<ChannelMemberInstance[]> => {
    return await ChannelMember.findAll({
      where: { channelId },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatarUrl'] }],
      order: [['joinedAt', 'ASC']],
    });
  },

  removeMember: async (channelId: string, userId: string): Promise<number> => {
    return await ChannelMember.destroy({ where: { channelId, userId } });
  },
};
```

- [ ] **Step 4: Write the controller**

Create `backend/src/controllers/channel.controller.ts`:

```ts
import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { channelRepository, channelMemberRepository } from '../repositories/channel.repository.js';
import { organizationMemberRepository } from '../repositories/organization.repository.js';
import { getIO } from '../socket/index.js';

export const createChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const { name, type } = req.body as { name: string; type: 'PUBLIC' | 'PRIVATE' };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const existing = await channelRepository.findByOrgAndName(organizationId, name.trim());
  if (existing) {
    throw new ApiError(409, 'A channel with this name already exists in this organization');
  }

  const channel = await channelRepository.create({
    organizationId,
    name: name.trim(),
    type,
    createdBy: user.id,
  });

  if (type === 'PUBLIC') {
    const orgMembers = await organizationMemberRepository.findAllMembersInOrg(organizationId);
    const memberIds = new Set(orgMembers.map((m) => m.userId));
    memberIds.add(user.id);
    await channelMemberRepository.addMembers(channel.id, [...memberIds]);
  } else {
    await channelMemberRepository.addMembers(channel.id, [user.id]);
  }

  getIO().to(`org:${organizationId}`).emit('channel:created', channel);

  return res.status(201).json({
    success: true,
    message: 'Channel created successfully',
    data: channel,
  });
});

export const listChannels = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channels = await channelRepository.findVisibleToUser(organizationId, user.id);
  return ok(res, channels, 'Channels retrieved successfully');
});

export const deleteChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  await channelRepository.delete(channelId);

  getIO().to(`org:${channel.organizationId}`).emit('channel:deleted', { id: channelId });

  return ok(res, null, 'Channel deleted successfully');
});
```

- [ ] **Step 5: Write the routes**

Create `backend/src/routes/channel.routes.ts`:

```ts
import { Router } from 'express';
import {
  verifyJWT,
  isOrganizationAdmin,
  isOrganizationMember,
  isChannelOrgAdmin,
} from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createChannel, listChannels, deleteChannel } from '../controllers/channel.controller.js';
import {
  createChannelSchema,
  organizationChannelsParamSchema,
  channelParamSchema,
} from '../validations/channel.validation.js';

const router = Router();

router
  .route('/organizations/:organizationId/channels')
  .post(verifyJWT, isOrganizationAdmin, validate(createChannelSchema), createChannel)
  .get(verifyJWT, isOrganizationMember, validate(organizationChannelsParamSchema), listChannels);

router
  .route('/channels/:channelId')
  .delete(verifyJWT, isChannelOrgAdmin, validate(channelParamSchema), deleteChannel);

export default router;
```

- [ ] **Step 6: Mount the routes**

In `backend/src/index.ts`, add the import next to the other route imports:

```ts
import channelRoutes from './routes/channel.routes.js';
```

And add the mount line next to the other `/api/v1` mounts:

```ts
app.use("/api/v1", channelRoutes);
```

- [ ] **Step 7: Verify with curl**

Start the dev server (`npm run dev`), log in, and exercise the endpoints (replace `YOUR_DEV_EMAIL`/`YOUR_DEV_PASSWORD`/`ORG_ID` with a real dev account and an org you administer):

```bash
curl -c /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"email":"YOUR_DEV_EMAIL","password":"YOUR_DEV_PASSWORD"}'

curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/organizations/ORG_ID/channels \
  -H "Content-Type: application/json" -d '{"name":"general","type":"PUBLIC"}'
```

Expected: `201` with `"data": { "id": "...", "name": "general", "type": "PUBLIC", ... }`. Copy the returned `id` as `CHANNEL_ID`.

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/organizations/ORG_ID/channels
```

Expected: array containing the `general` channel.

```bash
curl -b /tmp/cookies.txt -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/organizations/ORG_ID/channels \
  -H "Content-Type: application/json" -d '{"name":"general","type":"PUBLIC"}'
```

Expected: `409`.

```bash
curl -b /tmp/cookies.txt -s -X DELETE http://localhost:8080/api/v1/channels/CHANNEL_ID
```

Expected: `{"success":true,"message":"Channel deleted successfully",...}`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/repositories/channel.repository.ts backend/src/validations/channel.validation.ts \
  backend/src/controllers/channel.controller.ts backend/src/routes/channel.routes.ts \
  backend/src/middlewares/auth.middleware.ts backend/src/index.ts
git commit -m "feat(chat): add channel create/list/delete endpoints"
```

---

## Task 4: Channel membership — invite, leave, force-remove, list members

**Files:**
- Modify: `backend/src/repositories/channel.repository.ts` (add `messageRepository`, membership lookups)
- Modify: `backend/src/controllers/channel.controller.ts` (add invite/leave/remove/list-members)
- Modify: `backend/src/routes/channel.routes.ts` (add membership routes)

**Interfaces:**
- Consumes: `channelMemberRepository`, `channelRepository` (Task 3), `getIO` (Task 2), existing `userRepository`, `organizationRepository`, `organizationMemberRepository`.
- Produces: `messageRepository.create` (used again in Task 5); `removeMemberAndNotify` exported helper from `channel.controller.ts` (consumed by Task 6's org-removal cascade).

- [ ] **Step 1: Add `messageRepository` and a member-lookup helper to the repository**

In `backend/src/repositories/channel.repository.ts`, change the import line:

```ts
import { Channel, ChannelMember, User } from '../models/index.js';
```

to:

```ts
import { Channel, ChannelMember, Message, User } from '../models/index.js';
```

and change the type import:

```ts
import type {
  ChannelCreationAttributes,
  ChannelInstance,
  ChannelMemberInstance,
} from '../types/channels.types.js';
```

to:

```ts
import type {
  ChannelCreationAttributes,
  ChannelInstance,
  ChannelMemberInstance,
  MessageCreationAttributes,
  MessageInstance,
} from '../types/channels.types.js';
```

Then append this new export at the end of the file:

```ts

export const messageRepository = {
  create: async (data: MessageCreationAttributes): Promise<MessageInstance> => {
    return await Message.create(data);
  },
};
```

- [ ] **Step 2: Add membership controllers**

In `backend/src/controllers/channel.controller.ts`, change the import line:

```ts
import { channelRepository, channelMemberRepository } from '../repositories/channel.repository.js';
```

to:

```ts
import { channelRepository, channelMemberRepository, messageRepository } from '../repositories/channel.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { organizationRepository } from '../repositories/organization.repository.js';
```

Then append at the end of the file:

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

export const listChannelMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const members = await channelMemberRepository.findMembers(channelId);
  return ok(res, members, 'Channel members retrieved successfully');
});

export const inviteChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { userId } = req.body as { userId: string };

  const channel = await channelRepository.findById(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

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

export const leaveChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const membership = await channelMemberRepository.findMember(channelId, user.id);
  if (!membership) throw new ApiError(404, 'You are not a member of this channel');

  await removeMemberAndNotify(channelId, user.id, user.name, 'left');
  return ok(res, null, 'You have left the channel');
});

export const removeChannelMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const userId = req.params.userId as string;

  const membership = await channelMemberRepository.findMember(channelId, userId);
  if (!membership) throw new ApiError(404, 'Member not found in this channel');

  const targetUser = await userRepository.findById(userId);
  await removeMemberAndNotify(channelId, userId, targetUser?.name ?? 'A member', 'removed');
  return ok(res, null, 'Member removed successfully');
});
```

Note: `organizationMemberRepository.findOne` is already exported from `backend/src/repositories/organization.repository.ts` — no changes needed there.

- [ ] **Step 3: Add routes**

In `backend/src/routes/channel.routes.ts`, update the imports:

```ts
import {
  verifyJWT,
  isOrganizationAdmin,
  isOrganizationMember,
  isChannelOrgAdmin,
  isChannelMember,
} from '../middlewares/auth.middleware.js';
```

```ts
import {
  createChannel,
  listChannels,
  deleteChannel,
  listChannelMembers,
  inviteChannelMember,
  leaveChannel,
  removeChannelMember,
} from '../controllers/channel.controller.js';
```

```ts
import {
  createChannelSchema,
  organizationChannelsParamSchema,
  channelParamSchema,
  inviteChannelMemberSchema,
  channelMemberParamSchema,
} from '../validations/channel.validation.js';
```

Then add before `export default router;`:

```ts

router
  .route('/channels/:channelId/members')
  .get(verifyJWT, isChannelMember, validate(channelParamSchema), listChannelMembers)
  .post(verifyJWT, isChannelMember, validate(inviteChannelMemberSchema), inviteChannelMember);

router
  .route('/channels/:channelId/members/me')
  .delete(verifyJWT, isChannelMember, validate(channelParamSchema), leaveChannel);

router
  .route('/channels/:channelId/members/:userId')
  .delete(verifyJWT, isChannelOrgAdmin, validate(channelMemberParamSchema), removeChannelMember);
```

- [ ] **Step 4: Verify with curl**

Using the same dev server and `ORG_ID` from Task 3 (create a fresh channel since the previous one was deleted), and a second dev user account's `userId` (`USER_B_ID`) who is already a member of that org:

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/organizations/ORG_ID/channels \
  -H "Content-Type: application/json" -d '{"name":"team-private","type":"PRIVATE"}'
```

Copy the returned `id` as `CHANNEL_ID`.

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/members \
  -H "Content-Type: application/json" -d "{\"userId\":\"USER_B_ID\"}"

curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/members
```

Expected: the members list now includes both the admin and `USER_B_ID`.

```bash
curl -b /tmp/cookies.txt -s -X DELETE http://localhost:8080/api/v1/channels/CHANNEL_ID/members/USER_B_ID

curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/members
```

Expected: `USER_B_ID` no longer listed.

```bash
curl -b /tmp/cookies.txt -s -X DELETE http://localhost:8080/api/v1/channels/CHANNEL_ID/members/me
```

Expected: `{"success":true,"message":"You have left the channel",...}`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/channel.repository.ts backend/src/controllers/channel.controller.ts \
  backend/src/routes/channel.routes.ts
git commit -m "feat(chat): add channel membership invite/leave/remove endpoints"
```

---

## Task 5: Messages — send and list (paginated)

**Files:**
- Modify: `backend/src/repositories/channel.repository.ts` (add `messageRepository.findById`, `findByChannel`)
- Modify: `backend/src/controllers/channel.controller.ts` (add `sendMessage`, `listMessages`)
- Modify: `backend/src/routes/channel.routes.ts` (add message routes)

**Interfaces:**
- Consumes: `messageRepository` (Task 4), `getIO` (Task 2).
- Produces: `sendMessage`, `listMessages` controllers, consumed by the frontend service layer in Task 7.

- [ ] **Step 1: Extend the message repository**

In `backend/src/repositories/channel.repository.ts`, replace:

```ts
export const messageRepository = {
  create: async (data: MessageCreationAttributes): Promise<MessageInstance> => {
    return await Message.create(data);
  },
};
```

with:

```ts
export const messageRepository = {
  create: async (data: MessageCreationAttributes): Promise<MessageInstance> => {
    return await Message.create(data);
  },

  findById: async (id: string): Promise<MessageInstance | null> => {
    return await Message.findByPk(id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] }],
    });
  },

  findByChannel: async (
    channelId: string,
    options: { before?: string; limit: number },
  ): Promise<MessageInstance[]> => {
    const where: Record<string, unknown> = { channelId };
    if (options.before) {
      where.createdAt = { [Op.lt]: options.before };
    }
    const messages = await Message.findAll({
      where,
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'avatarUrl'] }],
      order: [['createdAt', 'DESC']],
      limit: options.limit,
    });
    return messages.reverse();
  },
};
```

- [ ] **Step 2: Add message controllers**

In `backend/src/controllers/channel.controller.ts`, append at the end of the file:

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

export const listMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { before, limit } = req.query as { before?: string; limit?: string };

  const messages = await messageRepository.findByChannel(channelId, {
    before,
    limit: limit ? Number(limit) : 50,
  });

  return ok(res, messages, 'Messages retrieved successfully');
});
```

- [ ] **Step 3: Add routes**

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

Then add before `export default router;`:

```ts

router
  .route('/channels/:channelId/messages')
  .get(verifyJWT, isChannelMember, validate(listMessagesSchema), listMessages)
  .post(verifyJWT, isChannelMember, validate(sendMessageSchema), sendMessage);
```

- [ ] **Step 4: Verify with curl**

Using `CHANNEL_ID` from Task 4 (re-invite yourself if you left it, or create a fresh channel):

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages \
  -H "Content-Type: application/json" -d '{"content":"hello world"}'
```

Expected: `201` with `"data": { "id": "...", "content": "hello world", "type": "TEXT", "sender": { "name": "...", ... } }`.

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/messages
```

Expected: array containing the message just sent, oldest first.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/channel.repository.ts backend/src/controllers/channel.controller.ts \
  backend/src/routes/channel.routes.ts
git commit -m "feat(chat): add send/list message endpoints"
```

---

## Task 6: Org-removal cascade and auto-join integration

**Files:**
- Modify: `backend/src/repositories/channel.repository.ts` (add cascade/auto-join queries)
- Modify: `backend/src/controllers/channel.controller.ts` (add cascade/auto-join helpers)
- Modify: `backend/src/controllers/organization.controller.ts` (call the helpers)

**Interfaces:**
- Consumes: `removeMemberAndNotify` (Task 4), `getIO` (Task 2).
- Produces: `cascadeRemoveUserFromOrgChannels`, `autoJoinUserToPublicChannels` exported from `channel.controller.ts`, called from `organization.controller.ts`.

- [ ] **Step 1: Add repository queries**

In `backend/src/repositories/channel.repository.ts`, append at the end of `channelMemberRepository` (after `removeMember: ...,` add a comma and these two entries — i.e. replace the closing `};` of `channelMemberRepository` with the new entries plus the closing brace):

```ts
  removeMember: async (channelId: string, userId: string): Promise<number> => {
    return await ChannelMember.destroy({ where: { channelId, userId } });
  },

  findChannelIdsForUserInOrg: async (organizationId: string, userId: string): Promise<string[]> => {
    const channels = await Channel.findAll({ where: { organizationId }, attributes: ['id'] });
    const orgChannelIds = channels.map((c) => c.id);
    if (orgChannelIds.length === 0) return [];
    const memberships = await ChannelMember.findAll({
      where: { userId, channelId: { [Op.in]: orgChannelIds } },
      attributes: ['channelId'],
    });
    return memberships.map((m) => m.channelId);
  },

  addUserToAllPublicChannels: async (organizationId: string, userId: string): Promise<string[]> => {
    const publicChannels = await Channel.findAll({
      where: { organizationId, type: 'PUBLIC' },
      attributes: ['id'],
    });
    if (publicChannels.length === 0) return [];
    await ChannelMember.bulkCreate(
      publicChannels.map((c) => ({ channelId: c.id, userId })),
      { ignoreDuplicates: true },
    );
    return publicChannels.map((c) => c.id);
  },
};
```

(This replaces the previous single-entry closing of `channelMemberRepository` — the file should end up with exactly one closing `};` for that object.)

- [ ] **Step 2: Add controller helpers**

In `backend/src/controllers/channel.controller.ts`, append at the end of the file:

```ts

export async function cascadeRemoveUserFromOrgChannels(
  organizationId: string,
  userId: string,
  actorName: string,
): Promise<void> {
  const channelIds = await channelMemberRepository.findChannelIdsForUserInOrg(organizationId, userId);
  for (const channelId of channelIds) {
    await removeMemberAndNotify(channelId, userId, actorName, 'removed');
  }
}

export async function autoJoinUserToPublicChannels(
  organizationId: string,
  userId: string,
): Promise<void> {
  const channelIds = await channelMemberRepository.addUserToAllPublicChannels(organizationId, userId);
  const io = getIO();
  channelIds.forEach((channelId) => {
    io.in(`user:${userId}`).socketsJoin(`channel:${channelId}`);
  });
}
```

- [ ] **Step 3: Wire into `organization.controller.ts`**

Add this import near the top of `backend/src/controllers/organization.controller.ts`, alongside the other imports:

```ts
import { cascadeRemoveUserFromOrgChannels, autoJoinUserToPublicChannels } from './channel.controller.js';
```

In `removeOrganizationMember`, change:

```ts
    const memberUser = await userRepository.findById(userId);
    await member.destroy();

    notifyAdminsOfMemberLeave(
```

to:

```ts
    const memberUser = await userRepository.findById(userId);
    await member.destroy();
    await cascadeRemoveUserFromOrgChannels(organizationId, userId, memberUser?.name ?? 'A member');

    notifyAdminsOfMemberLeave(
```

In `leaveOrganization`, change:

```ts
    const member = await organizationMemberRepository.findOne({ organizationId, userId: user.id });
    if (!member) throw new ApiError(404, 'You are not a member of this organization');

    await member.destroy();

    notifyAdminsOfMemberLeave(
```

to:

```ts
    const member = await organizationMemberRepository.findOne({ organizationId, userId: user.id });
    if (!member) throw new ApiError(404, 'You are not a member of this organization');

    await member.destroy();
    await cascadeRemoveUserFromOrgChannels(organizationId, user.id, user.name);

    notifyAdminsOfMemberLeave(
```

In `acceptOrganizationInvitation`, change:

```ts
    // Add user as member
    const [member] = await organizationMemberRepository.findOrCreate(
      invite.organizationId,
      user.id,
      { role: 'MEMBER' }
    );

    // Mark invite as accepted
```

to:

```ts
    // Add user as member
    const [member] = await organizationMemberRepository.findOrCreate(
      invite.organizationId,
      user.id,
      { role: 'MEMBER' }
    );
    await autoJoinUserToPublicChannels(invite.organizationId, user.id);

    // Mark invite as accepted
```

- [ ] **Step 4: Verify with curl**

Create a fresh PRIVATE channel, invite a second dev user (`USER_B_ID`, `USER_B_EMAIL`) into it, then remove that user from the *organization* (not the channel) and confirm the cascade:

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/organizations/ORG_ID/channels \
  -H "Content-Type: application/json" -d '{"name":"cascade-test","type":"PRIVATE"}'
# copy returned id as CHANNEL_ID

curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/members \
  -H "Content-Type: application/json" -d "{\"userId\":\"USER_B_ID\"}"

curl -b /tmp/cookies.txt -s -X DELETE http://localhost:8080/api/v1/organizations/ORG_ID/members/USER_B_ID

curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/members
```

Expected: `USER_B_ID` no longer in the channel member list.

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/messages
```

Expected: a `SYSTEM` message with content `"<USER_B name> was removed from the channel"`.

Now verify auto-join: with an existing `PUBLIC` channel in `ORG_ID` (e.g. `general` from Task 3 — recreate it if it was deleted during testing), invite `USER_B_EMAIL` back into the organization via the existing invite flow, accept it as `USER_B`, then confirm `USER_B` is already a member of that public channel:

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/organizations/ORG_ID/invites \
  -H "Content-Type: application/json" -d '{"email":"USER_B_EMAIL"}'
# Log in as USER_B, accept using the returned inviteLink's token (dev mode returns it in the response), then:

curl -b /tmp/user_b_cookies.txt -s http://localhost:8080/api/v1/organizations/ORG_ID/channels
```

Expected: `USER_B`'s channel list already includes the `general` `PUBLIC` channel without ever explicitly joining it.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/channel.repository.ts backend/src/controllers/channel.controller.ts \
  backend/src/controllers/organization.controller.ts
git commit -m "feat(chat): cascade org removal to channels, auto-join public channels on org join"
```

---

## Task 7: Frontend plumbing — types, service, hooks, socket client

**Files:**
- Create: `frontend/src/types/channel.types.ts`
- Create: `frontend/src/services/channel.service.ts`
- Create: `frontend/src/hooks/useChannel.ts`
- Create: `frontend/src/lib/socket.ts`
- Modify: `frontend/package.json` (add `socket.io-client`)

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/axios.ts`).
- Produces: `Channel`, `ChannelMember`, `Message` types; `useChannels`, `useCreateChannel`, `useDeleteChannel`, `useChannelMembers`, `useInviteChannelMember`, `useLeaveChannel`, `useRemoveChannelMember`, `useChannelMessages`, `useSendMessage` hooks; `getMessages`/`sendMessage` service functions; `getSocket`/`connectSocket`/`disconnectSocket` from `lib/socket.ts`. Consumed by Tasks 8-11.

- [ ] **Step 1: Install socket.io-client**

```bash
cd frontend && npm install socket.io-client
```

- [ ] **Step 2: Write types**

Create `frontend/src/types/channel.types.ts`:

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

export interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  joinedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

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

export interface ChannelsResponse {
  success: boolean;
  message: string;
  data: Channel[];
}

export interface ChannelResponse {
  success: boolean;
  message: string;
  data: Channel;
}

export interface ChannelMembersResponse {
  success: boolean;
  message: string;
  data: ChannelMember[];
}

export interface MessagesResponse {
  success: boolean;
  message: string;
  data: Message[];
}
```

- [ ] **Step 3: Write the service**

Create `frontend/src/services/channel.service.ts`:

```ts
import { api } from '@/lib/axios';
import type {
  Channel,
  ChannelMember,
  ChannelsResponse,
  ChannelResponse,
  ChannelMembersResponse,
  Message,
  MessagesResponse,
} from '@/types/channel.types';

export async function getChannels(organizationId: string): Promise<Channel[]> {
  const res = await api.get<ChannelsResponse>(`/organizations/${organizationId}/channels`);
  return res.data.data;
}

export async function createChannel(
  organizationId: string,
  data: { name: string; type: 'PUBLIC' | 'PRIVATE' },
): Promise<Channel> {
  const res = await api.post<ChannelResponse>(`/organizations/${organizationId}/channels`, data);
  return res.data.data;
}

export async function deleteChannel(channelId: string): Promise<void> {
  await api.delete(`/channels/${channelId}`);
}

export async function getChannelMembers(channelId: string): Promise<ChannelMember[]> {
  const res = await api.get<ChannelMembersResponse>(`/channels/${channelId}/members`);
  return res.data.data;
}

export async function inviteChannelMember(channelId: string, userId: string): Promise<void> {
  await api.post(`/channels/${channelId}/members`, { userId });
}

export async function leaveChannel(channelId: string): Promise<void> {
  await api.delete(`/channels/${channelId}/members/me`);
}

export async function removeChannelMember(channelId: string, userId: string): Promise<void> {
  await api.delete(`/channels/${channelId}/members/${userId}`);
}

export async function getMessages(channelId: string, before?: string): Promise<Message[]> {
  const res = await api.get<MessagesResponse>(`/channels/${channelId}/messages`, {
    params: before ? { before } : undefined,
  });
  return res.data.data;
}

export async function sendMessage(channelId: string, content: string): Promise<Message> {
  const res = await api.post<{ success: boolean; message: string; data: Message }>(
    `/channels/${channelId}/messages`,
    { content },
  );
  return res.data.data;
}
```

- [ ] **Step 4: Write the hooks**

Create `frontend/src/hooks/useChannel.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export const useChannels = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'channels'],
    queryFn: () => getChannels(organizationId),
    enabled: !!organizationId,
  });

export const useCreateChannel = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: 'PUBLIC' | 'PRIVATE' }) => createChannel(organizationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] }),
  });
};

export const useDeleteChannel = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => deleteChannel(channelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] }),
  });
};

export const useChannelMembers = (channelId: string) =>
  useQuery({
    queryKey: ['channels', channelId, 'members'],
    queryFn: () => getChannelMembers(channelId),
    enabled: !!channelId,
  });

export const useInviteChannelMember = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => inviteChannelMember(channelId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] }),
  });
};

export const useLeaveChannel = (organizationId: string, channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => leaveChannel(channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] });
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    },
  });
};

export const useRemoveChannelMember = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeChannelMember(channelId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] }),
  });
};

export const useChannelMessages = (channelId: string) =>
  useQuery({
    queryKey: ['channels', channelId, 'messages'],
    queryFn: () => getMessages(channelId),
    enabled: !!channelId,
  });

export const useSendMessage = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => sendMessage(channelId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] }),
  });
};
```

- [ ] **Step 5: Write the socket client singleton**

Create `frontend/src/lib/socket.ts`:

```ts
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1').replace(/\/api\/v1\/?$/, '');

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) socket.disconnect();
}
```

- [ ] **Step 6: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors (these files aren't imported anywhere yet, but must still type-check standalone).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/channel.types.ts frontend/src/services/channel.service.ts \
  frontend/src/hooks/useChannel.ts frontend/src/lib/socket.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(chat): add frontend types/service/hooks/socket client plumbing"
```

---

## Task 8: Chat page shell — nav item, channel sidebar, create-channel modal

**Files:**
- Create: `frontend/src/app/(dashboard)/org/[slug]/chat/page.tsx`
- Create: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`
- Create: `frontend/src/app/(dashboard)/org/[slug]/chat/loading.tsx`
- Create: `frontend/src/app/(dashboard)/org/[slug]/chat/error.tsx`
- Create: `frontend/src/components/shared/skeletons/ChatSkeleton.tsx`
- Modify: `frontend/src/components/layout/DashboardLayout.tsx` (add "Chat" nav item)

**Interfaces:**
- Consumes: `useChannels`, `useCreateChannel` (Task 7); existing `useOrganizationBySlug`, `useOrganizationMembers` (`useOrganization.ts`); existing `Button`, `Input`, `ErrorState` components.
- Produces: `ChatPage` component with `selectedChannel` state, extended in Tasks 9-11.

- [ ] **Step 1: Add the skeleton**

Create `frontend/src/components/shared/skeletons/ChatSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function ChatSkeleton() {
  return (
    <div className="flex h-full gap-4">
      <div className="w-64 shrink-0 space-y-2 rounded-xl border border-border-subtle bg-white p-3">
        <Skeleton className="h-4 w-20 mb-2" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
      <div className="flex-1 rounded-xl border border-border-subtle bg-white p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-2/3 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `loading.tsx` and `error.tsx`**

Create `frontend/src/app/(dashboard)/org/[slug]/chat/loading.tsx`:

```tsx
import { ChatSkeleton } from '@/components/shared/skeletons/ChatSkeleton';

export default function ChatLoading() {
  return <ChatSkeleton />;
}
```

Create `frontend/src/app/(dashboard)/org/[slug]/chat/error.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ChatError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle className="text-danger" size={22} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-text-primary">Failed to load chat</h2>
        <p className="mt-1 max-w-xs text-sm text-text-secondary">
          {error.message || 'Could not load chat data. Check your connection and try again.'}
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Write `ChatPage.tsx`**

Create `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`:

```tsx
'use client';

import { use, useState } from 'react';
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

interface Props {
  params: Promise<{ slug: string }>;
}

function CreateChannelModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (name: string, type: 'PUBLIC' | 'PRIVATE') => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-gray-800">New Channel</h2>
        <p className="mt-0.5 text-xs text-gray-400">Create a channel for your organization to chat in.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim(), type); }}
          className="mt-5 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600" htmlFor="new-channel-name">
              Channel name
            </label>
            <Input
              id="new-channel-name"
              placeholder="e.g. general"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-gray-600">Visibility</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('PUBLIC')}
                className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  type === 'PUBLIC' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium"><Hash size={13} /> Public</span>
                <span className="text-xs text-gray-400">All org members auto-join</span>
              </button>
              <button
                type="button"
                onClick={() => setType('PRIVATE')}
                className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  type === 'PRIVATE' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium"><Lock size={13} /> Private</span>
                <span className="text-xs text-gray-400">Invite-only</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? <><Loader2 size={14} className="animate-spin mr-1.5" />Creating…</> : 'Create Channel'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ChatPage({ params }: Props) {
  const { slug } = use(params);
  const { user } = useAuthStore();

  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const createChannel = useCreateChannel(org?.id ?? '');

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (orgLoading || channelsLoading) return <ChatSkeleton />;
  if (orgError || !org) {
    return (
      <ErrorState title="Failed to load chat" message="Could not load workspace data." onRetry={() => refetch()} />
    );
  }

  const currentMembership = orgMembers?.find((m) => m.userId === user?.id);
  const isAdmin = org.ownerId === user?.id || currentMembership?.role === 'ORG_ADMIN';

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

  return (
    <div className="flex h-full gap-4">
      <aside className="flex w-64 shrink-0 flex-col rounded-xl border border-border-subtle bg-white">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Channels</span>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
              title="New channel"
            >
              <Plus size={15} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
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
      </aside>

      <div className="flex-1 rounded-xl border border-border-subtle bg-white">
        {selectedChannel ? (
          <div className="flex h-full flex-col items-center justify-center text-text-secondary">
            <p className="text-sm">Channel: {selectedChannel.name}</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-text-secondary">
            <MessageSquare size={28} className="text-gray-300" />
            <p className="text-sm">Select a channel to start chatting</p>
          </div>
        )}
      </div>

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

- [ ] **Step 4: Write `page.tsx`**

Create `frontend/src/app/(dashboard)/org/[slug]/chat/page.tsx`:

```tsx
import ChatPage from './_components/ChatPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function Page({ params }: Props) {
  return <ChatPage params={params} />;
}
```

- [ ] **Step 5: Add the nav item**

In `frontend/src/components/layout/DashboardLayout.tsx`, add `MessageSquare` to the lucide-react import:

```ts
import {
  CalendarDays,
  ChevronDown,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  Users,
  X,
} from 'lucide-react';
```

Then in the `navItems` array, change:

```ts
    {
      name: 'Calendar',
      href: currentSlug ? `/org/${currentSlug}/calendar` : '#',
      icon: CalendarDays,
      disabled: !currentSlug,
    },
    ...(activeOrg?.ownerId === user?.id
```

to:

```ts
    {
      name: 'Calendar',
      href: currentSlug ? `/org/${currentSlug}/calendar` : '#',
      icon: CalendarDays,
      disabled: !currentSlug,
    },
    {
      name: 'Chat',
      href: currentSlug ? `/org/${currentSlug}/chat` : '#',
      icon: MessageSquare,
      disabled: !currentSlug,
    },
    ...(activeOrg?.ownerId === user?.id
```

- [ ] **Step 6: Verify in the browser**

Start both dev servers (`cd backend && npm run dev`, `cd frontend && npm run dev`), log in, and navigate to `/org/<your-slug>/chat`.

Expected: a "Chat" link appears in the sidebar nav; the chat page shows the channel sidebar with any channels created via curl earlier (e.g. `general`); as an org admin, clicking "+" opens the create-channel modal; creating a new channel (e.g. `team-private` as Private) adds it to the sidebar and selects it, showing "Channel: team-private" in the main pane.

- [ ] **Step 7: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/chat" frontend/src/components/shared/skeletons/ChatSkeleton.tsx \
  frontend/src/components/layout/DashboardLayout.tsx
git commit -m "feat(chat): add chat page shell with channel list and create-channel modal"
```

---

## Task 9: Channel header — members, invite, leave, admin delete

**Files:**
- Create: `frontend/src/components/shared/ManageChannelMembersModal.tsx`
- Create: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`

**Interfaces:**
- Consumes: `useChannelMembers`, `useInviteChannelMember`, `useRemoveChannelMember`, `useLeaveChannel`, `useDeleteChannel` (Task 7); existing `useOrganizationMembers`; existing `ConfirmationDialog`.
- Produces: `ChannelView` component (extended in Task 10 with the message pane), consumed by `ChatPage.tsx`.

- [ ] **Step 1: Write the members modal**

Create `frontend/src/components/shared/ManageChannelMembersModal.tsx`:

```tsx
'use client';

import { toast } from 'sonner';
import { Loader2, UserPlus, X } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import {
  useChannelMembers,
  useInviteChannelMember,
  useRemoveChannelMember,
} from '@/hooks/useChannel';
import { useOrganizationMembers } from '@/hooks/useOrganization';

interface Props {
  channelId: string;
  organizationId: string;
  isOpen: boolean;
  isAdmin: boolean;
  onClose: () => void;
}

export default function ManageChannelMembersModal({
  channelId,
  organizationId,
  isOpen,
  isAdmin,
  onClose,
}: Props) {
  const { data: channelMembers, isLoading: channelMembersLoading } = useChannelMembers(channelId);
  const { data: orgMembers, isLoading: orgMembersLoading } = useOrganizationMembers(organizationId);

  const inviteMember = useInviteChannelMember(channelId);
  const removeMember = useRemoveChannelMember(channelId);

  if (!isOpen) return null;

  const channelMemberUserIds = new Set(channelMembers?.map((m) => m.userId) ?? []);
  const invitableMembers = orgMembers?.filter((m) => !channelMemberUserIds.has(m.userId)) ?? [];

  const handleInvite = (userId: string, name: string) => {
    inviteMember.mutate(userId, {
      onSuccess: () => toast.success(`${name} added to channel`),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleRemove = (userId: string, name: string) => {
    removeMember.mutate(userId, {
      onSuccess: () => toast.success(`${name} removed from channel`),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const isLoading = channelMembersLoading || orgMembersLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-white shadow-modal">
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Manage Channel Members</h2>
            <p className="mt-0.5 text-xs text-text-secondary">Add or remove members from this channel.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : (
          <div className="divide-y divide-border-subtle max-h-[70vh] overflow-y-auto">
            <div className="px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Current Members ({channelMembers?.length ?? 0})
              </h3>
              {channelMembers && channelMembers.length > 0 ? (
                <ul className="space-y-2">
                  {channelMembers.map((member) => {
                    const name = member.user?.name ?? 'Unknown User';
                    const email = member.user?.email ?? '';
                    return (
                      <li key={member.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/5 text-sm font-semibold text-primary">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary leading-none">{name}</p>
                            <p className="mt-0.5 text-xs text-text-secondary">{email}</p>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemove(member.userId, name)}
                            disabled={removeMember.isPending}
                            className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                            title="Remove from channel"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">No members yet.</p>
              )}
            </div>

            <div className="px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Invite Members ({invitableMembers.length} available)
              </h3>
              {invitableMembers.length > 0 ? (
                <ul className="space-y-2">
                  {invitableMembers.map((orgMember) => {
                    const name = orgMember.user?.name ?? 'Unknown User';
                    const email = orgMember.user?.email ?? '';
                    return (
                      <li key={orgMember.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-text-secondary">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary leading-none">{name}</p>
                            <p className="mt-0.5 text-xs text-text-secondary">{email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleInvite(orgMember.userId, name)}
                          disabled={inviteMember.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
                        >
                          <UserPlus size={12} />
                          Invite
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">All organization members are already in this channel.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `ChannelView.tsx`**

Create `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Hash, Lock, LogOut, Trash2, Users } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import { useChannelMembers, useLeaveChannel, useDeleteChannel } from '@/hooks/useChannel';
import ManageChannelMembersModal from '@/components/shared/ManageChannelMembersModal';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { Channel } from '@/types/channel.types';

interface Props {
  channel: Channel;
  organizationId: string;
  isAdmin: boolean;
  onLeftOrDeleted: () => void;
}

export default function ChannelView({ channel, organizationId, isAdmin, onLeftOrDeleted }: Props) {
  const { data: members } = useChannelMembers(channel.id);
  const leaveChannel = useLeaveChannel(organizationId, channel.id);
  const deleteChannel = useDeleteChannel(organizationId);

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          {channel.type === 'PUBLIC' ? <Hash size={15} className="text-text-secondary" /> : <Lock size={15} className="text-text-secondary" />}
          <h2 className="text-sm font-semibold text-text-primary">{channel.name}</h2>
          <span className="text-xs text-text-secondary">{members?.length ?? 0} members</span>
        </div>
        <div className="flex items-center gap-1">
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
      </div>

      <div className="flex-1 overflow-hidden">
        <p className="flex h-full items-center justify-center text-sm text-text-secondary">Channel: {channel.name}</p>
      </div>

      {showMembersModal && (
        <ManageChannelMembersModal
          channelId={channel.id}
          organizationId={organizationId}
          isOpen
          isAdmin={isAdmin}
          onClose={() => setShowMembersModal(false)}
        />
      )}

      <ConfirmationDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => leaveChannel.mutate(undefined, {
          onSuccess: () => { toast.success(`Left #${channel.name}`); setShowLeaveConfirm(false); onLeftOrDeleted(); },
          onError: (err) => toast.error(parseApiError(err).message),
        })}
        title="Leave Channel"
        description={`Leave #${channel.name}? You can be invited back later.`}
        confirmText="Leave"
        isDestructive
        isLoading={leaveChannel.isPending}
      />
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteChannel.mutate(channel.id, {
          onSuccess: () => { toast.success(`#${channel.name} deleted`); setShowDeleteConfirm(false); onLeftOrDeleted(); },
          onError: (err) => toast.error(parseApiError(err).message),
        })}
        title="Delete Channel"
        description={`Permanently delete #${channel.name}? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
        isLoading={deleteChannel.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire `ChannelView` into `ChatPage.tsx`**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`, add the import:

```tsx
import ChannelView from './ChannelView';
```

Then replace:

```tsx
      <div className="flex-1 rounded-xl border border-border-subtle bg-white">
        {selectedChannel ? (
          <div className="flex h-full flex-col items-center justify-center text-text-secondary">
            <p className="text-sm">Channel: {selectedChannel.name}</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-text-secondary">
            <MessageSquare size={28} className="text-gray-300" />
            <p className="text-sm">Select a channel to start chatting</p>
          </div>
        )}
      </div>
```

with:

```tsx
      <div className="flex-1 rounded-xl border border-border-subtle bg-white overflow-hidden">
        {selectedChannel ? (
          <ChannelView
            channel={selectedChannel}
            organizationId={org.id}
            isAdmin={isAdmin}
            onLeftOrDeleted={() => setSelectedChannel(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-text-secondary">
            <MessageSquare size={28} className="text-gray-300" />
            <p className="text-sm">Select a channel to start chatting</p>
          </div>
        )}
      </div>
```

- [ ] **Step 4: Verify in the browser**

Select a channel — expect a header with the channel name, member count, "Members", "Leave", and (if admin) "Delete" buttons. Click "Members": expect a modal listing current members with remove buttons (visible only as admin) and invitable org members with "Invite" buttons. Invite a second dev user, confirm they appear in "Current Members" and the count updates. Click "Leave" on a channel you're not the last member of, confirm it disappears from the sidebar and the main pane resets to the empty state. As admin, click "Delete" on a channel, confirm it's removed from the sidebar.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/shared/ManageChannelMembersModal.tsx \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx"
git commit -m "feat(chat): add channel member management, leave, and delete"
```

---

## Task 10: Message pane — list, paginate, send, system messages

**Files:**
- Create: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`

**Interfaces:**
- Consumes: `useChannelMessages`, `useSendMessage` (Task 7), `getMessages` service function (Task 7).
- Produces: `MessagePane` component, consumed by `ChannelView.tsx`. Extended in Task 11 with live socket updates (already compatible since it just reads the `['channels', channelId, 'messages']` query).

- [ ] **Step 1: Write `MessagePane.tsx`**

Create `frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx`:

```tsx
'use client';

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

export default function MessagePane({ channel }: Props) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: messages, isLoading } = useChannelMessages(channel.id);
  const sendMessage = useSendMessage(channel.id);
  const [content, setContent] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed, {
      onSuccess: () => setContent(''),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

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
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages && messages.length > 0 && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="mx-auto block text-xs text-primary hover:underline disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
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
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-subtle p-3">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Message #${channel.name}`}
          disabled={sendMessage.isPending}
          className="flex-1 rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none disabled:opacity-50"
        />
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

- [ ] **Step 2: Wire `MessagePane` into `ChannelView.tsx`**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`, add the import:

```tsx
import MessagePane from './MessagePane';
```

Then replace:

```tsx
      <div className="flex-1 overflow-hidden">
        <p className="flex h-full items-center justify-center text-sm text-text-secondary">Channel: {channel.name}</p>
      </div>
```

with:

```tsx
      <div className="flex-1 overflow-hidden">
        <MessagePane channel={channel} />
      </div>
```

- [ ] **Step 3: Verify in the browser**

Select a channel, type a message, press send (or Enter) — expect it to appear immediately in the pane with your name and timestamp. Have a system message present (e.g. from an earlier invite) — expect it centered and italicized, distinct from regular messages. Send more than one message, refresh the page, confirm history persists in order. Click "Load earlier messages" (send >1 message across two calls if needed to test) — expect no errors and no duplicate messages.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx"
git commit -m "feat(chat): add message pane with send, history, and pagination"
```

---

## Task 11: Live socket wiring — connect lifecycle, cache updates, reconnect indicator

**Files:**
- Create: `frontend/src/hooks/useChatSocket.ts`
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `connectSocket`, `disconnectSocket` (Task 7); query keys used throughout Tasks 7-10.
- Produces: fully live chat — this is the last task in the phase.

- [ ] **Step 1: Write `useChatSocket`**

Create `frontend/src/hooks/useChatSocket.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { Channel, Message } from '@/types/channel.types';

export function useChatSocket(organizationId: string | undefined) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    const socket = connectSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onChannelCreated = (channel: Channel) => {
      if (channel.organizationId !== organizationId) return;
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] });
    };

    const onChannelDeleted = ({ id }: { id: string }) => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'channels'] });
      qc.removeQueries({ queryKey: ['channels', id] });
    };

    const onMemberJoined = ({ channelId }: { channelId: string }) => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    };

    const onMemberLeft = ({ channelId }: { channelId: string }) => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
    };

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
  }, [organizationId, qc]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  return { connected };
}
```

- [ ] **Step 2: Clear a selected channel that gets deleted remotely**

`useChatSocket`'s `onChannelDeleted` handler removes the channel from the query cache, but `ChatPage.tsx` holds `selectedChannel` in local `useState`, which won't auto-clear — a viewer looking at a channel someone else just deleted would be stuck on a dead view. Fix it by deriving validity from the refetched `channels` list.

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`, add `useEffect` to the React import:

```tsx
import { use, useEffect, useState } from 'react';
```

Then, right after the line `const [showCreateModal, setShowCreateModal] = useState(false);`, add:

```tsx
  useEffect(() => {
    if (selectedChannel && channels && !channels.some((c) => c.id === selectedChannel.id)) {
      setSelectedChannel(null);
    }
  }, [channels, selectedChannel]);
```

- [ ] **Step 3: Wire into `DashboardLayout.tsx`**

Add the import alongside the other hook imports:

```ts
import { useChatSocket } from '@/hooks/useChatSocket';
```

Change:

```ts
  const activeOrg = orgs?.find((o) => o.slug === currentSlug) || null;
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(activeOrg?.id || '');
```

to:

```ts
  const activeOrg = orgs?.find((o) => o.slug === currentSlug) || null;
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(activeOrg?.id || '');
  const { connected: chatConnected } = useChatSocket(activeOrg?.id);
```

Then change the topbar's org-name block:

```tsx
            <div className="text-xs text-text-muted">
              {currentOrg ? (
                <span className="font-medium text-primary">{currentOrg.name}</span>
              ) : (
                'Dashboard'
              )}
            </div>
```

to:

```tsx
            <div className="flex items-center gap-2 text-xs text-text-muted">
              {currentOrg ? (
                <span className="font-medium text-primary">{currentOrg.name}</span>
              ) : (
                'Dashboard'
              )}
              {currentOrg && !chatConnected && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Reconnecting…
                </span>
              )}
            </div>
```

- [ ] **Step 4: Verify live updates in the browser**

Open two browser sessions (e.g. a normal window and an incognito window) logged in as two different members of the same org who are both members of the same channel.

In session A, send a message. Expected: it appears in session B's open channel within about a second, with no manual refresh.

In session A, open "Members" and remove the session-B user from the channel (as admin) or have session B leave. Expected: session B sees the channel disappear from their sidebar (if it was private) and, if session A still has that channel open, the member count updates and a "left"/"removed" system message appears live.

To verify the reconnect indicator: stop the backend dev server while the frontend is open on a page with `currentOrg` set. Expected: the "Reconnecting…" badge appears next to the org name in the topbar. Restart the backend. Expected: the badge disappears once Socket.IO reconnects (a page refresh may speed this up, but automatic reconnection should also work within its retry interval).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useChatSocket.ts frontend/src/components/layout/DashboardLayout.tsx \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx"
git commit -m "feat(chat): wire live socket updates and reconnect indicator"
```
