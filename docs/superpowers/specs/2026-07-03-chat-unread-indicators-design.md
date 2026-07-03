# Chat Unread Indicators

**Status:** Approved for planning
**Scope:** First of three follow-ups to the just-shipped notifications feature (the other two — an ActivityLog-based real-time activity feed, and moving/polishing the notification entry point into the sidebar — are separate specs). This one adds per-channel/DM unread tracking: a live sidebar indicator showing who messaged, a matching entry in the existing notification bell/list, and read-clearing when you open the channel.

## Background

The notifications feature shipped in `docs/superpowers/specs/2026-07-03-notifications-design.md` covers four low-frequency events (channel/project membership, task assignment, task comments) via one `Notification` row per event, each optionally emailed. Chat messages are fundamentally different: high-frequency, and a naive one-row-per-message approach would flood the notification list (a busy channel could produce dozens of rows before anyone reads them) and make email entirely inappropriate. There is also currently zero read-tracking for chat anywhere in the codebase (no `lastReadAt`, no unread concept at all) — every message send just broadcasts `message:new` to the channel's socket room and appends to the open thread; nothing tracks whether a given member has seen it.

This spec reuses the `Notification` model (same table, no new one) with **upsert semantics**: one row per `(user, channel)` pair that updates in place as new messages arrive, rather than accumulating. That single row is simultaneously the source of truth for the sidebar's unread dot and the bell list's entry, so the two can never drift out of sync — reading one clears both.

## Data Model

No schema change. One new `type` value, `message_received`, on the existing `notifications` table. `entityType: 'channel'`, `entityId: <channelId>` (channels and DMs are both rows in the `channels` table, so this covers both without a separate entity type). No email is ever attached to this type — not merely omitted per-call, but structurally unsupported by the function that creates these rows (see below), since a message-frequency email would be spam.

## Backend

**`notification.repository.ts` additions:**
- `upsertMessageNotification({ userId, organizationId, channelId, title, body })` — looks for an existing *unread* row matching `{ userId, entityType: 'channel', entityId: channelId, type: 'message_received', isRead: false }`. If found, updates `title`/`body`/`createdAt` on that row (bumping it to the top of any recency-ordered list). Otherwise creates a new row. This is the mechanism that collapses a burst of messages into a single, ever-updating notification instead of one row per message.
- `markReadByEntity(userId, entityType, entityId)` — bulk `UPDATE ... SET isRead = true WHERE userId = ? AND entityType = ? AND entityId = ? AND isRead = false`.
- `findUnreadChannels(userId)` — all unread `message_received` rows for the user, ordered newest first. Feeds the sidebar directly rather than going through the paginated bell-list endpoint (which only returns the 10 most recent notifications across all types, not "every channel with something unread").

**New endpoints** (`notification.controller.ts` / `notification.routes.ts`):
- `GET /notifications/unread-channels` → `{ channelId, title, body, createdAt }[]`, one entry per channel/DM with an unread message.
- `POST /notifications/read-by-entity`, body `{ entityType: string, entityId: string }` → calls `markReadByEntity` for the current user. Generic over `entityType` so it isn't chat-specific plumbing bolted onto a one-off route, even though chat is its only caller today.

**`utils/notify.ts` addition:** `notifyNewMessage({ userId, organizationId, channelId, title, body })` — a sibling to `notifyUser()`, not a variant of it: it calls `upsertMessageNotification` instead of `create`, and its parameter list has no `email` field at all, so there is no code path by which this event type could ever send an email.

**Wiring — `channel.controller.ts`:** `sendMessage` and `uploadFile` are the only two controller functions that create `TEXT`/`FILE` messages (the `SYSTEM` messages created by `inviteChannelMember`/`removeMemberAndNotify` go through a different path entirely and are correctly never touched by this feature — a "so-and-so joined the channel" line was never meant to count as an unread message). Both gain, after creating and broadcasting the message: fetch the channel's members via `channelMemberRepository.findMembers`, excluding the sender, and call `notifyNewMessage` for each. Title is `"{sender.name} sent a message in #{channel.name}"` for `PUBLIC`/`PRIVATE` channels or `"{sender.name} sent you a message"` for `DM` channels (`channel.type === 'DM'`). Body is the message content truncated to 200 characters, or `"Sent a file: {fileName}"` for file messages.

## Real-Time Delivery & the Active-Channel Case

Reuses the existing `notification:new` socket event (emitted to `user:${recipientId}`, unchanged). Two behavioral branches added to the existing `useNotificationSocket` frontend hook:
1. When `notification.type === 'message_received'`, skip the `toast.info(...)` call that every other notification type gets — a toast per chat message would be constant noise, and the sidebar dot / bell badge are sufficient signal.
2. Always invalidate a new `['notifications', 'unread-channels']` query key (alongside the existing `['notifications', ...]` invalidations) so the sidebar updates live.

**Active-channel suppression:** if you already have a channel open when a message arrives in it, it must never flip to unread. `useNotificationSocket` has no visibility into which channel `ChatPage` currently has selected (it's mounted several component-levels up, in `DashboardLayout`), so a small new Zustand store, `src/store/chat.store.ts` (`{ activeChannelId: string | null, setActiveChannelId }`), bridges the two. `ChatPage` calls `setActiveChannelId` whenever `selectedChannel` changes (clearing it on unmount). When `useNotificationSocket` receives a `message_received` notification whose `entityId` matches `activeChannelId` (read via the store's non-reactive `getState()`, since this runs inside a socket callback, not a component render), it immediately fires the mark-read mutation for that channel instead of treating it as newly unread — so the dot never appears in the first place for the channel you're looking at.

## Frontend UI

**`useUnreadChannels()`** hook (`GET /notifications/unread-channels`) feeds both the "Channels" and "Direct Messages" lists in `ChatPage.tsx`. Each row: an unread dot (matching the existing dot styling from the notification dropdown) next to the channel/DM name, and — since the ask was specifically to show *who* messaged — a one-line bold preview beneath the name when unread (`"{senderName}: {body}"`, truncated), similar to how Slack/Discord surface the last message under a channel name. No such subtext when there's nothing unread (matches the existing "no placeholder clutter" convention from the user-profiles feature).

**Marking read:** selecting a channel (`setSelectedChannel`) fires the `read-by-entity` mutation for that channel and optimistically removes its entry from the local `unread-channels` query cache, so the dot disappears immediately rather than waiting on a round-trip.

## Error Handling & Edge Cases

- `notifyNewMessage` failures are logged and swallowed, same as `notifyUser` — a failed unread-tracking update never fails the underlying `sendMessage`/`uploadFile` request.
- `findUnreadChannels`/`markReadByEntity` are scoped to the requesting user's `userId` in the query itself, same ownership discipline as the rest of the notification system — no cross-user data exposure.
- A race between "message arrives" and "user opens the channel" at the same instant resolves to at most one extra, idempotent `read-by-entity` call — never a stuck unread state.
- Self-sent messages never notify the sender (excluded from the recipient list before calling `notifyNewMessage`).

## Testing

No test runner in this repo, consistent with prior phases. Verification is manual: `curl` for the backend (send several messages as user A in a burst, confirm user B gets exactly one `message_received` row that updates in place rather than three separate rows; confirm reading clears it from both `GET /notifications/unread-channels` and the regular notification list), and browser interaction for the frontend (two logged-in sessions — confirm the sidebar dot and preview appear live without a toast, confirm opening the channel clears it instantly, confirm a channel that's already open never flashes unread when a new message lands in it).

## Explicitly Out of Scope

Per-message notifications (deliberately collapsed into one row per channel). Email for messages. Unread *counts* (this spec is dot/boolean-plus-preview, not "3 new messages" style badges — a natural follow-up, not required now). Read receipts visible to other users (this is purely "have I read it," not "has the other person read it").
