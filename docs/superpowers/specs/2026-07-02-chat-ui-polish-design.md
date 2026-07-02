# Chat UI Polish: Unified Sidebar & Typing Indicators

**Status:** Approved for planning
**Scope:** A focused UI/UX pass on top of the already-complete 5-phase chat backend (channels, DMs, messages, reactions, files). Two changes: (1) fix the chat sidebar rendering Channels and Direct Messages as two separate side-by-side columns instead of one unified sidebar with stacked sections, and (2) add live typing indicators. Other Slack-like polish (unread badges, message grouping, presence indicators) is explicitly deferred to future passes — see Out of Scope.

## Background

`ChatPage.tsx` currently renders three flex children side by side: a Channels `<aside>`, a Direct Messages `<aside>`, and the main message view — visually reading as two full-height sidebar columns instead of Slack's single sidebar with stacked sections. Typing indicators don't exist at all. Both are pure additions on top of working infrastructure; no backend data model changes are needed for the sidebar fix, and only a small, deliberately ephemeral addition is needed for typing.

## Sidebar Layout Fix

`ChatPage.tsx`'s two `<aside>` elements (Channels, Direct Messages) merge into one `<aside className="w-64">` containing two stacked sections in a single flex column: a "Channels" section (header + "+" button + list) followed by a "Direct Messages" section (header + "+" button + list), with a `border-t` divider between them. The whole sidebar scrolls as one unit if content overflows — no per-section independent scrolling, keeping this a pure layout/structural change with no new state. All existing behavior (selecting a channel/DM, the admin-only "+" on Channels, the "+" always visible on Direct Messages, the empty-state copy) carries over unchanged, just re-parented into one container.

## Typing Indicators

**This is the one deliberate exception to this system's established rule that Socket.IO is push-only after a REST write** — there is nothing to persist for "someone is currently typing," so it's the sole client-originated socket event in the whole application.

**Client → server:** while the composer input has focus and its value changes, the client emits `typing:start` with `{ channelId }`, throttled to at most once per 2 seconds of continuous typing (not on every keystroke).

**Server:** on `typing:start`, checks `socket.rooms.has('channel:' + channelId)` — the same room-membership-as-authorization pattern already used for delivery of `message:new` etc. — and silently drops the event if the emitting socket isn't actually in that room (not a member of that channel/DM). If authorized, broadcasts `typing:update` (`{ channelId, userId, userName }`) to everyone else currently in `channel:<channelId>` (`socket.to(room)`, excluding the sender).

**Server → client, no `typing:stop`:** the receiving client tracks per-user "last seen typing" timestamps and auto-expires an entry 4 seconds after its last `typing:update`. This is simpler than a paired start/stop protocol and self-heals if a tab closes or the network drops mid-type — no risk of a "stuck" typing indicator.

**Rendering:** entirely inside `MessagePane.tsx` (not the global `useChatSocket` hook), since only the currently-open channel's typing state is ever visible on screen. A small muted line ("Alice is typing…" / "Alice and Bob are typing…" / "3 people are typing…" for 3+) appears directly above the composer input, replaced by nothing when the set is empty. No new Zustand store, no new query — this is transient UI state local to the mounted `MessagePane`.

## Error Handling & Edge Cases

- A `typing:start` for a channel the socket hasn't joined (not a member) → silently dropped server-side, no error emitted back (typing indicators are best-effort, not a request/response flow — matches how no other push event in this system acks either).
- Switching channels while someone's typing indicator is showing → `MessagePane` unmounts/remounts per channel (existing behavior), so stale typing state from the previous channel can't leak into the new one.
- A user typing in a DM/channel with no one else present → no one receives the broadcast; harmless no-op.

## Testing

No test runner exists in this repo, consistent with all prior chat phases. Verification is manual: a small `socket.io-client` script for the server-side room-authorization check, and browser interaction (two sessions) for the full typing-indicator round trip and the sidebar layout.

## Explicitly Out of Scope (this pass)

Unread badges/bold-unread state, consecutive-message grouping, and presence/online indicators — each is a real Slack feature but needs its own state-tracking design (last-read-at, message-grouping rules, connection-state broadcasting respectively) and is better scoped as its own follow-up pass than bundled into this one.
