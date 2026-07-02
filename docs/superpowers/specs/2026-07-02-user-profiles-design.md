# User Profiles: Bio, Job Title, and Viewing Other Members

**Status:** Approved for planning
**Scope:** Add `bio`/`jobTitle` fields to the User model, extend self-profile editing to cover them, and add a reusable profile-viewing dialog reachable from every place a user's name/avatar appears (chat messages, DM list, channel members, org members page), with a "Message" action that deep-links into chat.

## Background

The app already has a self-profile settings page (`frontend/src/app/profile/_components/ProfilePage.tsx`) for editing your own name/avatar/password, but the `User` model has no `bio` or `jobTitle` fields, and there is no way to view *another* user's profile at all. This spec adds both: the missing fields, and a lightweight profile-viewing dialog usable from anywhere in the app a user is shown, since that visibility already spans chat (built this session) and the org members page (pre-existing).

## Data Model

Two nullable columns added to the existing `Users` table via a new migration:
- `bio` (`TEXT`, nullable)
- `jobTitle` (`STRING(150)`, nullable)

No new table. Both are optional — a user with neither set simply shows nothing for those fields in the profile dialog (no placeholder text like "No bio set").

## API Surface

**Self-edit (extend existing endpoint):** `PATCH /auth/profile` (`backend/src/controllers/auth.controller.ts`'s `updateProfile`) accepts optional `bio` and `jobTitle` alongside the existing `name`, all independently optional — a request can update any subset. `userRepository.update`'s allowed-fields type widens from `Pick<Users, 'name' | 'avatarUrl'>` to include `'bio' | 'jobTitle'`.

**Viewing another user (new endpoint):** `GET /organizations/:organizationId/members/:userId/profile`, gated by the existing `isOrganizationMember` middleware (same visibility as the current members list — any member of a shared org can view any other member's profile). Returns:

```
{ id, name, email, avatarUrl, bio, jobTitle, orgRole, joinedAt }
```

`orgRole` is a display string resolved server-side — `'Owner'` if `organizationId`'s `ownerId` matches, else `'Admin'` or `'Member'` from the `OrganizationMember` role — deliberately distinct from and never conflated with the platform-level `User.role` (`'USER' | 'SUPER_ADMIN'`), which this endpoint never exposes. Scoping by organization (rather than a bare `/users/:id`) is what lets one endpoint serve every entry point below, since everywhere a user appears in this app is already inside an org context.

## Frontend

**Self-edit:** `ProfilePage.tsx`'s existing name-edit form gains a Bio (`<textarea>`, e.g. 300 char cap) and Job Title (`<Input>`, e.g. 100 char cap) field, saved through the extended `useUpdateProfile` mutation alongside name.

**`UserProfileDialog`** (new, `frontend/src/components/shared/UserProfileDialog.tsx`): a reusable modal taking `{ userId, organizationId, onClose }` props. Fetches `GET .../members/:userId/profile` on open (a plain `useQuery`, key `['organizations', organizationId, 'members', userId, 'profile']`) and renders avatar, name, an org-role badge, job title, bio, email, and a **Message** button. Loading state: a small spinner in place of the content, matching the codebase's existing modal-loading convention (see `ManageChannelMembersModal`).

**Entry points** — clicking the **avatar** (not the full row, where the row already has its own primary click action) opens `UserProfileDialog` with that user's id and the current org id:
- `MessagePane.tsx` — the sender avatar on each message bubble.
- `ChatPage.tsx` — the DM sidebar list avatar (the rest of the row still selects that DM on click, unchanged).
- `ManageChannelMembersModal.tsx` — each member row's avatar.
- `MembersPage.tsx` (org settings) — each member row's avatar.

**Message button / cross-page deep link:** since the dialog can be opened from a page other than chat (the org Members page), clicking **Message** calls `router.push('/org/<slug>/chat?dmUserId=<targetUserId>')` and closes the dialog. `ChatPage.tsx` gains a small effect: once `dms` has loaded, if a `dmUserId` search param is present, it looks for an existing DM with that participant in the loaded `dms` list and selects it if found, otherwise calls the existing `useStartDM` mutation to create one and selects the result — then strips the query param via `router.replace` so it doesn't re-fire on subsequent renders or a later back-navigation. If the dialog is opened *from* the chat page itself, the same push-then-effect path is used uniformly rather than special-casing an in-page shortcut — one code path, no duplicated "select this DM" logic.

## Error Handling & Edge Cases

- Viewing a profile for a user who isn't in the requesting user's org (shouldn't be reachable via any entry point, all of which are already org-scoped) → `403` via `isOrganizationMember`, surfaced as a toast if it somehow occurs.
- A user with no `bio`/`jobTitle` set → those fields simply don't render in the dialog (no empty-state placeholder clutter).
- Viewing your own profile via one of these entry points (e.g. clicking your own avatar on a message you sent) → `UserProfileDialog` still opens and shows your info, but hides the Message button when `userId === currentUser.id` — one guard inside the dialog itself, rather than suppressing the click at each of the four entry points separately (matching the "one code path" approach used for the deep-link above).
- `dmUserId` query param pointing at a user no longer in the org → the existing `startDM` `400` ("User is not a member of this organization") surfaces as a toast, same as starting a DM normally.

## Testing

No test runner exists in this repo, consistent with every prior phase this session. Verification is manual: `curl` for the backend, browser interaction for the frontend.

## Explicitly Out of Scope

Editable-by-admin bio/job title for other users (self-edit only), a dedicated full-page profile view (dialog only, per the approved design), and any social features (following, activity feed, etc.).
