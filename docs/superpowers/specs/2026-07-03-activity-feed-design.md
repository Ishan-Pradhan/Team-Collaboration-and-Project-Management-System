# Real-Time Recent Activity Feed

**Status:** Approved for planning
**Scope:** Second of three follow-ups to the notifications work (chat unread indicators shipped already; sidebar placement/polish is the third and last). Turns the existing, currently write-only `ActivityLog` into a live, readable feed: a per-project "Activity" tab and an org-wide "Recent Activity" panel on the dashboard, both updating in real time. Distinct from the personal `Notification` system — this is a shared, project-scoped team feed, not a personal unread list.

## Background

`ActivityLog` (`backend/src/models/activityLog.model.ts`, table `activity_logs`) already exists: `projectId, actorId, type, entityType, entityId, metadata (JSONB), createdAt`. `activityLogRepository.log()` is called today from four places in `task.controller.ts` (`task_created`, `task_moved`, `task_deleted`, `comment_added`), always fire-and-forget (`.catch(() => {})`), never failing the parent request.

**Correction found during planning:** the read side is *not* dead code — it's further along than initially assumed. `dashboardRepository.getDashboardData` (`backend/src/repositories/organization.repository.ts`) already queries `ActivityLog` scoped to the user's project memberships in that org (functionally identical to what this spec was going to build as a new endpoint) and returns it as `recentActivity` from the existing `GET /organizations/:organizationId/dashboard` endpoint. `OrgOverviewPage.tsx` already renders it in a "Recent Activity" section, with a `buildActivityText()` switch statement and an `ACTIVITY_ICON` map that both already have a `member_added` case — fully built and just waiting for a backend caller. What's actually missing is narrower than originally scoped: (1) nothing ever calls `activityLogRepository.log()` for project membership changes, so `member_added` has never fired; (2) nothing is real-time — the dashboard is fetched once, never pushed to; (3) there's no per-project view, only the org-wide dashboard aggregate; (4) `activityLogRepository.findByProjects(projectIds, limit)` is real and used internally by `dashboardRepository`, but no route exposes a *single-project* activity list for the new project-level tab.

There is currently no `project:{id}` Socket.io room. Sockets join `user:{id}`, `org:{id}` (all orgs the user belongs to), and `channel:{id}` (all channels the user belongs to) on connect (`backend/src/socket/index.ts`), but never a project-scoped room — real-time delivery for this feature needs one added, mirroring the channel pattern.

## Data Model

No schema change. `type` stays a raw string column (`STRING(50)`, no DB-level enum constraint), so widening `ActivityLogType` to add `member_removed` (alongside the already-present but never-fired `member_added`) is a TypeScript-only change. Description text is **not** denormalized at write time — reversing this spec's original plan now that the existing, working convention is discovered: `buildActivityText()` already builds display text client-side from raw `type` + `metadata` at render time, and that function just needs a `member_removed` case added alongside its existing `member_added` one. Reusing the established pattern instead of introducing a second, server-side description-building path avoids two divergent implementations of the same thing.

## Backend

**New socket room:** on connect, in addition to the existing room joins, fetch the user's project memberships and join `project:{projectId}` for each — same shape as the `channel:{id}` join already there.

**`activityLogRepository.log()` gains a real-time counterpart.** Rather than duplicating "log to DB, then emit" at each of the (now six) call sites, a new `logActivity()` helper in `backend/src/utils/activity.ts` wraps both steps: write via `activityLogRepository.log`, then `getIO().to('project:'+projectId).emit('activity:new', { projectId })` (a minimal payload — just enough for listeners to know which project changed and invalidate the right query; the actual row is fetched through the existing read paths below, not pushed inline). All six call sites — the four existing ones in `task.controller.ts`, plus two new ones in `project.controller.ts`'s `addProjectMember`/`removeProjectMember` (using the previously-unused `member_added` type, and a new `member_removed` type) — call this one helper instead of `activityLogRepository.log` directly.

**One new read endpoint:** `GET /projects/:projectId/activity` — a single project's feed (up to 20 entries), gated by the same project-membership check `getProject` already uses, calling the existing `activityLogRepository.findByProjects([projectId], 20)`. This is genuinely new — it's what powers the per-project Activity tab, which has no equivalent today.

**The org-wide feed needs no new endpoint** — `GET /organizations/:organizationId/dashboard` (`dashboardRepository.getDashboardData`) already returns `recentActivity` sourced from `ActivityLog`, scoped to the user's project memberships in that org, exactly matching the access-control decision made earlier in this spec. The only backend gap for the org-wide surface is real-time delivery (below) — the read side is already correct and shipped.

## Real-Time Delivery

`activity:new` is emitted to `project:{projectId}` only — never to the org room — which is what makes the org-wide feed's access control actually enforced (not just hidden in the UI): a user's socket only ever receives events for projects it joined a room for, which is exactly the project-membership list.

Two listeners consume this, both invalidating rather than manually patching cache (the payload is minimal by design, so a refetch is the simplest correct response):
- The org dashboard: a small addition to `OrgOverviewPage.tsx` invalidates `useOrgDashboard`'s query key on `activity:new` for any project among the user's org projects.
- The new per-project Activity tab: invalidates `['projects', projectId, 'activity']` when the event's `projectId` matches the currently-open project.

## Frontend

**No new description-rendering component** — `buildActivityText()` and `ACTIVITY_ICON` (currently private to `OrgOverviewPage.tsx`) already do this correctly and just need a `member_removed` case added alongside the existing `member_added` one. Both get extracted to a shared module, `frontend/src/components/shared/activityText.tsx`, so the new per-project tab can reuse them instead of duplicating the switch statement. `ActivityRow` (the per-entry list item — avatar, text, icon, project link, relative time) gets extracted the same way, to `frontend/src/components/shared/ActivityRow.tsx`, parameterized so the project-tab context can omit the now-redundant project-name link (you're already on that project's page).

**New "Activity" tab** on the Kanban page's existing tab bar (`Board / List / Calendar / Files` → `+ Activity`), using the new `GET /projects/:projectId/activity` endpoint and the extracted `ActivityRow`.

**Existing "Recent Activity" panel** on `OrgOverviewPage.tsx` stays exactly where it is and keeps using `useOrgDashboard` — it just starts invalidating live instead of only loading once.

## Error Handling & Edge Cases

- `logActivity()` failures (DB write or socket emit) are logged and swallowed, never propagate to fail the task/member-change request that triggered them — same fire-and-forget philosophy the existing `activityLogRepository.log` calls already use.
- A user who loses project membership stops receiving that project's `activity:new` events on their *next* socket reconnect (room membership isn't re-evaluated on an already-open connection) — acceptable, matches how channel-membership changes already behave today for the same reason.
- Org-wide feed with zero project memberships in that org returns an empty list, not an error.

## Testing

No test runner in this repo. Verification is manual: `curl` for the backend (trigger each of the six event types, confirm a row appears via both the new per-project endpoint and the existing org dashboard endpoint, confirm a user not on the project gets neither the socket event nor a row back), and browser interaction for the frontend (two sessions, confirm the Activity tab and the org dashboard panel both update live without refreshing).

## Explicitly Out of Scope

Filtering/searching the activity feed by type or actor. Activity for channel events (channels already have their own live message-based feed — chat itself). Historical backfill for entries that predate this feature (there are none, since the read side has never been exposed). Pagination beyond a single fixed page of the 20 most recent entries per feed (matches `activityLogRepository.findByProjects`'s existing `limit = 15`-style default, bumped slightly since the org-wide feed aggregates across more than one project).
