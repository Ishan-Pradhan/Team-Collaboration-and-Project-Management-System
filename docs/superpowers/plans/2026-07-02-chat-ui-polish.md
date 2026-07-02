# Chat UI Polish (Unified Sidebar + Typing Indicators) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the chat sidebar to render Channels and Direct Messages as one unified sidebar with stacked sections (not two side-by-side columns), and add live typing indicators, per `docs/superpowers/specs/2026-07-02-chat-ui-polish-design.md`.

**Architecture:** The sidebar fix is pure JSX restructuring in `ChatPage.tsx`, no state changes. Typing indicators are the one client-originated Socket.IO event in this system (everything else is push-only after a REST write) — the server authorizes each `typing:start` against the sender's actual Socket.IO room membership (the same mechanism that already gates message delivery) and rebroadcasts as `typing:update`; the client auto-expires a typing entry 4s after the last update, so there's no `typing:stop` event and no risk of a stuck indicator.

**Tech Stack:** Socket.IO (backend + `socket.io-client`), Next.js 16 / React 19.

## Global Constraints

- No test runner exists in this repo. Verification is manual: a `socket.io-client` script for the backend, browser interaction for the frontend.
- Typing indicators are best-effort and unauthenticated-if-wrong: an unauthorized `typing:start` (channel the socket hasn't joined) is silently dropped, never errors back to the client.
- No commit message in this plan includes a `Co-Authored-By` trailer.

---

## Task 1: Backend — `typing:start`/`typing:update` with room-based authorization

**Files:**
- Modify: `backend/src/socket/index.ts`

**Interfaces:**
- Consumes: existing `AuthenticatedSocket`, existing room-join logic (Phase 1).
- Produces: `typing:update` event (`{ channelId: string; userId: string; userName: string }`) broadcast to a channel room. Consumed by Task 3 (frontend).

- [ ] **Step 1: Cache the user's name on the socket at connection time**

In `backend/src/socket/index.ts`, replace:

```ts
interface AuthenticatedSocket extends Socket {
  userId?: string;
}
```

with:

```ts
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
}
```

Then replace:

```ts
      socket.userId = user.id;
      next();
```

with:

```ts
      socket.userId = user.id;
      socket.userName = user.name;
      next();
```

- [ ] **Step 2: Add the `typing:start` listener**

In `backend/src/socket/index.ts`, replace:

```ts
    orgMemberships.forEach((m) => socket.join(`org:${m.organizationId}`));
    channelMemberships.forEach((m) => socket.join(`channel:${m.channelId}`));
  });
```

with:

```ts
    orgMemberships.forEach((m) => socket.join(`org:${m.organizationId}`));
    channelMemberships.forEach((m) => socket.join(`channel:${m.channelId}`));

    socket.on('typing:start', ({ channelId }: { channelId?: string }) => {
      if (!channelId || !socket.rooms.has(`channel:${channelId}`)) return;
      socket.to(`channel:${channelId}`).emit('typing:update', {
        channelId,
        userId: socket.userId,
        userName: socket.userName,
      });
    });
  });
```

- [ ] **Step 3: Verify with a socket.io-client script**

Start the dev server (`cd backend && npm run dev`). Using two dev accounts (`USER_A`, `USER_B`) both members of the same channel (`CHANNEL_ID`), get fresh `accessToken` cookie values for each (log in via `curl`, as in earlier phases), then:

```bash
cd backend
node -e "
const { io } = require('socket.io-client');
const socketB = io('http://localhost:8080', { extraHeaders: { Cookie: 'accessToken=USER_B_TOKEN' } });
socketB.on('connect', () => console.log('B CONNECTED'));
socketB.on('typing:update', (data) => { console.log('B RECEIVED', JSON.stringify(data)); process.exit(0); });
setTimeout(() => { console.log('TIMEOUT — no typing:update received'); process.exit(1); }, 8000);

const socketA = io('http://localhost:8080', { extraHeaders: { Cookie: 'accessToken=USER_A_TOKEN' } });
socketA.on('connect', () => {
  setTimeout(() => socketA.emit('typing:start', { channelId: 'CHANNEL_ID' }), 1000);
});
"
```

Expected: `B CONNECTED` then `B RECEIVED {"channelId":"CHANNEL_ID","userId":"<USER_A id>","userName":"<USER_A name>"}`.

Then verify the authorization check: repeat with `socketA` connected but **not** a member of some other channel (`OTHER_CHANNEL_ID`, one `USER_A` has never joined), emitting `typing:start` for that channel instead — expect `socketB` (still listening on `CHANNEL_ID`) to receive nothing and the script to hit `TIMEOUT`, confirming the unauthorized event was dropped silently.

- [ ] **Step 4: Commit**

```bash
git add backend/src/socket/index.ts
git commit -m "feat(chat): add typing:start/typing:update socket events with room-based authorization"
```

---

## Task 2: Frontend — unify the Channels/Direct Messages sidebar

**Files:**
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`

**Interfaces:**
- Consumes: existing `channels`, `dms`, `selectedChannel` state and handlers — no changes to any of them.
- Produces: single merged `<aside>`. No later task depends on this.

- [ ] **Step 1: Merge the two `<aside>` blocks into one**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`, replace:

```tsx
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
```

with:

```tsx
      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto rounded-xl border border-border-subtle bg-white">
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
        <div className="space-y-0.5 p-2">
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

        <div className="flex items-center justify-between border-b border-t border-border-subtle px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Direct Messages</span>
          <button
            onClick={() => setShowDMModal(true)}
            className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
            title="New direct message"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="space-y-0.5 p-2">
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
```

- [ ] **Step 2: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 3: Verify in the browser**

Open the chat page — expect one sidebar column (not two) containing "Channels" at top and "Direct Messages" below it, separated by a divider, both sections' items still clickable and selectable exactly as before.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx"
git commit -m "fix(chat): merge Channels and Direct Messages into one unified sidebar"
```

---

## Task 3: Frontend — send, receive, and render typing indicators

**Files:**
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx`

**Interfaces:**
- Consumes: `getSocket` (`frontend/src/lib/socket.ts`, existing), `typing:update` event (Task 1).
- Produces: fully interactive typing indicators. Last task in this plan.

- [ ] **Step 1: Import `getSocket` and add typing state**

Replace:

```tsx
import { getMessages } from '@/services/channel.service';
import { useAuthStore } from '@/store/auth.store';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { FileAttachmentCard } from './fileDisplay';
import type { Channel, Message } from '@/types/channel.types';
```

with:

```tsx
import { getMessages } from '@/services/channel.service';
import { useAuthStore } from '@/store/auth.store';
import { getSocket } from '@/lib/socket';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { FileAttachmentCard } from './fileDisplay';
import type { Channel, Message } from '@/types/channel.types';

function typingLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}
```

Replace:

```tsx
  const [content, setContent] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

with:

```tsx
  const [content, setContent] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingEmitRef = useRef(0);
```

- [ ] **Step 2: Listen for `typing:update`, auto-expiring after 4s**

Replace:

```tsx
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);
```

with:

```tsx
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  useEffect(() => {
    const socket = getSocket();
    const onTypingUpdate = (data: { channelId: string; userId: string; userName: string }) => {
      if (data.channelId !== channel.id || data.userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data.userName);
        return next;
      });
      const existing = typingTimeoutsRef.current.get(data.userId);
      if (existing) clearTimeout(existing);
      typingTimeoutsRef.current.set(
        data.userId,
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
          });
          typingTimeoutsRef.current.delete(data.userId);
        }, 4000)
      );
    };

    socket.on('typing:update', onTypingUpdate);
    return () => {
      socket.off('typing:update', onTypingUpdate);
      typingTimeoutsRef.current.forEach(clearTimeout);
      typingTimeoutsRef.current.clear();
      setTypingUsers(new Map());
    };
  }, [channel.id, user?.id]);
```

- [ ] **Step 3: Emit `typing:start`, throttled, from the composer input**

Replace:

```tsx
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile.mutate(file, {
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };
```

with:

```tsx
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile.mutate(file, {
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      lastTypingEmitRef.current = now;
      getSocket().emit('typing:start', { channelId: channel.id });
    }
  };
```

- [ ] **Step 4: Wire the input to the new handler and render the typing line**

Replace:

```tsx
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
        <input
          value={content}
          onChange={handleContentChange}
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

Then replace:

```tsx
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-subtle p-3">
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
```

with:

```tsx
      {typingUsers.size > 0 && (
        <p className="px-4 pb-1 text-xs italic text-text-secondary">
          {typingLabel([...typingUsers.values()])}
        </p>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-subtle p-3">
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
```

- [ ] **Step 5: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 6: Verify in the browser**

Open two browser sessions logged in as two different members of the same channel or DM, both with that conversation open. Start typing in session A — expect session B to show "…is typing…" above its composer within about a second. Stop typing in session A and wait 4+ seconds — expect the indicator in session B to disappear on its own (no message needs to be sent). Confirm typing in a *different* open channel in session A does not show an indicator in session B's differently-selected channel.

- [ ] **Step 7: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx"
git commit -m "feat(chat): add live typing indicators to the message pane"
```
