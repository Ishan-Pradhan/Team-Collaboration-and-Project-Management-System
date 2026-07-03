# Sidebar Notifications + Chat Unread Badge

**Status:** Approved for planning
**Scope:** Third and final piece of the notifications expansion (chat unread indicators and the real-time activity feed shipped already). Moves the personal-notifications entry point from a topbar bell/dropdown into a proper sidebar nav item accessible from every page, and adds a matching unread-count badge to the existing "Chat" sidebar link.

## Background

The first notifications sub-project put a bell icon + dropdown (`NotificationBell.tsx`) in the topbar, next to the org name. The user wants notifications accessible as a first-class sidebar destination instead — consistent with how Overview/Members/Calendar/Chat/Settings already work in `DashboardLayout.tsx`'s `navItems` array, which is rendered on every authenticated page, so a sidebar entry is inherently "accessed from all pages" without further work.

Separately, the chat-unread-indicators sub-project already built `useUnreadChannels()` (`GET /notifications/unread-channels`), which today only drives the per-channel dots inside the chat page's own sidebar. Nothing surfaces "you have unread messages" at the main navigation level — you have to already be on the Chat page to know.

One wrinkle found while scoping this: `NotificationBell.tsx` exports `resolveNotificationLink`, which `frontend/src/app/(dashboard)/notifications/page.tsx` also imports for its own row-click handling. Deleting `NotificationBell.tsx` outright would break that import, so `resolveNotificationLink` needs to move to a standalone module first.

## Design

**Remove the topbar bell.** `NotificationBell.tsx` (the dropdown component) and its mount point in `DashboardLayout.tsx`'s `<header>` are deleted — one home for notifications, not two, matching the explicit "I want it in the sidebar" direction.

**Relocate `resolveNotificationLink`** to `frontend/src/lib/notificationLinks.ts` (a plain function, no component), so both the current importer (`/notifications/page.tsx`) and nothing else needing it later have one canonical, framework-agnostic home. This is a mechanical extraction — same logic, same signature, new file.

**New sidebar nav item.** `DashboardLayout.tsx`'s `navItems` array gains a `Notifications` entry (using the `Bell` icon already used by the old topbar bell), positioned after `Overview` and before `Members` — first because it's personal/high-frequency, unlike the rest of the list which is org-structural. Unlike every other nav item, it's never `disabled` (notifications aren't org-scoped the way Members/Calendar/Chat are — they can exist even before you've selected an org), and its `href` is the static `/notifications` route rather than a `currentSlug`-dependent one.

**Unread badge component.** A small reusable `NavBadge` (`frontend/src/components/shared/NavBadge.tsx`) renders a count pill (numeric, capped at "9+", same visual treatment the old bell badge already had) or nothing when the count is zero. Two call sites:
- `Notifications` nav item: count from `useUnreadCount()` (already built, currently powers the bell).
- `Chat` nav item: count from `useUnreadChannels()`'s array length (already built, currently only used inside the chat page's own sidebar).

Both hooks are already globally available (mounted at `DashboardLayout` level via the existing `useNotificationSocket` real-time wiring), so both badges update live with zero new data-fetching work — this task is purely presentational.

## Error Handling & Edge Cases

- Before any org is selected (`currentSlug` is null, e.g. freshly logged in on `/dashboard`), `Notifications` is still enabled and reachable (notifications aren't org-scoped from the sidebar's perspective — the page itself already handles cross-org data). `Chat` stays disabled exactly as it already is today when there's no `currentSlug`, and shows no badge while disabled even if `unreadChannels` happens to be non-empty (avoids a confusing badge on a link you can't click).
- Zero unread count renders no badge at all (not a "0" pill) — matches the existing bell badge's `{!!unreadCount && (...)}` convention exactly.

## Testing

No test runner in this repo. Verification is manual: browser interaction — confirm the topbar bell is gone, confirm `Notifications` appears in the sidebar with a live-updating badge reachable from any page (including before selecting an org), confirm `Chat` shows a badge matching the chat page's own unread state, and confirm the `/notifications` page's row-click-through still works after the `resolveNotificationLink` relocation.

## Explicitly Out of Scope

Any change to the `/notifications` page's own content or layout (it already works and isn't being redesigned, just re-pointed-to). Per-nav-item preferences (e.g., muting the Chat badge). Any change to the bell's underlying data sources (`useUnreadCount`, `useUnreadChannels`) — this is purely about where they're displayed.
