# Sidebar Notifications + Chat Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the personal-notifications entry point from a topbar bell/dropdown into a sidebar nav item reachable from every page, and add a matching unread-count badge to the existing "Chat" sidebar link.

**Architecture:** `NotificationBell.tsx` is deleted; its `resolveNotificationLink` export moves to a standalone `frontend/src/lib/notificationLinks.ts` so the `/notifications` page (its other consumer) keeps working. `DashboardLayout.tsx`'s `navItems` array gains a `Notifications` entry and a `badgeCount` field consumed by a new small `NavBadge` component, reusing the `useUnreadCount()`/`useUnreadChannels()` hooks that already exist and are already live via the socket wiring mounted at the same layout level.

**Tech Stack:** Next.js 16, React 19, TanStack Query, `lucide-react`.

## Global Constraints

- No test runner exists in this repo. Verification is manual: `tsc`, `next build`, and browser interaction.
- No commit message in this plan includes a `Co-Authored-By` trailer.
- Zero unread count renders no badge at all (not a "0" pill) — matches the bell badge's existing `{!!unreadCount && (...)}` convention.

---

## Task 1: Frontend — relocate `resolveNotificationLink`, add `NavBadge`

**Files:**
- Create: `frontend/src/lib/notificationLinks.ts`
- Modify: `frontend/src/app/(dashboard)/notifications/page.tsx`
- Create: `frontend/src/components/shared/NavBadge.tsx`

**Interfaces:**
- Consumes: `Notification` type (`frontend/src/types/notification.types.ts`, pre-existing).
- Produces: `resolveNotificationLink(notification, orgs): string | null` (moved, same signature); `NavBadge({ count }: { count?: number })`. Consumed by Task 2.

- [ ] **Step 1: Move `resolveNotificationLink` to its own module**

Create `frontend/src/lib/notificationLinks.ts`:

```ts
import type { Notification } from '@/types/notification.types';

export function resolveNotificationLink(
  notification: Notification,
  orgs: { id: string; slug: string }[] | undefined
): string | null {
  const org = orgs?.find((o) => o.id === notification.organizationId);
  if (!org) return null;

  switch (notification.entityType) {
    case 'channel':
      return `/org/${org.slug}/chat?channelId=${notification.entityId}`;
    case 'project':
      return `/org/${org.slug}/projects/${notification.entityId}`;
    case 'task':
      return notification.projectId
        ? `/org/${org.slug}/projects/${notification.projectId}?taskId=${notification.entityId}`
        : null;
    default:
      return null;
  }
}
```

- [ ] **Step 2: Update the `/notifications` page's import**

In `frontend/src/app/(dashboard)/notifications/page.tsx`, replace:

```ts
import { resolveNotificationLink } from '@/components/shared/NotificationBell';
```

with:

```ts
import { resolveNotificationLink } from '@/lib/notificationLinks';
```

- [ ] **Step 3: Write `NavBadge`**

Create `frontend/src/components/shared/NavBadge.tsx`:

```tsx
export function NavBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}
```

- [ ] **Step 4: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. `NotificationBell.tsx` still exists untouched at this point (it's deleted in Task 2) and still exports its own copy of `resolveNotificationLink` internally — that's fine, nothing imports it from there anymore after this step.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/lib/notificationLinks.ts "src/app/(dashboard)/notifications/page.tsx" src/components/shared/NavBadge.tsx
git commit -m "feat(notifications): relocate resolveNotificationLink and add NavBadge"
```

---

## Task 2: Frontend — sidebar `Notifications` item, `Chat` badge, remove the topbar bell

**Files:**
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`
- Delete: `frontend/src/components/shared/NotificationBell.tsx`

**Interfaces:**
- Consumes: `NavBadge` (Task 1), `useUnreadCount`/`useUnreadChannels` (`frontend/src/hooks/useNotification.ts`, pre-existing).
- Produces: nothing new — terminal task for this plan.

- [ ] **Step 1: Swap the `NotificationBell` import for `NavBadge` + the notification hooks, add the `Bell` icon**

Replace:

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
import Link from 'next/link';

import Logo from '@/components/shared/Logo';
import { useMyOrganizations } from '@/hooks/useOrganization';
import { useOrgStore } from '@/store/org.store';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { useOrgProjects } from '@/hooks/useProject';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { cn } from '@/lib/utils';
```

with:

```ts
import {
  Bell,
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
import Link from 'next/link';

import Logo from '@/components/shared/Logo';
import { useMyOrganizations } from '@/hooks/useOrganization';
import { useOrgStore } from '@/store/org.store';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { useOrgProjects } from '@/hooks/useProject';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { useUnreadCount, useUnreadChannels } from '@/hooks/useNotification';
import { NavBadge } from '@/components/shared/NavBadge';
import { cn } from '@/lib/utils';
```

- [ ] **Step 2: Fetch the two unread counts**

Replace:

```ts
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(activeOrg?.id || '');
  const { connected: chatConnected } = useChatSocket(activeOrg?.id);
  useNotificationSocket();
```

with:

```ts
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(activeOrg?.id || '');
  const { connected: chatConnected } = useChatSocket(activeOrg?.id);
  useNotificationSocket();
  const { data: unreadNotificationCount } = useUnreadCount();
  const { data: unreadChannels } = useUnreadChannels();
```

- [ ] **Step 3: Add the `Notifications` nav item and the `Chat` badge**

Replace:

```ts
  const navItems = [
    {
      name: 'Overview',
      href: currentSlug ? `/org/${currentSlug}` : '/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: 'Members',
      href: currentSlug ? `/org/${currentSlug}/members` : '#',
      icon: Users,
      disabled: !currentSlug,
    },
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
      ? [{
          name: 'Settings',
          href: `/org/${currentSlug}/settings`,
          icon: Settings,
          disabled: false,
        }]
      : []),
  ];
```

with:

```ts
  const navItems = [
    {
      name: 'Overview',
      href: currentSlug ? `/org/${currentSlug}` : '/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      badgeCount: unreadNotificationCount,
    },
    {
      name: 'Members',
      href: currentSlug ? `/org/${currentSlug}/members` : '#',
      icon: Users,
      disabled: !currentSlug,
    },
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
      badgeCount: currentSlug ? unreadChannels?.length : undefined,
    },
    ...(activeOrg?.ownerId === user?.id
      ? [{
          name: 'Settings',
          href: `/org/${currentSlug}/settings`,
          icon: Settings,
          disabled: false,
        }]
      : []),
  ];
```

Note: `Notifications` has no `disabled`/`currentSlug` dependency at all — it's reachable before an org is ever selected, unlike every other item in this list. `Chat`'s badge is explicitly gated on `currentSlug` (via the ternary, not just relying on the row being skipped) so a stale unread count from a previously-viewed org can never render on a disabled, unclickable row.

- [ ] **Step 4: Render the badge in the nav item**

Replace:

```tsx
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                    active
                      ? 'bg-white text-primary font-medium'
                      : 'text-white hover:bg-primary-foreground  hover:text-primary'
                  )}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
```

with:

```tsx
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                    active
                      ? 'bg-white text-primary font-medium'
                      : 'text-white hover:bg-primary-foreground  hover:text-primary'
                  )}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                  <NavBadge count={item.badgeCount} />
                </Link>
```

- [ ] **Step 5: Remove the topbar bell**

Replace:

```tsx
              {currentOrg && !chatConnected && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Reconnecting…
                </span>
              )}
            </div>
          </div>
          <NotificationBell />
        </header>
```

with:

```tsx
              {currentOrg && !chatConnected && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Reconnecting…
                </span>
              )}
            </div>
          </div>
        </header>
```

- [ ] **Step 6: Delete `NotificationBell.tsx`**

```bash
cd frontend
rm src/components/shared/NotificationBell.tsx
```

- [ ] **Step 7: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Verify with a full production build**

Run: `cd frontend && npm run build`
Expected: `✓ Compiled successfully`, no type errors, `/notifications` still listed in the route table.

- [ ] **Step 9: Verify in the browser**

Start the frontend dev server, log in, and:

1. Confirm the topbar no longer shows a bell icon anywhere.
2. Confirm a "Notifications" link appears in the sidebar (with the `Bell` icon) between "Overview" and "Members", reachable even on `/dashboard` before selecting an org.
3. With unread notifications present (from earlier testing in this session), confirm the sidebar badge shows the correct count and disappears once everything is marked read.
4. Select an org with unread chat messages (from earlier testing); confirm the "Chat" nav item shows a badge matching the count of channels/DMs with unread messages.
5. Click "Notifications" in the sidebar; confirm it lands on `/notifications` and row-click-through to the right channel/project/task still works (verifies the `resolveNotificationLink` relocation didn't break anything).

- [ ] **Step 10: Commit**

```bash
cd frontend
git add src/components/layout/DashboardLayout.tsx
git rm src/components/shared/NotificationBell.tsx
git commit -m "feat(notifications): move notifications into the sidebar, add Chat unread badge"
```
