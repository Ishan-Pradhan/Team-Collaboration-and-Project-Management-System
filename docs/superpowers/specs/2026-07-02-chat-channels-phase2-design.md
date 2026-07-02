# Chat — Phase 2: Message Reactions & Deletion

**Status:** Approved for planning
**Scope:** Second of five planned phases building toward full Slack-style chat (channels → **message actions** → file sharing → DMs → org moderation). This phase adds emoji reactions and message deletion on top of the Phase 1 foundation (channels, membership, real-time text messaging). Both were explicitly out of scope in Phase 1.

## Background

Phase 1 shipped org-scoped channels, membership management, and real-time text messaging over Socket.IO. Its design doc explicitly deferred "message reactions, message deletion, file attachments, private DMs, and org-level ban" to later phases. This spec covers the next two: reactions and deletion. Both build directly on the Phase 1 `Message` model and Socket.IO event pipeline — no new transport or channel concepts are introduced.

## Architecture

No changes to the Phase 1 architecture. Same conventions apply:

- All writes go through REST (`routes → middlewares → controllers → repositories → models`); Socket.IO remains push-only.
- New events are emitted to the existing `channel:<id>` room after a successful DB write, exactly like `message:new` in Phase 1.
- Reactions and deletion require `isChannelMember`, reusing the same middleware (and its suspended-org check) as every other channel/message endpoint.

## Data Model

Two schema changes, both via new Sequelize CLI migrations.

**`Message` (modify existing table)** — add two nullable columns:
- `deletedAt` (timestamp, nullable) — soft-delete marker; `null` means not deleted
- `deletedBy` (uuid, FK → `User`, nullable) — who deleted it (the sender, or an `ORG_ADMIN` moderating)

When a message is deleted, the repository sets `deletedAt`/`deletedBy` **and** overwrites `content` to `''` in the same update. The original text is not recoverable — there is no audit/undo requirement in this phase, so it is discarded rather than retained-but-hidden.

**`MessageReaction` (new table)**
- `id` (uuid, PK)
- `messageId` (uuid, FK → `Message`, `ON DELETE CASCADE`)
- `userId` (uuid, FK → `User`, `ON DELETE CASCADE`)
- `emoji` (string) — the emoji character(s) chosen from the picker; no server-side allow-list, any valid emoji string is accepted
- `createdAt`
- Unique index on `(messageId, userId, emoji)` — prevents the same user from double-adding the same emoji to the same message; this also makes "add" idempotent (duplicate insert attempt is a clean no-op) and "remove" a single indexed delete.

A user may add multiple *different* emoji reactions to the same message (e.g. both 👍 and 🎉), but only one row per `(message, user, emoji)` combination.

Reactions are only valid on non-deleted `type: 'TEXT'` messages — enforced in the controller (mirroring how Phase 1 enforces membership in controllers rather than via DB constraints), not the schema. Message deletion is a soft delete (the row stays; only `deletedAt`/`deletedBy`/`content` change), so `ON DELETE CASCADE` on `MessageReaction.messageId` never fires for this path — it only protects against a future hard-delete. The delete controller therefore explicitly issues `MessageReaction.destroy({ where: { messageId } })` in the same operation as the soft-delete update.

`emoji` is validated with the same length-bounded string pattern used elsewhere (e.g. `z.string().min(1).max(8)`) — generous enough for multi-codepoint emoji (skin tones, ZWJ sequences) without allowing arbitrary long strings.

## API Surface

New routes added to the existing `channel.routes.ts`, nested under `/channels/:channelId/messages/:messageId`:

| Method | Path | Who | Notes |
|---|---|---|---|
| `POST` | `/channels/:channelId/messages/:messageId/reactions` | channel member | body `{ emoji }`; idempotent — re-adding the same emoji is a no-op `200`, not an error |
| `DELETE` | `/channels/:channelId/messages/:messageId/reactions/:emoji` | channel member, own reaction only | removes the caller's own `(messageId, userId, emoji)` row; `emoji` is URL-encoded |
| `DELETE` | `/channels/:channelId/messages/:messageId` | sender or `ORG_ADMIN` | soft-delete: sets `deletedAt`/`deletedBy`, clears `content`, deletes associated `MessageReaction` rows |

The existing `GET /channels/:channelId/messages` (Phase 1) is extended to include each message's reactions, grouped by emoji with the list of reacting user IDs, so the client can render counts and highlight "you reacted" without a separate request.

No new top-level resources or route files — everything lives in `channel.routes.ts` / `channel.controller.ts` / `channel.repository.ts`, consistent with Phase 1's file layout.

## Socket Events (server → client only)

- `reaction:added` — `{ messageId, channelId, emoji, userId }` — broadcast to `channel:<id>` after a successful reaction add
- `reaction:removed` — `{ messageId, channelId, emoji, userId }` — broadcast after a successful reaction remove
- `message:deleted` — `{ messageId, channelId }` — broadcast after a successful message delete

As in Phase 1, there are no client-originated socket business events — all writes go through the REST endpoints above.

## Permission Rules

- Add/remove a reaction: any current `ChannelMember`; a user may only remove their *own* reaction (not another member's)
- Delete a message: the message's `senderId` matches the caller, **or** the caller is an `ORG_ADMIN` of the channel's organization (same check as `isChannelOrgAdmin` from Phase 1)
- Reactions and deletion are only valid on `type: 'TEXT'` messages — attempting either on a `SYSTEM` message throws `ApiError(400, ...)`
- Violations follow existing conventions: membership/permission failures → `403`; invalid target state (already deleted, wrong message type, reaction not found) → `400`/`404` as appropriate

## Frontend

- **New dependency**: `emoji-picker-react` (peer range `react: >=16`, compatible with React 19) for the reaction emoji picker popover.
- **`MessagePane.tsx`** (Phase 1 component, extended): each `TEXT` message gets a hover-revealed action toolbar with two icons — a smiley that opens the emoji picker popover anchored to the message, and (only when `message.senderId === user.id || isAdmin`) a trash icon that opens the existing `ConfirmationDialog` ("Delete this message? This cannot be undone.").
- **Reaction chips**: a row of small pill buttons under message content, one per distinct emoji with its count (e.g. `👍 3`). Pills the current user is part of are highlighted (primary-tinted, matching the existing selected-channel visual language). Clicking a pill you're part of removes your reaction; clicking one you're not part of adds it. Picking a new emoji from the picker adds that reaction.
- **Deleted messages**: render as muted italic "This message was deleted" in place of content — left-aligned with the sender's avatar/name still shown (unlike `SYSTEM` messages, which are centered), no reaction row, no hover toolbar.
- **New hooks** in `useChannel.ts`: `useAddReaction(channelId)`, `useRemoveReaction(channelId)`, `useDeleteMessage(channelId)` — mutation-only; reaction data arrives as part of the existing `useChannelMessages` query response.
- **`useChatSocket.ts`** gains three handlers (`reaction:added`, `reaction:removed`, `message:deleted`) that patch the `['channels', channelId, 'messages']` query cache directly via `setQueryData`, following the exact pattern already used for `message:new` in Phase 1.

## Error Handling & Edge Cases

- Reacting to or deleting a `SYSTEM` message → `400`.
- Reacting to an already-deleted message → `400`.
- Adding a reaction you already have (same user/emoji/message) → idempotent `200`, no duplicate row (absorbed by the unique constraint).
- Removing a reaction you never made → `404 Reaction not found`.
- Deleting a message you didn't send and aren't an `ORG_ADMIN` for → `403`.
- Deleting an already-deleted message → `400 Message already deleted`.
- Non-member attempting any reaction/delete action → `403` via the existing `isChannelMember` middleware (suspended-org check included, same as Phase 1).
- Socket gap on reconnect (e.g. Render free-tier spin-down) → already handled by Phase 1's reconnect-refetch of recent messages; since reactions now travel inside the `GET .../messages` payload, that same refetch naturally catches any missed `reaction:*`/`message:deleted` events too — no new reconnect logic needed.

## Testing

No test runner exists in this repo (no Jest/Vitest/Mocha), consistent with Phase 1. Verification is manual: `curl` against a running dev server for the backend, and browser interaction for the frontend.

## Explicitly Out of Scope (this phase)

Message editing, file attachments (with sent/received views), private DMs, and org-level ban. Each will get its own spec in a later phase.
