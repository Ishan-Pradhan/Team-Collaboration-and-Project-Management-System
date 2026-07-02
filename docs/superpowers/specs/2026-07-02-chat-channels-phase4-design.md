# Chat — Phase 4: Private Direct Messages

**Status:** Approved for planning
**Scope:** Fourth of five planned phases building toward full Slack-style chat (channels → message actions → file sharing → **private DMs** → org moderation). Adds 1:1 direct messages between organization members, reusing the existing `Channel`/`ChannelMember`/`Message` infrastructure wholesale.

## Background

Phases 1-3 built org-scoped channels (admin-created, invite-based membership) with reactions, soft-delete, and file sharing. This phase adds private 1:1 messaging: any org member can message any other org member directly, without needing to share a channel or get an admin's involvement. Group DMs are explicitly out of scope — multi-person conversations remain channels, created by admins, exactly as they work today.

## Architecture

No new transport, no new tables. A DM is a `Channel` row with `type: 'DM'`, with exactly two `ChannelMember` rows created atomically at start time. Because messaging, reactions, deletion, file sharing, and Socket.IO room membership are all keyed off `channelId` and `ChannelMember` rows already, all of that machinery works on DMs with zero changes — the only new code is how a DM channel gets created/found and a few guards on channel-management endpoints that don't make sense for a 2-person, admin-free conversation.

## Data Model

Two changes to the existing `Channel` model, both via a new migration:

- `Channel.name` becomes **nullable**. DMs have no name (the frontend derives a display name from the other participant). `PUBLIC`/`PRIVATE` channels keep requiring a name; the existing `(organizationId, name)` unique index is unaffected since standard btree unique indexes treat each `NULL` as distinct.
- New nullable column `Channel.dmKey` (string). For `type: 'DM'` channels only, set at creation to the two participants' user IDs sorted lexicographically and joined with `:` (e.g. `${min(idA, idB)}:${max(idA, idB)}`). A **partial unique index** on `(organizationId, dmKey) WHERE "dmKey" IS NOT NULL` guarantees at most one DM channel per pair of users per org, while leaving named channels (`dmKey IS NULL`) untouched. This is what makes "start a DM" idempotent — the second call for the same pair finds the existing row instead of creating a duplicate.

No new table. `ChannelMember` rows for a DM are created exactly once, at DM-start time, and never modified afterward (no invite, no leave, no force-remove — see Permission Rules).

## API Surface

Two new routes on the existing `channel.routes.ts`:

| Method | Path | Who | Notes |
|---|---|---|---|
| `POST` | `/organizations/:organizationId/dms` | any org member | body `{ userId }`; finds an existing DM via `dmKey` (returns `200`) or creates one plus both `ChannelMember` rows (returns `201`) |
| `GET` | `/organizations/:organizationId/dms` | any org member | lists the caller's DM channels, each with the *other* participant's `{id, name, avatarUrl}` attached server-side |

`GET/POST /channels/:channelId/messages`, the reaction endpoints, and the file-sharing endpoints (Phases 1-3) require **no changes** — they already operate purely on `channelId` + `isChannelMember`, which is agnostic to channel type.

## Socket Events

None new. A DM channel is joined into its `channel:<id>` room exactly like any other channel — `socket/index.ts`'s connection handler already joins every room for every `ChannelMember` row belonging to the connecting user, with no type-based branching. `message:new`, `message:deleted`, `reaction:added`/`reaction:removed` all fire for DMs unchanged.

## Permission Rules

- Starting a DM: any org member, with any other org member (no channel-membership prerequisite).
- Reading/sending messages, reacting, sharing files in a DM: the two participants only (enforced by the existing `isChannelMember`, since a DM only ever has those two `ChannelMember` rows).
- **Deleting a DM message: sender only, no org-admin override.** This is a deliberate narrowing of Phase 2's "sender or org admin" rule — `deleteMessage` skips the admin-override branch entirely when `channel.type === 'DM'`, so an org admin who happens to be one of the two DM participants cannot delete the other participant's messages just by virtue of their org role. Privacy inside a DM is between its two participants only.
- The following existing endpoints reject DM channels outright with `400`, since none of these concepts apply to a fixed, adminless 2-person conversation: `DELETE /channels/:channelId` (delete channel), `POST /channels/:channelId/members` (invite a third person), `DELETE /channels/:channelId/members/me` (leave), `DELETE /channels/:channelId/members/:userId` (force-remove). `GET /channels/:channelId/members` (list) is left unguarded — listing a DM's 2 participants through the existing generic endpoint is harmless.

## Frontend

- **Sidebar**: `ChatPage.tsx` gets a new "Direct Messages" section alongside "Channels", listing DMs by the other participant's name/avatar (from a new optional `dmParticipant` field on the `Channel` type), with a "+" button opening a simple user-picker modal (org member list, click to start/open — reuses `useOrganizationMembers`).
- **Reuse `ChannelView`/`MessagePane`/`FileList` unchanged** for DMs — since a DM is a `Channel`, messaging/reactions/files work with no new message-rendering components. `ChannelView`'s header adapts: shows `channel.dmParticipant.name` instead of `channel.name`/type icon when `channel.type === 'DM'`, and hides the Members/Leave/Delete buttons entirely (the Files toggle stays, since file sharing still applies to DMs).
- **New hooks** in `useChannel.ts`: `useDMs(organizationId)` → query key `['organizations', organizationId, 'dms']`, `useStartDM(organizationId)` mutation.
- **`useChatSocket.ts` needs no changes** — its handlers already key off `channelId` inside the emitted payload, not channel type, so DM events patch the same `['channels', channelId, 'messages']` cache entries as channel events.

## Error Handling & Edge Cases

- Starting a DM with yourself → `400`.
- Starting a DM with someone outside the organization → `400`.
- Starting a DM that already exists between the two users → returns the existing channel (`200`), not a duplicate — idempotent by design via `dmKey`.
- `deleteChannel`/`inviteChannelMember`/`leaveChannel`/`removeChannelMember` called against a DM channel → `400 "Not applicable to direct messages"`.
- A DM participant who is also an org admin attempting to delete the other participant's message → `403` (no admin override in DMs).
- Non-member (i.e. neither of the two participants) attempting to read/send/react/share files in a DM → `403` via existing `isChannelMember`.

## Testing

No test runner exists in this repo, consistent with Phases 1-3. Verification is manual: `curl` against a running dev server for the backend, and browser interaction for the frontend.

## Explicitly Out of Scope (this phase)

Group DMs (3+ participants), hiding/leaving a DM from the sidebar (DMs are always listed once started), and org-level ban (next phase).
