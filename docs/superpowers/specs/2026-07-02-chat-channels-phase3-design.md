# Chat — Phase 3: File Sharing

**Status:** Approved for planning
**Scope:** Third of five planned phases building toward full Slack-style chat (channels → message actions → **file sharing** → DMs → org moderation). Adds file attachments to channel messages plus a per-channel "Files" tab, reusing the existing task-attachment upload pipeline (multer + Cloudinary) rather than building new storage infrastructure.

## Background

Phase 1 shipped channels/membership/messaging; Phase 2 added reactions and soft-delete. This phase adds file sharing, called out in the Phase 1 background as needing "separate sent/received views" — clarified here as a dedicated per-channel Files tab (Slack-like), not just inline attachments.

The codebase already has a complete, working file-upload pipeline built for task attachments: `backend/src/middlewares/upload.middleware.ts` (multer, memory storage, 20MB limit, a fixed MIME allow-list), `backend/src/services/cloudinary.service.ts` (`uploadToCloudinary`, `deleteFromCloudinary`, resource-type detection), and a full working example in `task.controller.ts`/`task.routes.ts` (upload, list, delete, and an auth-gated download-proxy endpoint) with a matching frontend implementation in `TaskDrawer.tsx` (`fileIcon()`, `formatBytes()`, plain `<a href={downloadUrl} download>` for downloads — cookies ride along automatically since it's a real browser navigation, not a `fetch` call). This phase reuses all of it as-is; no new storage design.

## Architecture

No changes to the established chat architecture. All writes go through REST; Socket.IO stays push-only. File sharing introduces no new socket event types — a file share is just a `Message` with `type: 'FILE'`, so it rides the existing `message:new`/`message:deleted` events from Phase 1/2 unchanged.

## Data Model

`Message.type` gains a third enum value: `'FILE'` (alongside `'TEXT'`/`'SYSTEM'`). Five new nullable columns on `Message`, mirroring `TaskAttachment` exactly:

- `fileName` (string)
- `fileUrl` (text) — Cloudinary's `secure_url`
- `cloudinaryPublicId` (string) — needed to delete the asset later
- `fileType` (string) — MIME type
- `fileSize` (integer) — bytes

`content` continues to hold an optional caption for `FILE` messages (empty string if none supplied). No new table, no new model — this is purely additive columns on the existing `Message`/`messages` table.

**Migration:** adds the five columns, plus the enum value via `ALTER TYPE "enum_messages_type" ADD VALUE 'FILE'`. The `down` migration follows this repo's existing precedent for removing an enum value (`backend/src/sequelize/migrations/20260623130800-change-organization-members-role-enum-to-uppercase.js`): convert any `FILE`-type rows back to `TEXT` first (to avoid leaving rows referencing a value about to be dropped), then recreate the enum type without `'FILE'`.

**Reactions and deletion (Phase 2) apply to `FILE` messages exactly like `TEXT`.** The existing `type !== 'TEXT'` guards in `addReaction`, `removeReaction`, and `deleteMessage` (in `channel.controller.ts`) change to `type === 'SYSTEM'` — i.e. reject only system messages, not file messages. `deleteMessage` additionally calls `deleteFromCloudinary(cloudinaryPublicId, resourceType)` when the message being deleted has `type: 'FILE'`, using the same `cloudinaryResourceType(mimeType)` helper pattern already in `task.controller.ts`, so deleting a file message doesn't leave an orphaned asset in Cloudinary storage.

## API Surface

New routes on the existing `channel.routes.ts`, reusing `uploadMiddleware` and the Cloudinary service functions:

| Method | Path | Who | Notes |
|---|---|---|---|
| `POST` | `/channels/:channelId/files` | channel member | `multipart/form-data`, field `file`; creates a `Message` with `type: 'FILE'` |
| `GET` | `/channels/:channelId/files` | channel member | cursor-paginated (`before`/`limit`, same shape as `GET .../messages`) list of that channel's non-deleted `FILE` messages, newest first — powers the Files tab |
| `GET` | `/channels/:channelId/messages/:messageId/download` | channel member | proxies the file from Cloudinary with a forced `Content-Disposition: attachment` header, mirroring `downloadAttachment` in `task.controller.ts`; returns `400` if the message is deleted |

`DELETE /channels/:channelId/messages/:messageId` (Phase 2) is extended as described in Data Model above — same route, same permission rule (sender or org admin), no new endpoint.

`GET /channels/:channelId/messages` (existing) already returns `FILE` messages inline in the normal stream with no changes required — the new `GET .../files` endpoint is purely additive, for the dedicated tab.

## Socket Events

None new. `FILE` messages ride the existing `message:new` (on upload) and `message:deleted` (on delete) events from Phase 1/2 unchanged. The Files tab is not live-updated via socket in this phase — it refetches on open, which is sufficient since it's checked occasionally rather than watched continuously like the message stream.

## Permission Rules

- Upload/list/download a file: any current `ChannelMember` (same as messages generally).
- Delete a file message: sender or `ORG_ADMIN` — identical rule to Phase 2's text-message deletion, reusing the same controller logic.
- React to a file message: any channel member — identical rule to Phase 2, now permitted for `FILE` alongside `TEXT`.

## Frontend

- **New dependency**: none — reuses existing `axios`/`FormData` patterns already used for task attachments.
- **Composer** (`MessagePane.tsx`): a paperclip icon button next to Send opens a hidden `<input type="file">` (triggered via ref). On selection, uploads immediately via `useUploadFile(channelId)` (FormData POST), disabling the composer while in flight. No caption input in this phase.
- **Message rendering**: `FILE` messages render as an attachment card instead of plain text. Image MIME types show a thumbnail (`<img src={fileUrl}>`, click opens the full image in a new tab); everything else shows a generic file-icon card (name + formatted size), reusing `fileIcon()`/`formatBytes()` ported from `TaskDrawer.tsx`. A download icon on the card is a plain `<a href={downloadUrl} download={fileName}>` pointing at the download-proxy endpoint — identical mechanism to task attachments, so cookies are sent automatically.
- **Files tab**: `ChannelView`'s header gets a "Files" toggle button next to Members/Leave/Delete. Toggling swaps the body between `MessagePane` and a new `FileList` component — a paginated grid of file cards (thumbnail/icon + name + uploader + date + download), backed by `useChannelFiles(channelId)` hitting `GET .../files`. No live updates (per Socket Events above); it refetches on open.
- **New hooks** in `useChannel.ts`: `useChannelFiles(channelId)`, `useUploadFile(channelId)`.

## Error Handling & Edge Cases

- Disallowed file type or >20MB → rejected by the existing `uploadMiddleware`, unchanged behavior from task attachments.
- Non-member attempting upload/list/download → `403` via existing `isChannelMember`.
- Deleting a file message you didn't send and aren't an org admin for → `403`.
- Downloading an already-deleted file message → `400`, checked before attempting the upstream Cloudinary fetch (avoids a confusing `502` from fetching a now-missing asset).
- Cloudinary upload/delete failures propagate as `500` via `asyncHandler`, same as existing task-attachment behavior.
- Reacting to a deleted `FILE` message is blocked by the existing Phase 2 `deletedAt` check, unchanged.

## Testing

No test runner exists in this repo, consistent with Phases 1 and 2. Verification is manual: `curl` (including `curl -F` for multipart upload) against a running dev server for the backend, and browser interaction for the frontend.

## Explicitly Out of Scope (this phase)

Multiple files per message (each upload is its own message), a caption input in the upload UI (the `content` column supports one, but no frontend control sets it in this phase), private DMs, and org-level ban. Each remaining item will get its own spec in a later phase.
