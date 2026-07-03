# Real-Time Recent Activity Feed

**Status:** Approved for planning
**Scope:** Second of three follow-ups to the notifications work (chat unread indicators shipped already; sidebar placement/polish is the third and last). Turns the existing, currently write-only `ActivityLog` into a live, readable feed: a per-project "Activity" tab and an org-wide "Recent Activity" panel on the dashboard, both updating in real time. Distinct from the personal `Notification` system — this is a shared, project-scoped team feed, not a personal unread list.

## Background

`ActivityLog` (`backend/src/models/activityLog.model.ts`, table `activity_logs`) already exists: `projectId, actorId, type, entityType, entityId, metadata (JSONB), createdAt`. `activityLogRepository.log()` is called today from four places in `task.controller.ts` (`task_created`, `task_moved`, `task_deleted`, `comment_added`), always fire-and-forget (`.catch(() => {})`), never failing the parent request. A fifth type, `member_added`, already exists in the `ActivityLogType` union but nothing has ever logged it — project member add/remove currently only produce personal notifications, never a shared activity entry. `activityLogRepository.findByProjects(projectIds, limit)` already exists and works, but no route anywhere calls it — the whole read side is dead code.

There is currently no `project:{id}` Socket.io room. Sockets join `user:{id}`, `org:{id}` (all orgs the user belongs to), and `channel:{id}` (all channels the user belongs to) on connect (`backend/src/socket/index.ts`), but never a project-scoped room — real-time delivery for this feature needs one added, mirroring the channel pattern.

## Data Model

No schema change — `ActivityLog` already has every field needed. One behavior change: entries get a server-built, human-readable `description` string at write time (e.g. `"Alice created task \"Fix bug\""`, `"Alice moved \"Fix bug\" from To Do to In Progress"`, `"Alice added Bob to the project"`), computed once and returned by the read endpoints — not reconstructed from `metadata` on every read. This matches the notifications feature's existing "denormalize at write time" convention.

## Backend

**New socket room:** on connect, in addition to the existing room joins, fetch the user's project memberships and join `project:{projectId}` for each — same shape as the `channel:{id}` join already there.

**`activityLogRepository.log()` gains a real-time counterpart.** Rather than duplicating "log to DB, then emit" at each of the (now six) call sites, a new `logActivity()` helper in `backend/src/utils/activity.ts` wraps both steps: write via `activityLogRepository.log`, then `getIO().to('project:'+projectId).emit('activity:new', ...)`. All six call sites — the four existing ones in `task.controller.ts`, plus two new ones in `project.controller.ts`'s `addProjectMember`/`removeProjectMember` (using the previously-unused `member_added` type, and a new `member_removed` type) — call this one helper instead of `activityLogRepository.log` directly.

**Two new read endpoints**, both paginated:
- `GET /projects/:projectId/activity` — that project's feed, gated by the same project-membership check already used elsewhere (`requireProjectMembership`).
- `GET /organizations/:organizationId/activity` — aggregates across every project *the requesting user is a member of* in that org (not every project in the org — matches the project tab's access model, and matches the confirmed decision that this shouldn't leak activity from projects you can't otherwise see). Internally: look up the user's project memberships in that org (`projectRepository.findByOrgForUser`, already exists), then call the same `activityLogRepository.findByProjects` with that project-id list.

Both responses serialize each row to `{ id, description, actorName, actorAvatarUrl, projectId, projectName, entityType, entityId, createdAt }`.

## Real-Time Delivery

`activity:new` is emitted to `project:{projectId}` only — never to the org room — which is what makes the org-wide feed's access control actually enforced (not just hidden in the UI): a user's socket only ever receives events for projects it joined a room for, which is exactly the project-membership list. The per-project Activity tab and the org-wide panel are both, mechanically, "listen for `activity:new` on whichever project rooms I'm in" — the org panel just aggregates across more than one.

## Frontend

**Shared `ActivityFeed` component** (actor avatar, `description` text, relative timestamp, clickable through to the relevant task/project where `entityType`/`entityId` resolve to a route — reusing the same routing pattern already established for notifications) used in two places:
- **New "Activity" tab** on the Kanban page's existing tab bar (`Board / List / Calendar / Files` → `+ Activity`), scoped to that project.
- **New "Recent Activity" panel** on `OrgOverviewPage.tsx`, alongside the existing dashboard stat cards, scoped to the org.

A shared `useActivitySocket(projectIds)` hook joins the relevant listening state and invalidates the appropriate TanStack Query cache (`['projects', projectId, 'activity']` or `['organizations', organizationId, 'activity']`) on `activity:new`, so both surfaces update live without a manual refresh.

## Error Handling & Edge Cases

- `logActivity()` failures (DB write or socket emit) are logged and swallowed, never propagate to fail the task/member-change request that triggered them — same fire-and-forget philosophy the existing `activityLogRepository.log` calls already use.
- A user who loses project membership stops receiving that project's `activity:new` events on their *next* socket reconnect (room membership isn't re-evaluated on an already-open connection) — acceptable, matches how channel-membership changes already behave today for the same reason.
- Org-wide feed with zero project memberships in that org returns an empty list, not an error.

## Testing

No test runner in this repo. Verification is manual: `curl` for the backend (trigger each of the six event types, confirm a row with a correct human-readable `description` appears via both the per-project and org-wide endpoints, confirm a user not on the project gets neither the socket event nor a row back), and browser interaction for the frontend (two sessions, confirm the Activity tab and the org dashboard panel both update live without refreshing).

## Explicitly Out of Scope

Filtering/searching the activity feed by type or actor. Activity for channel events (channels already have their own live message-based feed — chat itself). Historical backfill for entries that predate this feature (there are none, since the read side has never been exposed). Pagination beyond a single fixed page of the 20 most recent entries per feed (matches `activityLogRepository.findByProjects`'s existing `limit = 15`-style default, bumped slightly since the org-wide feed aggregates across more than one project).
