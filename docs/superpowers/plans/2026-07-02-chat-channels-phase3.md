# Chat Phase 3 (File Sharing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file attachments to channel messages (new `FILE` message type) plus a per-channel Files tab, per `docs/superpowers/specs/2026-07-02-chat-channels-phase3-design.md`. Reuses the existing task-attachment upload pipeline wholesale.

**Architecture:** A file share is just a `Message` row with `type: 'FILE'` and five extra nullable columns (`fileName`, `fileUrl`, `cloudinaryPublicId`, `fileType`, `fileSize`), so it rides the existing `message:new`/`message:deleted` socket events and the existing reaction/deletion endpoints unchanged (after loosening their `type` guards). Uploads reuse `uploadMiddleware` (multer, memory storage, 20MB/type allow-list) and `uploadToCloudinary`/`deleteFromCloudinary` from `cloudinary.service.ts` — the same functions already used by `task.controller.ts`'s attachment endpoints. No new table, no new socket events.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, multer, Cloudinary, Next.js 16 / React 19, TanStack Query, sonner.

## Global Constraints

- No test runner exists in this repo. Every task's deliverable is verified manually via `curl` (including `curl -F` for multipart upload) and/or the browser.
- Reuse `uploadMiddleware` and `uploadToCloudinary`/`deleteFromCloudinary` exactly as they already exist — do not create new upload/storage config.
- `FILE` messages are subject to the same reaction/deletion rules as `TEXT` messages (only `SYSTEM` messages are excluded).
- The Files tab is not live-updated via socket — it refetches on open, matching the design spec.
- All frontend error handling uses `parseApiError(err).message` with `sonner`'s `toast.error(...)`.

---

## Task 1: Data layer — `FILE` message type and attachment columns

**Files:**
- Create: `backend/src/sequelize/migrations/20260702050000-add-file-messages.js`
- Modify: `backend/src/models/messages.model.ts`
- Modify: `backend/src/types/channels.types.ts`

**Interfaces:**
- Consumes: `Message` model, `Messages`/`MessageWithReactions` types (Phase 1/2).
- Produces: `Messages.type` including `'FILE'`; `fileName`/`fileUrl`/`cloudinaryPublicId`/`fileType`/`fileSize` fields on `Messages`/`MessageCreationAttributes`/`MessageWithReactions`. Task 2 consumes all of these.

- [ ] **Step 1: Write the migration**

Create `backend/src/sequelize/migrations/20260702050000-add-file-messages.js`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_messages_type" ADD VALUE IF NOT EXISTS 'FILE'`);

    await queryInterface.addColumn('messages', 'fileName', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'fileUrl', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'cloudinaryPublicId', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'fileType', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('messages', 'fileSize', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('messages', 'fileSize');
    await queryInterface.removeColumn('messages', 'fileType');
    await queryInterface.removeColumn('messages', 'cloudinaryPublicId');
    await queryInterface.removeColumn('messages', 'fileUrl');
    await queryInterface.removeColumn('messages', 'fileName');

    // Convert any FILE-type rows back to TEXT before recreating the enum without FILE
    await queryInterface.sequelize.query(`UPDATE "messages" SET type = 'TEXT' WHERE type = 'FILE'`);

    await queryInterface.sequelize.query(`ALTER TABLE "messages" ALTER COLUMN type TYPE VARCHAR(255)`);
    await queryInterface.sequelize.query(`ALTER TABLE "messages" ALTER COLUMN type DROP DEFAULT`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_messages_type"`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_messages_type" AS ENUM ('TEXT', 'SYSTEM')`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "messages"
       ALTER COLUMN type TYPE "enum_messages_type" USING type::"enum_messages_type",
       ALTER COLUMN type SET DEFAULT 'TEXT'`
    );
  },
};
```

- [ ] **Step 2: Update the `Message` model**

In `backend/src/models/messages.model.ts`, replace:

```ts
    type: {
      type: DataTypes.ENUM('TEXT', 'SYSTEM'),
      allowNull: false,
      defaultValue: 'TEXT',
    },
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
```

with:

```ts
    type: {
      type: DataTypes.ENUM('TEXT', 'SYSTEM', 'FILE'),
      allowNull: false,
      defaultValue: 'TEXT',
    },
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
    fileName: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    fileUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cloudinaryPublicId: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    fileType: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
```

- [ ] **Step 3: Update the types file**

In `backend/src/types/channels.types.ts`, replace:

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
```

with:

```ts
export interface Messages {
  id: string;
  channelId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM' | 'FILE';
  content: string;
  createdAt?: Date;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  cloudinaryPublicId?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  sender?: UserInstance;
}

export type MessageCreationAttributes = Optional<
  Messages,
  | 'id'
  | 'senderId'
  | 'type'
  | 'createdAt'
  | 'deletedAt'
  | 'deletedBy'
  | 'fileName'
  | 'fileUrl'
  | 'cloudinaryPublicId'
  | 'fileType'
  | 'fileSize'
>;
```

Then replace:

```ts
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

with:

```ts
export interface MessageWithReactions {
  id: string;
  channelId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM' | 'FILE';
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  fileName: string | null;
  fileUrl: string | null;
  cloudinaryPublicId: string | null;
  fileType: string | null;
  fileSize: number | null;
  sender?: { id: string; name: string; avatarUrl: string | null } | null;
  reactions: ReactionSummary[];
}
```

- [ ] **Step 4: Run the migration and verify**

```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:status
```

Expected: `20260702050000-add-file-messages: migrated` printed, status shows it `up`.

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add backend/src/sequelize/migrations/20260702050000-add-file-messages.js \
  backend/src/models/messages.model.ts backend/src/types/channels.types.ts
git commit -m "feat(chat): add FILE message type and attachment columns"
```

---

## Task 2: Backend — file upload, list, download endpoints; extend reactions/deletion to FILE messages

**Files:**
- Modify: `backend/src/repositories/channel.repository.ts`
- Modify: `backend/src/controllers/channel.controller.ts`
- Modify: `backend/src/routes/channel.routes.ts`

**Interfaces:**
- Consumes: `uploadMiddleware` (`backend/src/middlewares/upload.middleware.ts`, existing), `uploadToCloudinary`/`deleteFromCloudinary` (`backend/src/services/cloudinary.service.ts`, existing), `messageRepository`/`MessageWithReactions` (Task 1), `channelParamSchema`/`messageParamSchema`/`listMessagesSchema` (already exist from Phase 1/2 — no new validation schemas needed).
- Produces: `messageRepository.findFilesByChannel`; `uploadFile`, `listFiles`, `downloadFile` controllers. No later task in this phase depends on this beyond the frontend consuming the routes.

- [ ] **Step 1: Add `findFilesByChannel` to the repository**

In `backend/src/repositories/channel.repository.ts`, append inside `messageRepository`, directly after the `delete` method (add a comma after its closing `},`):

```ts

  findFilesByChannel: async (
    channelId: string,
    options: { before?: string; limit: number },
  ): Promise<MessageWithReactions[]> => {
    const where: Record<string, unknown> = { channelId, type: 'FILE', deletedAt: null };
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
    return messages.map((m) => {
      const plain = m.get({ plain: true }) as MessageWithReactions & {
        reactions: { emoji: string; userId: string }[];
      };
      return { ...plain, reactions: groupReactions(plain.reactions) };
    });
  },
```

Note this deliberately does **not** reverse the array (unlike `findByChannel`) — the Files tab shows newest-first, not oldest-first like the message stream.

- [ ] **Step 2: Add file controllers and loosen the reaction/deletion type guards**

In `backend/src/controllers/channel.controller.ts`, change the import line:

```ts
import { channelRepository, channelMemberRepository, messageRepository, messageReactionRepository } from '../repositories/channel.repository.js';
```

to:

```ts
import { channelRepository, channelMemberRepository, messageRepository, messageReactionRepository } from '../repositories/channel.repository.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary.service.js';

function cloudinaryResourceType(mimeType: string): 'image' | 'video' | 'raw' {
  if (mimeType.startsWith('image/') || mimeType === 'application/pdf') return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}
```

Then change the three `type !== 'TEXT'` guards to `type === 'SYSTEM'` so `FILE` messages are treated like `TEXT`. In `addReaction`, replace:

```ts
  if (message.type !== 'TEXT') throw new ApiError(400, 'Cannot react to a system message');
```

with:

```ts
  if (message.type === 'SYSTEM') throw new ApiError(400, 'Cannot react to a system message');
```

In `deleteMessage`, replace:

```ts
  if (message.type !== 'TEXT') throw new ApiError(400, 'Cannot delete a system message');
  if (message.deletedAt) throw new ApiError(400, 'Message already deleted');
```

with:

```ts
  if (message.type === 'SYSTEM') throw new ApiError(400, 'Cannot delete a system message');
  if (message.deletedAt) throw new ApiError(400, 'Message already deleted');
```

Then, still in `deleteMessage`, replace:

```ts
  await messageRepository.delete(messageId, user.id);

  getIO().to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });
```

with:

```ts
  if (message.type === 'FILE' && message.cloudinaryPublicId && message.fileType) {
    await deleteFromCloudinary(message.cloudinaryPublicId, cloudinaryResourceType(message.fileType));
  }

  await messageRepository.delete(messageId, user.id);

  getIO().to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });
```

Finally, append at the end of the file:

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

export const listFiles = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const { before, limit } = req.query as { before?: string; limit?: string };

  const files = await messageRepository.findFilesByChannel(channelId, {
    before,
    limit: limit ? Number(limit) : 50,
  });

  return ok(res, files, 'Files retrieved successfully');
});

export const downloadFile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;

  const message = await messageRepository.findById(messageId);
  if (!message || message.channelId !== channelId) throw new ApiError(404, 'Message not found');
  if (message.type !== 'FILE') throw new ApiError(400, 'Message has no file attachment');
  if (message.deletedAt) throw new ApiError(400, 'File is no longer available');

  const upstream = await fetch(message.fileUrl as string);
  if (!upstream.ok) throw new ApiError(502, 'Could not retrieve file from storage');

  const safeName = encodeURIComponent(message.fileName as string);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
  res.setHeader('Content-Type', message.fileType as string);
  if (message.fileSize) res.setHeader('Content-Length', String(message.fileSize));
  res.setHeader('Cache-Control', 'private, no-store');

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.end(buffer);
});
```

- [ ] **Step 3: Add routes**

In `backend/src/routes/channel.routes.ts`, add the import next to the other middleware imports:

```ts
import { uploadMiddleware } from '../middlewares/upload.middleware.js';
```

Update the controller import:

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
} from '../controllers/channel.controller.js';
```

Then add before `export default router;`:

```ts

router
  .route('/channels/:channelId/files')
  .get(verifyJWT, isChannelMember, validate(listMessagesSchema), listFiles)
  .post(verifyJWT, isChannelMember, validate(channelParamSchema), uploadMiddleware.single('file'), uploadFile);

router
  .route('/channels/:channelId/messages/:messageId/download')
  .get(verifyJWT, isChannelMember, validate(messageParamSchema), downloadFile);
```

- [ ] **Step 4: Verify with curl**

Start the dev server (`cd backend && npm run dev`), log in, and pick a channel you're a member of (replace `CHANNEL_ID`). Create a small test file and upload it:

```bash
echo "hello from phase 3" > /tmp/test-upload.txt

curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/files \
  -F "file=@/tmp/test-upload.txt"
```

Expected: `201` with `"data": { "type": "FILE", "fileName": "test-upload.txt", "fileUrl": "https://res.cloudinary.com/...", "reactions": [] , ... }`. Copy the returned `id` as `MESSAGE_ID`.

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/files
```

Expected: array containing that file, newest first.

```bash
curl -b /tmp/cookies.txt -s http://localhost:8080/api/v1/channels/CHANNEL_ID/messages
```

Expected: the same file message appears inline in the normal message list too.

```bash
curl -b /tmp/cookies.txt -s -o /tmp/downloaded.txt -D - http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID/download
cat /tmp/downloaded.txt
```

Expected: response headers include `Content-Disposition: attachment; filename="test-upload.txt"...`, and the downloaded file's content is `hello from phase 3`.

```bash
curl -b /tmp/cookies.txt -s -X POST http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID/reactions \
  -H "Content-Type: application/json" -d '{"emoji":"📎"}'
```

Expected: `201` (reactions now work on `FILE` messages).

```bash
curl -b /tmp/cookies.txt -s -X DELETE http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID
curl -b /tmp/cookies.txt -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/v1/channels/CHANNEL_ID/messages/MESSAGE_ID/download
```

Expected: delete succeeds (`200`), then the download attempt on the now-deleted message returns `400`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/channel.repository.ts backend/src/controllers/channel.controller.ts \
  backend/src/routes/channel.routes.ts
git commit -m "feat(chat): add file upload/list/download endpoints, extend reactions and deletion to FILE messages"
```

---

## Task 3: Frontend plumbing — types, service, hooks for file sharing

**Files:**
- Modify: `frontend/src/types/channel.types.ts`
- Modify: `frontend/src/services/channel.service.ts`
- Modify: `frontend/src/hooks/useChannel.ts`

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/axios.ts`), existing `Message`/`Channel` types.
- Produces: `Message.type` including `'FILE'`; `fileName`/`fileUrl`/`cloudinaryPublicId`/`fileType`/`fileSize` fields; `getFiles`, `uploadFile`, `getFileDownloadUrl` service functions; `useChannelFiles`, `useUploadFile` hooks. Consumed by Task 4.

- [ ] **Step 1: Extend the `Message` type**

In `frontend/src/types/channel.types.ts`, replace:

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

with:

```ts
export type MessageType = 'TEXT' | 'SYSTEM' | 'FILE';

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
  fileName: string | null;
  fileUrl: string | null;
  cloudinaryPublicId: string | null;
  fileType: string | null;
  fileSize: number | null;
  reactions: ReactionSummary[];
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}
```

- [ ] **Step 2: Add service functions**

In `frontend/src/services/channel.service.ts`, append at the end of the file:

```ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

export async function getFiles(channelId: string, before?: string): Promise<Message[]> {
  const res = await api.get<MessagesResponse>(`/channels/${channelId}/files`, {
    params: before ? { before } : undefined,
  });
  return res.data.data;
}

export async function uploadFile(channelId: string, file: File): Promise<Message> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ success: boolean; message: string; data: Message }>(
    `/channels/${channelId}/files`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data.data;
}

export function getFileDownloadUrl(channelId: string, messageId: string): string {
  return `${API_BASE}/channels/${channelId}/messages/${messageId}/download`;
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
} from '@/services/channel.service';
```

Then append at the end of the file:

```ts

export const useChannelFiles = (channelId: string) =>
  useQuery({
    queryKey: ['channels', channelId, 'files'],
    queryFn: () => getFiles(channelId),
    enabled: !!channelId,
  });

export const useUploadFile = (channelId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(channelId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'messages'] });
      qc.invalidateQueries({ queryKey: ['channels', channelId, 'files'] });
    },
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
git commit -m "feat(chat): add frontend types/service/hooks for file sharing"
```

---

## Task 4: Frontend UI — file upload composer, attachment rendering, Files tab

**Files:**
- Create: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/fileDisplay.tsx`
- Create: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/FileList.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`

**Interfaces:**
- Consumes: `useUploadFile`, `useChannelFiles`, `getFiles`, `getFileDownloadUrl` (Task 3).
- Produces: `fileIcon`, `formatBytes`, `FileAttachmentCard` (shared between `MessagePane` and `FileList`); fully interactive file sharing. Last task in this phase.

- [ ] **Step 1: Write the shared file-display helpers**

Create `frontend/src/app/(dashboard)/org/[slug]/chat/_components/fileDisplay.tsx`:

```tsx
import { Download, File, FileText, Image as ImageIcon } from 'lucide-react';
import { getFileDownloadUrl } from '@/services/channel.service';
import type { Message } from '@/types/channel.types';

export function fileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon size={14} className="text-blue-500" />;
  if (type === 'application/pdf') return <FileText size={14} className="text-red-500" />;
  return <File size={14} className="text-gray-400" />;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileAttachmentCardProps {
  message: Message;
  channelId: string;
}

export function FileAttachmentCard({ message, channelId }: FileAttachmentCardProps) {
  if (!message.fileUrl || !message.fileType || !message.fileName) return null;

  if (message.fileType.startsWith('image/')) {
    return (
      <a href={message.fileUrl} target="_blank" rel="noreferrer" className="mt-1 block w-fit">
        <img
          src={message.fileUrl}
          alt={message.fileName}
          className="max-h-48 max-w-xs rounded-lg border border-border-subtle object-cover"
        />
      </a>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-muted/40 px-3 py-2">
      {fileIcon(message.fileType)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{message.fileName}</p>
        <p className="text-xs text-text-secondary">{formatBytes(message.fileSize ?? 0)}</p>
      </div>
      <a
        href={getFileDownloadUrl(channelId, message.id)}
        download={message.fileName}
        className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
        title="Download"
      >
        <Download size={14} />
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Wire the composer's file button and FILE message rendering into `MessagePane.tsx`**

Replace:

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

with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, Send, Smile, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { parseApiError } from '@/lib/axios';
import {
  useChannelMessages,
  useSendMessage,
  useAddReaction,
  useRemoveReaction,
  useDeleteMessage,
  useUploadFile,
} from '@/hooks/useChannel';
import { getMessages } from '@/services/channel.service';
import { useAuthStore } from '@/store/auth.store';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { FileAttachmentCard } from './fileDisplay';
import type { Channel, Message } from '@/types/channel.types';

interface Props {
  channel: Channel;
  isAdmin: boolean;
}

export default function MessagePane({ channel, isAdmin }: Props) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: messages, isLoading } = useChannelMessages(channel.id);
  const sendMessage = useSendMessage(channel.id);
  const addReaction = useAddReaction(channel.id);
  const removeReaction = useRemoveReaction(channel.id);
  const deleteMessage = useDeleteMessage(channel.id);
  const uploadFile = useUploadFile(channel.id);
  const [content, setContent] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

Replace:

```tsx
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMessage.mutate(deleteTarget, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  if (isLoading) {
```

with:

```tsx
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMessage.mutate(deleteTarget, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile.mutate(file, {
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  if (isLoading) {
```

Replace the message content rendering:

```tsx
                  {message.deletedAt ? (
                    <p className="text-sm italic text-text-secondary">This message was deleted</p>
                  ) : (
                    <>
                      <p className="text-sm text-text-primary">{message.content}</p>

                      {message.reactions.length > 0 && (
```

with:

```tsx
                  {message.deletedAt ? (
                    <p className="text-sm italic text-text-secondary">This message was deleted</p>
                  ) : (
                    <>
                      {message.type === 'FILE' ? (
                        <FileAttachmentCard message={message} channelId={channel.id} />
                      ) : (
                        <p className="text-sm text-text-primary">{message.content}</p>
                      )}

                      {message.reactions.length > 0 && (
```

Replace the composer form:

```tsx
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
```

with:

```tsx
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-subtle p-3">
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadFile.isPending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
          title="Attach a file"
        >
          <Paperclip size={16} />
        </button>
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
```

- [ ] **Step 3: Write `FileList.tsx`**

Create `frontend/src/app/(dashboard)/org/[slug]/chat/_components/FileList.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import { useChannelFiles } from '@/hooks/useChannel';
import { getFiles } from '@/services/channel.service';
import { FileAttachmentCard } from './fileDisplay';
import type { Channel, Message } from '@/types/channel.types';

interface Props {
  channel: Channel;
}

export default function FileList({ channel }: Props) {
  const qc = useQueryClient();
  const { data: files, isLoading } = useChannelFiles(channel.id);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    if (!files || files.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await getFiles(channel.id, files[files.length - 1].createdAt);
      qc.setQueryData<Message[]>(['channels', channel.id, 'files'], (old) =>
        old ? [...old, ...older] : older
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
    <div className="h-full overflow-y-auto px-4 py-3 space-y-2">
      {files && files.length > 0 ? (
        <>
          {files.map((file) => (
            <div key={file.id} className="rounded-lg border border-border-subtle p-2">
              <div className="mb-1 flex items-baseline gap-2 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{file.sender?.name ?? 'Unknown'}</span>
                <span>{new Date(file.createdAt).toLocaleDateString()}</span>
              </div>
              <FileAttachmentCard message={file} channelId={channel.id} />
            </div>
          ))}
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="mx-auto block text-xs text-primary hover:underline disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-text-secondary">No files shared in this channel yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the Files tab into `ChannelView.tsx`**

Replace:

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Hash, Lock, LogOut, Trash2, Users } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import { useChannelMembers, useLeaveChannel, useDeleteChannel } from '@/hooks/useChannel';
import ManageChannelMembersModal from '@/components/shared/ManageChannelMembersModal';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { Channel } from '@/types/channel.types';
import MessagePane from './MessagePane';

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
```

with:

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Hash, Lock, LogOut, Paperclip, Trash2, Users } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import { useChannelMembers, useLeaveChannel, useDeleteChannel } from '@/hooks/useChannel';
import ManageChannelMembersModal from '@/components/shared/ManageChannelMembersModal';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { Channel } from '@/types/channel.types';
import MessagePane from './MessagePane';
import FileList from './FileList';

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
  const [activeView, setActiveView] = useState<'messages' | 'files'>('messages');
```

Replace:

```tsx
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowMembersModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <Users size={13} /> Members
          </button>
          <button
            onClick={() => setShowLeaveConfirm(true)}
```

with:

```tsx
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
```

Replace:

```tsx
      <div className="flex-1 overflow-hidden">
        <MessagePane channel={channel} isAdmin={isAdmin} />
      </div>
```

with:

```tsx
      <div className="flex-1 overflow-hidden">
        {activeView === 'files' ? (
          <FileList channel={channel} />
        ) : (
          <MessagePane channel={channel} isAdmin={isAdmin} />
        )}
      </div>
```

- [ ] **Step 5: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 6: Verify in the browser**

Open a channel, click the paperclip icon in the composer, pick an image — expect it to upload and appear inline as a thumbnail; click it — expect it to open full-size in a new tab. Upload a non-image file (e.g. a PDF or `.txt`) — expect a file card with icon, name, size, and a download button that downloads the correct file. React to and delete a file message exactly like a text message — expect both to work. Click "Files" in the channel header — expect the message pane to be replaced by a list of every file shared in that channel, newest first, each with uploader name and date. Click "Files" again — expect it to toggle back to the normal message view.

- [ ] **Step 7: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/chat/_components/fileDisplay.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/FileList.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx"
git commit -m "feat(chat): add file upload composer, attachment rendering, and Files tab"
```
