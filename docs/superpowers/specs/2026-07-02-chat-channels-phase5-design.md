# Chat — Phase 5: Org-Level Ban

**Status:** Approved for planning
**Scope:** Fifth and final phase of the chat roadmap (channels → message actions → file sharing → private DMs → **org-level ban**). Adds a permanent, org-wide ban on top of the kick capability that already exists (`removeOrganizationMember`, Phase 1).

## Background

The original chat request listed "org-level ban/kick" together. Kick shipped in Phase 1 (`removeOrganizationMember` destroys the membership and cascades the user out of every org channel). Ban is the remaining piece: kick a member *and* permanently prevent them from rejoining this organization until an admin explicitly reverses it. `Organization.isSuspended` is unrelated — that's a platform-level flag for suspending an entire org, not a per-user restriction, and this phase does not touch it.

## Architecture

No new transport, no chat-specific changes at all — this is an organization-membership feature, not a channel/message feature. It lives in `organization.controller.ts`/`organization.repository.ts`/`organization.routes.ts`, alongside the existing member-management endpoints, and reuses the existing kick logic (destroy membership → cascade out of channels → notify admins) rather than duplicating it.

## Data Model

New table `organization_bans`, one row per ban:

- `id` (uuid, PK)
- `organizationId` (uuid, FK → Organization, `ON DELETE CASCADE`)
- `userId` (uuid, FK → User, `ON DELETE CASCADE`) — the banned person
- `bannedBy` (uuid, FK → User, `ON DELETE SET NULL`) — who issued the ban
- `createdAt`

Unique index on `(organizationId, userId)` — a user can only have one active ban per org; banning twice is rejected rather than silently updating. No `reason` field and no `updatedAt` (bans aren't edited, only created and deleted) — matches the codebase's existing moderation actions (kick, org suspend), none of which capture a reason either.

## API Surface

New routes on `organization.routes.ts`, gated by the existing `isOrganizationAdmin` middleware (owner or `ORG_ADMIN`) — the same authority tier as the existing kick endpoint:

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/organizations/:organizationId/members/:userId/ban` | Bans a **current member**: runs the exact same removal sequence as `removeOrganizationMember` (destroy membership, cascade out of all channels, notify admins), then inserts the ban record. Rejects banning the org owner (`400`). Checks for an existing ban **first**, before the membership lookup — since banning destroys membership, an already-banned user has no current membership, so checking ban status first is what makes "already banned" (`400`) distinguishable from "never a member" (`404`) rather than both collapsing to the same 404. |
| `DELETE` | `/organizations/:organizationId/bans/:userId` | Unban — deletes the ban record only. Does **not** restore membership; a fresh invite is required for them to rejoin. `404` if no active ban exists. |
| `GET` | `/organizations/:organizationId/bans` | Lists banned users for this org (id, name, email, `bannedBy`, `createdAt`) — powers an admin-facing "Banned Users" panel. |

Two existing endpoints gain a ban check:
- **Invite creation**: inviting a banned user (matched by user ID if they have an account, else by email) → `400 "This user is banned from this organization"`.
- **Invite acceptance**: re-checked at accept time (not just at invite time), so a ban issued after the invite was sent but before it's accepted still blocks the join → `400`.

To avoid duplicating the destroy/cascade/notify sequence between kick and ban, the shared logic in `removeOrganizationMember` is extracted into a helper function that both the existing kick endpoint and the new ban endpoint call.

## Permission Rules

- Ban/unban/list-bans: `ORG_ADMIN` or the org owner — identical authority to the existing kick endpoint, no new permission tier.
- Cannot ban the org owner (existing kick guard, reused).
- Cannot ban an already-banned user; cannot unban a user with no active ban.

## Frontend

- **Members management UI** (wherever the existing kick/"Remove" action lives): add a "Ban" action alongside it, using the same confirmation-dialog pattern as kick, with copy that makes the permanence clear (e.g. "Ban this member? They will be removed and cannot rejoin unless unbanned.").
- **New "Banned Users" panel** in org settings: a simple list (name/email, banned-by, date) with an "Unban" button per row — mirrors the existing members-list UI patterns already in the codebase, backed by `GET .../bans`.
- **Invite flow**: attempting to invite a banned user surfaces the backend's `400` message via the existing `parseApiError`/`toast.error` pattern, no new UI needed.

## Error Handling & Edge Cases

- Banning the org owner → `400`.
- Banning an already-banned user → `400` (checked before the membership lookup, per API Surface above).
- Banning a user with no current membership and no active ban (never joined, or was kicked without being banned) → `404` (ban only operates on current members, mirroring kick's existing precondition — there's no "pre-ban someone who was never a member" flow in this phase).
- Unbanning a user with no active ban → `404`.
- Inviting a banned user (by user ID or by email if they have no account yet) → `400`.
- Accepting an invite while banned (ban issued after invite, before accept) → `400`.
- Non-admin attempting any ban/unban/list action → `403` via the existing `isOrganizationAdmin`.

## Testing

No test runner exists in this repo, consistent with Phases 1-4. Verification is manual: `curl` against a running dev server for the backend, and browser interaction for the frontend.

## Explicitly Out of Scope (this phase)

Ban reasons/notes, banning by email pre-emptively (before any account/membership exists), self-service unban requests, and any chat-specific (channel-level) ban — this phase is a straight org-membership feature, matching how the original spec framed it as "org-level ban." This is also the last of the five originally planned chat phases.
