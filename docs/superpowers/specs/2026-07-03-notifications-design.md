# Notifications: In-App Real-Time + Email

**Status:** Approved for planning
**Scope:** Wire up the existing-but-unused `Notification` model into a real notification system covering four event types (channel member add/remove, project member add/remove, task assignment, task comments), delivered in-app in real time via Socket.io and by email, with a bell/dropdown UI and a full notifications page.

## Background

A `Notification` table and Sequelize model already exist (`backend/src/models/notifications.model.ts`, created in migration `20260622000000-create-projects-and-related-tables.js`) with fields `userId, type, title, body, entityType, entityId, isRead, createdAt`. It is almost entirely unused today — the only call site is `notifyAdminsOfMemberLeave` in `organization.controller.ts`, which writes a row directly with no repository, no route to read it back, no socket push, and no email. There is no notification UI anywhere in the frontend.

Separately, the app already has real-time infrastructure that this feature reuses rather than duplicates: every connected socket joins a `user:${userId}` room (`backend/src/socket/index.ts`), which exists today only for potential personal pushes and isn't used for anything yet. The email service (`backend/src/services/email.service.ts`, via Resend) has three templates (verification, password reset, org invite) using a consistent inline try/catch pattern from controllers so a failed send never fails the parent request.

This spec turns on notifications for four events members already take for granted should notify someone: being added to or removed from a channel, being added to or removed from a project, having a task assigned to you, and someone commenting on a task you're assigned to.

## Data Model

One additive migration:
- `notifications.organizationId` — `UUID`, `NOT NULL`, FK → `Organizations.id`. Needed because every one of the four event types is org-scoped, and the frontend needs the org slug to build a link when a user clicks a notification. (The single existing row-creation call site, `notifyAdminsOfMemberLeave`, will be updated in the same change to pass `organizationId` — implementation confirms whether any pre-existing rows need a backfill or if the column can go straight to `NOT NULL`.)

No other schema change. `type`, `title`, `body`, `entityType`, `entityId`, `isRead`, `createdAt` already fit.

**`type` values (v1):** `channel_member_added`, `channel_member_removed`, `project_member_added`, `project_member_removed`, `task_assigned`, `task_comment_added`.

**`entityType` values (v1):** `'channel'`, `'project'`, `'task'` — paired with `entityId`, this is what the frontend uses to resolve a click target.

**`title`/`body` are pre-rendered at write time** (e.g. `title: "Alice added you to #general"`), not reconstructed from joins on read — matches how the one existing call site already works, and keeps the list/dropdown queries simple (no joins to `User` needed to display a notification).

## Backend

**`src/repositories/notification.repository.ts`** — `create`, `findByUser(userId, { page, pageSize })` (newest first), `countUnread(userId)`, `markRead(id, userId)` (scoped to the owner, no-op / 404 if the id belongs to someone else), `markAllRead(userId)`.

**`src/serializers/notification.serializer.ts`** — shapes a row for the client: `{ id, type, title, body, entityType, entityId, organizationId, isRead, createdAt }`.

**`src/controllers/notification.controller.ts`** + **`src/routes/notification.routes.ts`**, mounted at `/api/v1/notifications` (behind `verifyJWT`, same as other authenticated routes):
- `GET /` — paginated list for the current user.
- `GET /unread-count` — for the bell badge.
- `PATCH /:id/read` — mark one as read.
- `POST /mark-all-read` — mark all as read.

**`src/utils/notify.ts`** — the shared orchestration helper, living alongside `AsyncHandler`/`ApiError` as cross-cutting infrastructure rather than duplicated per call site:

```ts
notifyUser({
  userId, organizationId, type, title, body,
  entityType, entityId,
  email?: { subject, bodyText, link }, // omit to skip email for this call
}): Promise<void>
```

It writes the row via `notification.repository`, emits `notification:new` to `user:${userId}` over the existing socket connection, and — when `email` is passed — dynamically imports `email.service.ts` and sends, wrapped in try/catch so a failed send never fails the parent request or rolls back the notification row (same non-blocking pattern as `sendOrganizationInviteEmail`'s call site today). A `notifyUser` failure at the DB-write step is logged and swallowed, not thrown — a broken notification should never fail the channel-add / task-assign / etc. request that triggered it, matching the fire-and-forget philosophy `ActivityLog.log` already uses in `task.controller.ts`.

Since all four event types in this spec are decided to also send email, every `notifyUser` call site in v1 passes `email`. The helper still accepts omitting it, since `notifyAdminsOfMemberLeave`'s existing call (a fifth, pre-existing notification type, out of scope to change) stays in-app-only.

**New email template:** one generic `notificationEmailTemplate(title, bodyText, link)` in `email.service.ts`, styled consistently with the existing three templates, rather than four bespoke ones — the four event types only differ in their title/body/link, not their layout.

**Six call sites, one `notifyUser(...)` call added to each:**
- `channel.controller.ts` — member added (`inviteChannelMember`) and removed (`removeMemberAndNotify`).
- `project.controller.ts` — member added (`addProjectMember`) and removed (`removeProjectMember`). This controller doesn't import `getIO` today; this is its first socket touchpoint.
- `task.controller.ts` — assignee added during create/update (`createTask`, `updateTask`, wherever `syncAssignees` adds a new assignee), and comment created (`createComment`), notifying the task's other assignees (not the commenter).

## Real-Time Delivery

New socket event `notification:new`, emitted server-side to the existing `user:${userId}` room — no new room type needed, this room already exists and is currently idle. Payload is the serialized notification row.

**Frontend hook:** `frontend/src/hooks/useNotificationSocket.ts`, mirroring the existing `useChatSocket` pattern, mounted once in `DashboardLayout.tsx` alongside it. On `notification:new`: increments the `['notifications', 'unread-count']` query cache, invalidates `['notifications']` so an open dropdown/page picks it up, and fires `toast.info(title)` via the already-mounted `sonner` `Toaster` for an immediate live nudge.

**Query keys:** `['notifications', 'unread-count']`, `['notifications', { page }]`, per the existing convention.

## Frontend UI

**Bell + dropdown:** `Bell` icon (`lucide-react`, already a dependency, currently unused) placed in the previously-empty right side of `DashboardLayout.tsx`'s header, next to a new unread-count `Badge` primitive (`frontend/src/components/ui/badge.tsx` — none exists today; small and reusable beyond this feature). Clicking opens a dropdown built on a new `frontend/src/components/ui/dropdown-menu.tsx` primitive wrapping `@radix-ui/react-dropdown-menu` (already an installed dependency, currently unused anywhere in the codebase — the one existing dropdown, the org switcher, is hand-rolled, but that pattern doesn't hold up for a scrollable, per-item-actionable list like this one).

The dropdown shows the most recent ~10 notifications. Clicking a row marks that notification read and navigates using `entityType`/`entityId`/`organizationId` to resolve the target: `channel` → that org's chat page, `project` → that project's board, `task` → that project's board with the task panel opened via a query param. A "Mark all as read" action and a "View all" link (→ the full page) sit below the list.

**Full page:** `frontend/src/app/(dashboard)/notifications/page.tsx` — global to the user, not org-scoped (a user's notifications span every org they belong to). Paginated, reuses the same row component as the dropdown. Gets its own `loading.tsx`/`error.tsx` per the existing per-route-segment convention.

## Error Handling & Edge Cases

- A `notifyUser` DB-write failure is logged and swallowed — never propagates to fail the channel-add/project-add/task-assign/comment request that triggered it.
- Email send failure inside `notifyUser` is caught independently of the DB write — the in-app notification still gets created and pushed even if Resend is down.
- Socket push is best-effort: an offline user simply sees the unread count/dropdown update next time they load the app (via `GET /unread-count` and `GET /`), no missed-message backfill logic needed since the DB row is the source of truth.
- `PATCH /:id/read` and `POST /mark-all-read` scope every query to `WHERE userId = req.user.id` in the repository — a user can never mark, or learn the existence of, another user's notification. Requesting a foreign or nonexistent id returns `404`.
- Task comment notifications go to the task's other assignees, excluding whoever just posted the comment (no self-notification).

## Testing

No test runner exists in this repo, consistent with every prior phase this session. Verification is manual: `curl` for each of the 4 new backend routes plus confirming a notification row (with correct `organizationId`/`entityType`/`entityId`) and an email attempt for each of the 6 trigger call sites, then browser verification for the bell badge updating live across two logged-in sessions, dropdown navigation landing on the correct page, and mark-all-read clearing the badge.

## Explicitly Out of Scope

Per-user notification preferences / mute toggles (all four event types go to everyone, in-app + email, no settings UI). Notification types beyond the four listed (e.g. task due-soon/overdue — the `Task` model already has `dueSoonNotificationSent`/`overdueNotificationSent` flags but no cron job reads them; wiring that up is a separate future spec). Real-time email (email sends happen inline within the triggering request, not queued/batched/digested). Deleting notifications (only read/unread state, no delete endpoint).
