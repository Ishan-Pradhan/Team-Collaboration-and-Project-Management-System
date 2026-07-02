# Chat — Phase 1: Real-Time Channels

**Status:** Approved for planning
**Scope:** First of five planned phases building toward full Slack-style chat (channels → message actions → file sharing → DMs → org moderation). This phase covers only the foundation: real-time transport, org-scoped channels, admin-only creation, member invites, and text messaging.

## Background

The request was for a full Slack-like chat system: admin-created channels, member-to-member invites (same org only), org-level ban/kick, join/leave notifications, message deletion, reactions, file sharing with separate sent/received views, and private DMs. That's multiple independent subsystems, so it was decomposed into five ordered phases. This spec covers Phase 1 only; later phases will each get their own spec.

An existing `chatMessages` model/table was found in the codebase (`backend/src/models/chatMessages.model.ts`, `chat_messages` table) but has **no migration, no controller, no routes** — it's a fully unused stub scoped to a single project with no channel/reaction/attachment concept. It will be removed and replaced by the model described below.

## Deployment Context

Backend deploys to Render free tier. WebSockets are supported there; the only quirk is the service spins down after ~15 min idle, causing a ~30–50s reconnect delay on the next connection. Free tier runs a single instance, so no Redis adapter is needed for Socket.IO (that would only matter for horizontal scaling across multiple instances). Socket.IO's built-in client reconnection handles the cold-start delay; the UI shows a "Reconnecting…" indicator during it.

## Architecture

- Socket.IO server attaches to the same HTTP server as Express — same Node process, same Render deploy, no new service.
- Socket handshake auth reuses the existing JWT cookie verification (`accessToken` httpOnly cookie), same logic as `verifyJWT`.
- **All writes go through REST**, following the existing RMVCS pattern (`routes → middlewares → controllers → repositories → models`) exactly like tasks/projects. There is no parallel socket-based business logic path.
- Socket.IO is **push-only**: after a controller successfully writes to the DB, it emits an event to the relevant room(s).
- Rooms: each connected socket joins one room per channel the user belongs to (`channel:<id>`), plus an org room (`org:<id>`) for org-wide events (e.g. new public channel appearing). Room membership is computed server-side from the DB on connect — the client cannot request arbitrary rooms.
- Frontend: a Socket.IO client singleton connects once the dashboard auth guard passes, and a `useChatSocket()` hook updates TanStack Query's cache directly on incoming events (append message, invalidate channel list, etc.) instead of polling.

## Data Model

Three new tables, replacing the unused `chat_messages` stub (model, types, and its `models/index.ts` associations are removed):

**`Channel`**
- `id` (uuid, PK)
- `organizationId` (uuid, FK → Organization)
- `name` (string) — unique per `organizationId` (case-insensitive), enforced by a DB unique index, so simultaneous duplicate creation gets a clean `409` instead of a race condition
- `type`: `ENUM('PUBLIC', 'PRIVATE')`
- `createdBy` (uuid, FK → User)
- timestamps

**`ChannelMember`**
- `id` (uuid, PK)
- `channelId` (uuid, FK → Channel)
- `userId` (uuid, FK → User)
- `joinedAt`
- No per-channel role. Permissions derive from org role (`ORG_ADMIN`) plus the invite/leave rules below — there is no channel-level owner/admin concept in this phase.

**`Message`**
- `id` (uuid, PK)
- `channelId` (uuid, FK → Channel)
- `senderId` (uuid, FK → User, nullable — null for system messages)
- `type`: `ENUM('TEXT', 'SYSTEM')`
- `content` (text)
- `createdAt` only (matches the existing `Notification` model's `updatedAt: false` convention — no message editing in this phase)

**Membership auto-sync (integration touchpoints outside the chat module):**
- Creating a `PUBLIC` channel → bulk-insert `ChannelMember` rows for every current org member.
- A user joining the organization (existing invite-accept flow) → bulk-insert a `ChannelMember` row for them into every existing `PUBLIC` channel in that org.
- A user leaving a `PUBLIC` channel only deletes that one row — it does not opt them out of future public channels, and getting back in later works the same way as private channels (any existing member can invite them back; there is no self-serve rejoin/browse UI in this phase, since public channels are auto-joined rather than browsed).
- **Org removal cascade**: when a member is removed from (or leaves) the organization via the existing `removeOrganizationMember`/leave flow, cascade-delete their `ChannelMember` rows across that org's channels and emit `member:left` on each affected channel.

All three tables are added via new Sequelize CLI migrations (`npx sequelize-cli db:migrate`), per existing project convention. `ChannelMember` and `Message` rows are set to cascade-delete (`ON DELETE CASCADE`) when their parent `Channel` is deleted, so `DELETE /channels/:channelId` doesn't need separate cleanup logic.

## API Surface

New `channel.routes.ts`, mounted under the existing route structure:

| Method | Path | Who |
|---|---|---|
| `POST` | `/organizations/:orgId/channels` | `ORG_ADMIN` only — `{ name, type }` |
| `GET` | `/organizations/:orgId/channels` | any org member — public channels + private channels they're in |
| `DELETE` | `/channels/:channelId` | `ORG_ADMIN` only |
| `GET` | `/channels/:channelId/members` | channel members only |
| `POST` | `/channels/:channelId/members` | any current channel member — `{ userId }`, must be same org |
| `DELETE` | `/channels/:channelId/members/:userId` | self (leave) or `ORG_ADMIN` (force-remove) |
| `GET` | `/channels/:channelId/messages` | channel members only, cursor-paginated |
| `POST` | `/channels/:channelId/messages` | channel members only — send text message |

## Socket Events (server → client only)

- `channel:created` / `channel:deleted` — broadcast to the org room
- `member:joined` / `member:left` — broadcast to the channel room
- `message:new` — broadcast to the channel room (covers both `TEXT` and `SYSTEM` messages, e.g. join/leave notices)

There are no client-originated socket business events in this phase — all writes go through the REST endpoints above.

## Permission Rules

- Create/delete channel, force-remove a member: `ORG_ADMIN` only
- Invite to a channel, self-leave: any current channel member (invite target must be a member of the same organization — validated against `OrganizationMember`)
- Send/read messages: must be a `ChannelMember` (enforced for public channels too, since they use real membership rows)
- Violations throw the existing `ApiError(403, ...)`; invalid invite targets or duplicate invites throw `ApiError(400, ...)`

## Frontend

- New route `frontend/src/app/(dashboard)/org/[slug]/chat/page.tsx` + `_components/`, following the same convention as `settings`/`projects`. New "Chat" nav item alongside Projects/Members/Settings.
- Layout: sidebar lists channels (public + private-you're-in) with a "+ New channel" button shown only to `ORG_ADMIN` (modal: name + public/private toggle). Selecting a channel shows a header (member count, "Invite" button with a modal listing same-org members not yet in the channel), a scrollable cursor-paginated message list, and a text input.
- System messages (join/left) render as centered, muted text, distinct from regular message bubbles.
- New hooks in `src/hooks/`: `useChannels(orgId)` → `['organizations', orgId, 'channels']`, `useChannelMessages(channelId)` → `['channels', channelId, 'messages']`, `useChannelMembers(channelId)` → `['channels', channelId, 'members']`, plus mutations for create/invite/send/leave/remove.
- Socket client singleton in `src/lib/socket.ts`, connected once the dashboard auth guard passes, disconnected on logout. `useChatSocket()` hook subscribes to the five events and updates the TanStack Query cache directly.
- Errors use the existing `sonner` toast pattern via `parseApiError`.

## Error Handling & Edge Cases

- Invite target not in the org → `400`. Invite target already a channel member → `400`.
- Non-member messaging/reading, or non-admin creating/deleting a channel → `403`.
- Duplicate channel name in the same org (simultaneous creation) → `409` via DB unique constraint.
- Channel deleted while a client has it open → `channel:deleted` event tells that client to redirect out.
- Org member removal/leave cascades to remove their channel memberships (see Data Model above).
- Socket disconnect (e.g. Render free-tier spin-down) → client shows "Reconnecting…"; on reconnect, refetches the open channel's recent messages via REST to backfill any gap.

## Testing

No test runner exists anywhere in the backend today (no Jest/Vitest/Mocha, no `*.test.ts` files outside `node_modules`). This phase will not introduce one; verification is manual, consistent with the rest of the codebase.

## Explicitly Out of Scope (this phase)

Message reactions, message deletion, file attachments (with sent/received views), private DMs, and org-level ban. (Kick already exists and is now integrated via the org-removal cascade above.) Each will get its own spec in a later phase.
