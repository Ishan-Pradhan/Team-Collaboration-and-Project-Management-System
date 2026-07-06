# Super Admin Panel & Org Feature Toggles

**Status:** Approved for planning
**Scope:** A platform-level admin panel (own route group, gated on `role === 'SUPER_ADMIN'`) covering a stats dashboard, organization management, user management, and a generic per-organization feature-toggle system with two real flags (`chatEnabled`, `calendarEnabled`). Every mutating admin action is audited and, where it targets an org, notifies that org's owner. No content (task text, chat messages, personal events) is ever visible to super admin — only counts/metadata.

## Background

The backend already has more of this than it looks like: `User.role` is a `USER_ROLES.SUPERADMIN` / `USER_ROLES.USER` enum (`src/constants/index.ts`), `isAdmin`/`isSuperAdmin` middleware exists (`src/middlewares/auth.middleware.ts`), and `src/routes/admin.routes.ts` already exposes `GET /admin/users`, `GET /admin/stats`, `PATCH /admin/toggle-block/:id`, `GET /admin/organizations`, `PATCH /admin/organizations/:organizationId/toggle-suspend`. What's missing: any frontend for it (no `/admin` page exists — the role is only shown as a label in `ProfilePage.tsx`), a feature-flag mechanism on `Organization` (today it only has `isSuspended`), and any audit trail for admin actions. This spec fills those gaps; it does not touch the existing `isAdmin`/`isSuperAdmin` middleware or rename anything.

Two existing tables were considered and rejected as homes for new admin data:
- `ActivityLog` (`src/models/activityLog.model.ts`) is hard-wired to `projectId` (not-null) and a task-specific `type` union (`task_created` etc.) — overloading it for platform-level actions would violate its own type contract.
- Reusing `Notification` for the audit trail itself doesn't fit either (`Notification` is a per-user inbox row, not a queryable action log) — but it's exactly right for the "notify the org owner" requirement, and is reused as-is with a new `type`.

## Design Principles

- No content access, ever: org detail and stats surfaces only ever emit counts (`memberCount`, `taskCount`, ...), never task/message/event bodies. Personal events are excluded from every admin-facing count, not just hidden in the UI — they don't appear in any query at all.
- Every admin mutation is logged (new `AdminActionLog` table) and, when it targets an org, triggers a `Notification` to that org's `ownerId` — no silent changes to a team's setup.
- Feature flags live in a single JSONB column (`Organization.featureFlags`), not a new table — new flags are addable later without a migration, while a typed TS interface keeps call sites from treating it as an untyped bag.
- Disabling a flag hides the corresponding nav item for org members entirely (no dead links / disabled-state UI to build).
- `SUPER_ADMIN` promotion/demotion is admin-UI-driven (existing super admins can promote), consistent with `isAdmin` already gating on the same role check — no separate seed-only path.

## 1. Data model changes

### `Organization.featureFlags` (new column)

Migration adds `featureFlags JSONB NOT NULL DEFAULT '{"chatEnabled": true, "calendarEnabled": true}'` to `Organizations`. Typed in `src/types/organizations.types.ts` as:
```ts
export interface OrganizationFeatureFlags {
  chatEnabled: boolean;
  calendarEnabled: boolean;
}
```
`OrganizationInstance`'s attributes gain `featureFlags: OrganizationFeatureFlags`.

### `AdminActionLog` (new table)

New model `src/models/adminActionLog.model.ts`, `tableName: 'admin_action_logs'`, `updatedAt: false` (mirrors `ActivityLog`'s append-only shape):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `actorId` | UUID, not null | the super admin who performed the action |
| `action` | STRING(50), not null | `'user_blocked' \| 'user_unblocked' \| 'user_promoted' \| 'user_demoted' \| 'org_suspended' \| 'org_unsuspended' \| 'feature_toggled'` |
| `targetType` | STRING(20), not null | `'user' \| 'organization'` |
| `targetId` | UUID, not null | |
| `metadata` | JSONB, nullable | e.g. `{ flag: 'chatEnabled', newValue: false }` for `feature_toggled` |
| `createdAt` | timestamp | |

No association wiring needed beyond the plain FK-shaped columns (mirrors how `ActivityLog.actorId`/`projectId` are stored — no `belongsTo` required for this spec's read patterns, which always join to `User`/`Organization` manually in the repository for display names).

## 2. Backend changes

All new routes live in the existing `src/routes/admin.routes.ts`, gated the same way as today: `verifyJWT, isAdmin`.

- **`GET /admin/stats`** (extend existing `getUserStats`): add `totalOrganizations`, `totalProjects`, `totalTasks`, `suspendedOrgs` alongside the existing `totalUsers`/`blockedUsers`/`adminUsers`. New repository methods (`organizationRepository.count()`, a `projectRepository`/`taskRepository` count, `organizationRepository.count({ where: { isSuspended: true } })`).
- **`GET /admin/stats/growth?days=30`** (new): daily counts of new users and new orgs over the window, grouped by `DATE(createdAt)`. Backs the frontend trend chart.
- **`GET /admin/organizations/:organizationId`** (new): org detail — `memberCount`, `projectCount`, `taskCount`, `attachmentCount`, `lastActivityAt` (max of the org's `ActivityLog.createdAt` across its projects), plus the org's own fields (`name`, `slug`, `isSuspended`, `featureFlags`, owner). No personal-event count anywhere in this payload.
- **`PATCH /admin/organizations/:organizationId/features`** (new): body `{ flag: 'chatEnabled' | 'calendarEnabled', enabled: boolean }`, validated via a new Zod schema in `src/validations/admin.validation.ts`. Merges into `featureFlags`, saves, writes an `AdminActionLog` row (`action: 'feature_toggled'`), and calls `notificationRepository.create` targeting the org's `ownerId` (`type: 'org_feature_toggled'`, title e.g. `"Chat has been disabled for your organization"`).
- **`PATCH /admin/users/:id/promote`** and **`/demote`** (new): sets `user.role` to `SUPER_ADMIN`/`USER`, writes `AdminActionLog` (`action: 'user_promoted' | 'user_demoted'`). No self-demotion guard needed beyond what already exists — out of scope to add new safety rails around this since it wasn't asked for; the implementation plan can flag it if it looks like an easy one-liner.
- **`GET /admin/audit-log`** (new): paginated `AdminActionLog` feed, newest first, joined to `User` (actor) and target display name, using the existing `getPaginationParams`/`buildPaginationMeta` helpers already used by `getAllUsers`.
- **Existing `toggleBlockUserSchema`/`blockAndUnblockUser`** and **`toggleSuspendOrganization`** each gain one line: write an `AdminActionLog` row after the existing save, and (suspend/unsuspend only) notify the org owner. `blockAndUnblockUser` targets a user directly, not an org, so no owner-notification applies there.

### Feature-flag enforcement

`isOrganizationMember`, `isChannelMember`, and `isChannelOrgAdmin` (`src/middlewares/auth.middleware.ts`) each already load the `Organization` row and inline-check `if (org.isSuspended) throw new ApiError(403, ...)` right after the lookup. The flag checks are added the same way, right next to that existing line, rather than as a separate bolt-on middleware — a standalone `requireFeatureEnabled` applied only at org-scoped entry routes would miss every channel-scoped route (messages, reactions, files, DMs), which resolve their org via `channel.organizationId` inside `isChannelMember`/`isChannelOrgAdmin` and never pass through the org-scoped route at all:

- `isChannelMember` and `isChannelOrgAdmin`: add `if (!org.featureFlags.chatEnabled) throw new ApiError(403, 'Chat has been disabled for this organization');` next to the existing `isSuspended` check. Since every channel-scoped operation (list/create channels, messages, reactions, files, DMs, mute) passes through one of these two, this single change covers all of it.
- `isOrganizationMember` is shared by unrelated routes (projects, tasks, dashboard) and must **not** get a blanket flag check. Instead, `src/routes/personalEvent.routes.ts`'s three routes (all directly org-scoped, no separate per-event middleware layer) get a small inline check added to `src/controllers/personalEvent.controller.ts`'s three handlers (load org, check `featureFlags.calendarEnabled`, mirroring how the controller already 404s on ownership) — or, if cleaner during implementation, a new thin `requireFeatureEnabled('calendarEnabled')` middleware scoped to just these three routes (not reused elsewhere, so no risk of over-applying it).

## 3. Frontend changes

- New route group `frontend/src/app/(admin)/admin/layout.tsx`: reads `useAuthStore`, redirects to `/` if `user.role !== 'SUPER_ADMIN'` (mirrors the existing `(dashboard)/layout.tsx` guard pattern, but checking role instead of `isAuthenticated`). Independent of `DashboardLayout` — no org slug involved.
- `frontend/src/services/admin.service.ts` + `frontend/src/hooks/useAdmin.ts` — query hooks following the existing service/hook pairing (`useAdminStats`, `useAdminGrowth`, `useAdminOrganizations`, `useAdminOrganization(id)`, `useAdminUsers`, `useAuditLog`, plus mutations `useToggleOrgFeature`, `usePromoteUser`, `useDemoteUser`, and existing `useToggleBlockUser`/`useToggleSuspendOrg` if not already present on the frontend — confirm during planning since the backend endpoints predate this spec).
- Query keys: `['admin', 'stats']`, `['admin', 'stats', 'growth']`, `['admin', 'organizations']`, `['admin', 'organizations', orgId]`, `['admin', 'users']`, `['admin', 'audit-log']` — namespaced under `'admin'` to keep them out of the existing org-scoped key space.
- Pages:
  - `/admin` — stat cards (`totalOrganizations`, `totalUsers`, `totalProjects`, `totalTasks`, `suspendedOrgs`, `blockedUsers`) + a line chart (new/users/orgs per day, last 30 days) using whatever charting approach the frontend already has (check for an existing chart dependency during planning; if none, this is the one new frontend dependency this spec introduces).
  - `/admin/organizations` — table (name, owner, member count, suspended badge), row click opens a detail view/drawer with counts + a suspend toggle + the two feature-flag toggles.
  - `/admin/users` — table (name, email, role badge, blocked badge), row actions: block/unblock, promote/demote (promote/demote behind a confirm dialog, since it's a privileged action).
  - `/admin/audit-log` — simple reverse-chronological table: actor, action, target, timestamp.
- `DashboardLayout` (existing): its org-fetch already returns the org object; nav items for chat/calendar become conditional on `org.featureFlags.chatEnabled` / `org.featureFlags.calendarEnabled`. Requires `featureFlags` to be included wherever the frontend's `Organization` type/fetch currently omits it (`frontend/src/types/organization.types.ts` and whichever hook fetches the current org).

## Files touched

Backend:
- Create: `src/models/adminActionLog.model.ts`, migration for `admin_action_logs` table, migration adding `featureFlags` to `Organizations`
- Modify: `src/models/index.ts` (no new associations required, but confirm during planning), `src/types/organizations.types.ts` (`OrganizationFeatureFlags`)
- Modify: `src/controllers/admin.controller.ts` (extend stats, add growth/org-detail/promote/demote/audit-log/feature-toggle handlers), `src/controllers/organization.controller.ts` (`toggleSuspendOrganization` gains audit log + notify)
- Modify: `src/routes/admin.routes.ts` (new routes); `src/routes/personalEvent.routes.ts` only if the implementation picks the standalone-middleware option
- Modify: `src/middlewares/auth.middleware.ts` (`isChannelMember`, `isChannelOrgAdmin` gain the `chatEnabled` check next to their existing `isSuspended` check; optionally a scoped `requireFeatureEnabled` for personal events)
- Modify: `src/controllers/personalEvent.controller.ts` (calendarEnabled check, if not done via middleware)
- Modify: `src/validations/admin.validation.ts` (new schemas)
- Create/modify: `src/repositories/organization.repository.ts` (counts, `findByIdWithCounts`, `updateFeatureFlags`), `src/repositories/users.repository.ts` (extend `getUsersStats` or add org/project/task counts elsewhere as appropriate), new `src/repositories/adminActionLog.repository.ts`
- Modify: `src/repositories/notification.repository.ts` usage sites only (no schema change — reuses existing `create`)

Frontend:
- Create: `app/(admin)/admin/layout.tsx`, `app/(admin)/admin/page.tsx`, `app/(admin)/admin/organizations/page.tsx`, `app/(admin)/admin/users/page.tsx`, `app/(admin)/admin/audit-log/page.tsx`
- Create: `services/admin.service.ts`, `hooks/useAdmin.ts`, `types/admin.types.ts`
- Modify: `types/organization.types.ts` (add `featureFlags`), `components/.../DashboardLayout` (conditional nav)

## Explicitly out of scope

- The actual AI feature — no `aiEnabled` flag in v1; only `chatEnabled`/`calendarEnabled` exist. Adding a new flag later is a small, additive change by design.
- Billing/plan tiers, seat limits, org deletion, ownership transfer.
- Time-series depth beyond 30-day daily granularity; no custom date ranges.
- Any change to `ActivityLog` or its type enum.
- Self-demotion / last-super-admin-standing guards (flagged above as an easy follow-up, not built here).
- "Show disabled feature with a message" UX — features are hidden outright, not shown-but-blocked.

## Testing

No test runner in this repo. Manual, in-browser + direct-API verification:

1. Log in as a `SUPER_ADMIN` user, navigate to `/admin` — confirm stat cards match actual DB counts and the growth chart renders.
2. As a non-super-admin, navigate to `/admin` directly — confirm redirect.
3. From `/admin/organizations`, suspend an org — confirm `isSuspended` flips, an `AdminActionLog` row is created, and the org owner receives a notification.
4. From the same screen, toggle `chatEnabled` off for an org — confirm: (a) `AdminActionLog` row + owner notification, (b) a member of that org no longer sees the Chat nav item, (c) hitting the channels API directly for that org now 403s.
5. Toggle `calendarEnabled` off — same three checks for personal events/calendar.
6. From `/admin/users`, block a user — confirm they can no longer log in, and an audit row exists. Promote a user to `SUPER_ADMIN` — confirm they can now access `/admin`.
7. Open `/admin/audit-log` — confirm all of the above actions appear, newest first, with correct actor/target.
8. Confirm no endpoint anywhere in this spec returns task titles, message bodies, or personal event data — only counts.
