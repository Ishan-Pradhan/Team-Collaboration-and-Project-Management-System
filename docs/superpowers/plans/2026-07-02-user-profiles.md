# User Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `bio`/`jobTitle` to the User model, extend self-profile editing to cover them, and add a reusable profile-viewing dialog reachable from every place a user's avatar appears in the app, per `docs/superpowers/specs/2026-07-02-user-profiles-design.md`.

**Architecture:** Two new nullable columns on the existing `Users` table. Self-edit extends the existing `PATCH /auth/profile` endpoint. Viewing another user is a new org-scoped endpoint (`GET /organizations/:organizationId/members/:userId/profile`) reusing existing membership-lookup repository functions to resolve a display-ready `orgRole` ('Owner'/'Admin'/'Member'), kept entirely separate from the platform-level `User.role`. One frontend `UserProfileDialog` component is reused across four entry points; a query-param deep link (`?dmUserId=`) lets the dialog's Message button work uniformly whether opened from the chat page or elsewhere.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, Next.js 16 / React 19, TanStack Query.

## Global Constraints

- No test runner exists in this repo. Verification is manual: `curl` for the backend, browser interaction for the frontend.
- `orgRole` returned by the new endpoint is a display string ('Owner'/'Admin'/'Member'), never the platform-level `User.role` ('USER'/'SUPER_ADMIN'), which the new endpoint never exposes.
- A user with no `bio`/`jobTitle` set shows nothing for those fields — no placeholder text.
- No commit message in this plan includes a `Co-Authored-By` trailer.

---

## Task 1: Data layer — `bio`/`jobTitle` columns on `Users`

**Files:**
- Create: `backend/src/sequelize/migrations/20260702080000-add-bio-jobtitle-to-users.js`
- Modify: `backend/src/models/users.model.ts`
- Modify: `backend/src/types/users.types.ts`

**Interfaces:**
- Consumes: existing `User` model (Users table, `tableName: 'Users'`).
- Produces: `Users.bio`, `Users.jobTitle` (both `string | null`). Task 2 consumes both.

- [ ] **Step 1: Write the migration**

Create `backend/src/sequelize/migrations/20260702080000-add-bio-jobtitle-to-users.js`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'bio', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'jobTitle', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'jobTitle');
    await queryInterface.removeColumn('Users', 'bio');
  },
};
```

- [ ] **Step 2: Update the `User` model**

In `backend/src/models/users.model.ts`, replace:

```ts
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  },
```

with:

```ts
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    jobTitle: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: null,
    },
  },
```

- [ ] **Step 3: Update the types file**

In `backend/src/types/users.types.ts`, replace:

```ts
export interface Users {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl: string | null;
  role: 'USER' | 'SUPER_ADMIN';
  isVerified: boolean;
  isActive: boolean;
  authProvider: 'local' | 'google' | 'github';
  refreshToken: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  Users,
  | 'id'
  | 'avatarUrl'
  | 'role'
  | 'isVerified'
  | 'isActive'
  | 'authProvider'
  | 'refreshToken'
  | 'createdAt'
  | 'updatedAt'
>;
```

with:

```ts
export interface Users {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl: string | null;
  role: 'USER' | 'SUPER_ADMIN';
  isVerified: boolean;
  isActive: boolean;
  authProvider: 'local' | 'google' | 'github';
  refreshToken: string | null;
  bio: string | null;
  jobTitle: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  Users,
  | 'id'
  | 'avatarUrl'
  | 'role'
  | 'isVerified'
  | 'isActive'
  | 'authProvider'
  | 'refreshToken'
  | 'bio'
  | 'jobTitle'
  | 'createdAt'
  | 'updatedAt'
>;
```

- [ ] **Step 4: Run the migration and verify**

```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:status
```

Expected: `20260702080000-add-bio-jobtitle-to-users: migrated`, status shows it `up`.

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add backend/src/sequelize/migrations/20260702080000-add-bio-jobtitle-to-users.js \
  backend/src/models/users.model.ts backend/src/types/users.types.ts
git commit -m "feat(users): add bio and jobTitle columns"
```

---

## Task 2: Backend — extend self-update, extend current-user, add member-profile endpoint

**Files:**
- Modify: `backend/src/repositories/users.repository.ts`
- Modify: `backend/src/controllers/auth.controller.ts`
- Modify: `backend/src/controllers/users.controller.ts`
- Modify: `backend/src/validations/auth.validation.ts`
- Modify: `backend/src/controllers/organization.controller.ts`
- Modify: `backend/src/routes/organization.routes.ts`

**Interfaces:**
- Consumes: `Users.bio`/`jobTitle` (Task 1); existing `organizationRepository`, `organizationMemberRepository`, `userRepository` (already imported in `organization.controller.ts`); existing `memberParamSchema` (`organization.validation.ts`, already covers `organizationId`+`userId`, no new schema needed for the new route).
- Produces: extended `PATCH /auth/profile` response (adds `bio`/`jobTitle`); extended `GET /auth/current-user` response (adds `bio`/`jobTitle`); `getMemberProfile` controller and `GET /organizations/:organizationId/members/:userId/profile` route. Consumed by Task 3 (frontend).

- [ ] **Step 1: Widen the repository's allowed update fields**

In `backend/src/repositories/users.repository.ts`, replace:

```ts
  update: async (id: string, data: Partial<Pick<Users, 'name' | 'avatarUrl'>>): Promise<UserInstance | null> => {
```

with:

```ts
  update: async (id: string, data: Partial<Pick<Users, 'name' | 'avatarUrl' | 'bio' | 'jobTitle'>>): Promise<UserInstance | null> => {
```

- [ ] **Step 2: Extend the validation schema**

In `backend/src/validations/auth.validation.ts`, replace:

```ts
export const updateProfileSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  }),
};
```

with:

```ts
export const updateProfileSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
    bio: z.string().max(300, 'Bio must be 300 characters or less').optional(),
    jobTitle: z.string().max(100, 'Job title must be 100 characters or less').optional(),
  }),
};
```

- [ ] **Step 3: Extend `updateProfile`**

In `backend/src/controllers/auth.controller.ts`, replace:

```ts
// UPDATE PROFILE (name)
export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) throw new ApiError(401, 'Unauthorized');

    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) throw new ApiError(400, 'Name is required');

    const updated = await userRepository.update(userId, { name: name.trim() });
    if (!updated) throw new ApiError(404, 'User not found');

    return ok(res, {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
    }, 'Profile updated successfully');
  }
);
```

with:

```ts
// UPDATE PROFILE (name, bio, jobTitle)
export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) throw new ApiError(401, 'Unauthorized');

    const { name, bio, jobTitle } = req.body as { name?: string; bio?: string; jobTitle?: string };
    if (!name || !name.trim()) throw new ApiError(400, 'Name is required');

    const updated = await userRepository.update(userId, {
      name: name.trim(),
      ...(bio !== undefined && { bio: bio.trim() || null }),
      ...(jobTitle !== undefined && { jobTitle: jobTitle.trim() || null }),
    });
    if (!updated) throw new ApiError(404, 'User not found');

    return ok(res, {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      jobTitle: updated.jobTitle,
    }, 'Profile updated successfully');
  }
);
```

- [ ] **Step 4: Extend `getCurrentUser`**

In `backend/src/controllers/users.controller.ts`, replace:

```ts
    return ok(
      res,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
        role: user.role,
      },
      'Current user retrieved successfully',
    );
```

with:

```ts
    return ok(
      res,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
        role: user.role,
        bio: user.bio,
        jobTitle: user.jobTitle,
      },
      'Current user retrieved successfully',
    );
```

- [ ] **Step 5: Add the `getMemberProfile` controller**

In `backend/src/controllers/organization.controller.ts`, append at the end of the file:

```ts

// Get a member's profile (bio, job title, org role) — any org member can view
export const getMemberProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = req.params as { organizationId: string; userId: string };

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organization not found');

    const membership = await organizationMemberRepository.findOne({ organizationId, userId });
    if (!membership) throw new ApiError(404, 'User is not a member of this organization');

    const targetUser = await userRepository.findById(userId);
    if (!targetUser) throw new ApiError(404, 'User not found');

    const orgRole = org.ownerId === userId ? 'Owner' : membership.role === 'ORG_ADMIN' ? 'Admin' : 'Member';

    return ok(res, {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      avatarUrl: targetUser.avatarUrl,
      bio: targetUser.bio,
      jobTitle: targetUser.jobTitle,
      orgRole,
      joinedAt: membership.joinedAt,
    }, 'Member profile retrieved successfully');
  }
);
```

- [ ] **Step 6: Add the route**

In `backend/src/routes/organization.routes.ts`, update the controller import:

```ts
import {
  createOrganization,
  listMyOrganizations,
  inviteUserToOrganization,
  acceptOrganizationInvitation,
  listOrganizationMembers,
  removeOrganizationMember,
  leaveOrganization,
  deleteOrganization,
  getOrganizationBySlug,
  updateOrganization,
  listPendingInvites,
  revokeInvite,
  changeMemberRole,
  getOrgDashboard,
  banOrganizationMember,
  unbanOrganizationMember,
  listOrganizationBans,
} from '../controllers/organization.controller.js';
```

to:

```ts
import {
  createOrganization,
  listMyOrganizations,
  inviteUserToOrganization,
  acceptOrganizationInvitation,
  listOrganizationMembers,
  removeOrganizationMember,
  leaveOrganization,
  deleteOrganization,
  getOrganizationBySlug,
  updateOrganization,
  listPendingInvites,
  revokeInvite,
  changeMemberRole,
  getOrgDashboard,
  banOrganizationMember,
  unbanOrganizationMember,
  listOrganizationBans,
  getMemberProfile,
} from '../controllers/organization.controller.js';
```

Then add directly after the existing `/:organizationId/members` route block:

```ts

router
  .route('/:organizationId/members/:userId/profile')
  .get(verifyJWT, isOrganizationMember, validate(memberParamSchema), getMemberProfile);
```

- [ ] **Step 7: Verify with curl**

Start the dev server, log in as two dev accounts (`USER_A`, `USER_B`) both members of the same org (`ORG_ID`, `USER_B_ID`):

```bash
curl -b /tmp/cookies_a.txt -s -X PATCH http://localhost:8080/api/v1/auth/profile \
  -H "Content-Type: application/json" -d '{"name":"Chat Tester","bio":"Building chat features","jobTitle":"Engineer"}'
```

Expected: `200` with `"data": { ..., "bio": "Building chat features", "jobTitle": "Engineer" }`.

```bash
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/auth/current-user
```

Expected: response includes the same `bio`/`jobTitle`.

```bash
curl -b /tmp/cookies_b.txt -s http://localhost:8080/api/v1/organizations/ORG_ID/members/USER_A_ID/profile
```

Expected: `200` with `"orgRole":"Owner"` (assuming `USER_A` is the org owner), `bio`/`jobTitle` matching what was just set.

```bash
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/v1/organizations/ORG_ID/members/00000000-0000-0000-0000-000000000000/profile
```

Expected: `404` (target user is not a member of this organization).

- [ ] **Step 8: Commit**

```bash
git add backend/src/repositories/users.repository.ts backend/src/controllers/auth.controller.ts \
  backend/src/controllers/users.controller.ts backend/src/validations/auth.validation.ts \
  backend/src/controllers/organization.controller.ts backend/src/routes/organization.routes.ts
git commit -m "feat(users): extend profile endpoints with bio/jobTitle, add member-profile endpoint"
```

---

## Task 3: Frontend plumbing — types, service, hooks

**Files:**
- Modify: `frontend/src/services/auth.service.ts`
- Modify: `frontend/src/hooks/useAuth.ts`
- Modify: `frontend/src/types/organization.types.ts`
- Modify: `frontend/src/services/organization.service.ts`
- Modify: `frontend/src/hooks/useOrganization.ts`

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/axios.ts`).
- Produces: `getCurrentUserProfile` service function + `useCurrentUserProfile` hook (self bio/jobTitle, used only to seed `ProfilePage`'s edit form — does **not** touch the global `useAuthStore`/`User` type); extended `updateProfile` accepting `bio`/`jobTitle`; `MemberProfile` type; `getMemberProfile` service function + `useMemberProfile` hook. Consumed by Tasks 4-6.

- [ ] **Step 1: Extend `updateProfile` and add `getCurrentUserProfile` in the auth service**

In `frontend/src/services/auth.service.ts`, replace:

```ts
export async function updateProfile(data: { name: string }): Promise<{ id: string; name: string; email: string; avatarUrl: string | null }> {
  const res = await api.patch<{ data: { id: string; name: string; email: string; avatarUrl: string | null } }>('/auth/profile', data);
  return res.data.data;
}
```

with:

```ts
export interface UpdateProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  jobTitle: string | null;
}

export async function updateProfile(data: { name: string; bio?: string; jobTitle?: string }): Promise<UpdateProfileData> {
  const res = await api.patch<{ data: UpdateProfileData }>('/auth/profile', data);
  return res.data.data;
}

export async function getCurrentUserProfile(): Promise<UpdateProfileData & { isVerified: boolean; role: string }> {
  const res = await api.get<{ data: UpdateProfileData & { isVerified: boolean; role: string } }>('/auth/current-user');
  return res.data.data;
}
```

- [ ] **Step 2: Add `useCurrentUserProfile` and update `useUpdateProfile`'s mutation type**

In `frontend/src/hooks/useAuth.ts`, find the `useUpdateProfile` hook and confirm its `mutationFn: updateProfile` still type-checks (it will, since `updateProfile`'s new parameter type widens with optional fields — no signature-breaking change needed here). Then add, directly after the `useUpdateProfile` hook:

```ts

export const useCurrentUserProfile = () =>
  useQuery({
    queryKey: ['auth', 'current-user-profile'],
    queryFn: getCurrentUserProfile,
  });
```

Add `getCurrentUserProfile` to the existing import line from `@/services/auth.service` in this file, and confirm `useQuery` is already imported from `@tanstack/react-query` (it is, since other hooks in this file already use it alongside `useMutation`).

- [ ] **Step 3: Add the `MemberProfile` type**

In `frontend/src/types/organization.types.ts`, append at the end of the file:

```ts

// ─── Member Profile ────────────────────────────────────────────

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  jobTitle: string | null;
  orgRole: 'Owner' | 'Admin' | 'Member';
  joinedAt: string;
}

export interface MemberProfileResponse {
  success: boolean;
  message: string;
  data: MemberProfile;
}
```

- [ ] **Step 4: Add the service function**

In `frontend/src/services/organization.service.ts`, change the import line:

```ts
import type {
  Organization,
  OrganizationMember,
  OrganizationsResponse,
  CreateOrganizationResponse,
  OrganizationMembersResponse,
  InviteUserResponse,
  AcceptInviteResponse,
  PendingInvite,
  PendingInvitesResponse,
  OrganizationBan,
  OrganizationBansResponse,
} from '@/types/organization.types';
```

to:

```ts
import type {
  Organization,
  OrganizationMember,
  OrganizationsResponse,
  CreateOrganizationResponse,
  OrganizationMembersResponse,
  InviteUserResponse,
  AcceptInviteResponse,
  PendingInvite,
  PendingInvitesResponse,
  OrganizationBan,
  OrganizationBansResponse,
  MemberProfile,
  MemberProfileResponse,
} from '@/types/organization.types';
```

Then append at the end of the file:

```ts

export async function getMemberProfile(organizationId: string, userId: string): Promise<MemberProfile> {
  const res = await api.get<MemberProfileResponse>(`/organizations/${organizationId}/members/${userId}/profile`);
  return res.data.data;
}
```

- [ ] **Step 5: Add the hook**

In `frontend/src/hooks/useOrganization.ts`, change the import line:

```ts
  getOrganizationBans,
  banMember,
  unbanMember,
} from '@/services/organization.service';
```

to:

```ts
  getOrganizationBans,
  banMember,
  unbanMember,
  getMemberProfile,
} from '@/services/organization.service';
```

Then append at the end of the file:

```ts

export const useMemberProfile = (organizationId: string, userId: string | null) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'members', userId, 'profile'],
    queryFn: () => getMemberProfile(organizationId, userId as string),
    enabled: !!organizationId && !!userId,
  });
```

- [ ] **Step 6: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/auth.service.ts frontend/src/hooks/useAuth.ts \
  frontend/src/types/organization.types.ts frontend/src/services/organization.service.ts frontend/src/hooks/useOrganization.ts
git commit -m "feat(users): add frontend types/service/hooks for bio/jobTitle and member profiles"
```

---

## Task 4: Frontend — `UserProfileDialog` component

**Files:**
- Create: `frontend/src/components/shared/UserProfileDialog.tsx`

**Interfaces:**
- Consumes: `useMemberProfile` (Task 3); `useAuthStore` (existing, for the self-Message-button guard).
- Produces: `UserProfileDialog` component with props `{ userId: string; organizationId: string; onMessage: (userId: string) => void; onClose: () => void }`. Consumed by Task 6 (all four entry points).

- [ ] **Step 1: Write the component**

Create `frontend/src/components/shared/UserProfileDialog.tsx`:

```tsx
'use client';

import { Loader2, Mail, MessageSquare, X } from 'lucide-react';
import { useMemberProfile } from '@/hooks/useOrganization';
import { useAuthStore } from '@/store/auth.store';

interface Props {
  userId: string;
  organizationId: string;
  onMessage: (userId: string) => void;
  onClose: () => void;
}

export default function UserProfileDialog({ userId, organizationId, onMessage, onClose }: Props) {
  const { user: currentUser } = useAuthStore();
  const { data: profile, isLoading } = useMemberProfile(organizationId, userId);

  const isSelf = currentUser?.id === userId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-white shadow-modal">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
        >
          <X size={16} />
        </button>

        {isLoading || !profile ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : (
          <div className="p-6">
            <div className="flex flex-col items-center text-center">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="mt-3 text-base font-semibold text-text-primary">{profile.name}</h2>
              {profile.jobTitle && (
                <p className="mt-0.5 text-sm text-text-secondary">{profile.jobTitle}</p>
              )}
              <span className="mt-2 inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                {profile.orgRole}
              </span>
            </div>

            {profile.bio && (
              <p className="mt-4 text-sm leading-relaxed text-text-primary">{profile.bio}</p>
            )}

            <div className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary">
              <Mail size={12} />
              {profile.email}
            </div>

            {!isSelf && (
              <button
                onClick={() => onMessage(userId)}
                className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                <MessageSquare size={14} />
                Message
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors (this file isn't imported anywhere yet, but must still type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shared/UserProfileDialog.tsx
git commit -m "feat(users): add UserProfileDialog component"
```

---

## Task 5: Frontend — self-edit Bio/Job Title fields in `ProfilePage.tsx`

**Files:**
- Modify: `frontend/src/app/profile/_components/ProfilePage.tsx`

**Interfaces:**
- Consumes: `useCurrentUserProfile` (Task 3), extended `useUpdateProfile` (Task 3).
- Produces: fully editable bio/jobTitle in the self-profile page. No later task depends on this.

- [ ] **Step 1: Fetch current bio/jobTitle and add local state**

Replace:

```tsx
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile, useUploadAvatar, useChangePassword } from '@/hooks/useAuth';
```

with:

```tsx
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile, useUploadAvatar, useChangePassword, useCurrentUserProfile } from '@/hooks/useAuth';
```

Replace:

```tsx
export default function ProfilePage() {
  const { user } = useAuthStore();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const changePassword = useChangePassword();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
```

with:

```tsx
export default function ProfilePage() {
  const { user } = useAuthStore();
  const { data: currentUserProfile } = useCurrentUserProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const changePassword = useChangePassword();

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bioLoaded, setBioLoaded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (currentUserProfile && !bioLoaded) {
    setBio(currentUserProfile.bio ?? '');
    setJobTitle(currentUserProfile.jobTitle ?? '');
    setBioLoaded(true);
  }

  if (!user) return null;
```

(Setting state directly in the render body here — not inside `useEffect` — is intentional and safe: it only fires once, guarded by `bioLoaded`, the exact "derive state from a prop/query on first load" pattern React's own docs describe as an acceptable alternative to an effect for one-time initialization.)

- [ ] **Step 2: Add the fields to the form and include them in the save call**

Replace:

```tsx
        {/* Name */}
        <form onSubmit={handleNameSave} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Display Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Email</label>
            <Input value={user.email} disabled className="opacity-60" />
            <p className="text-[11px] text-text-muted">Email address cannot be changed.</p>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfile.isPending || !name.trim() || name.trim() === user.name}
            >
              {updateProfile.isPending ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </form>
```

with:

```tsx
        {/* Name, job title, bio */}
        <form onSubmit={handleNameSave} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Display Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Job Title</label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Product Designer"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short bio about yourself"
              maxLength={300}
              rows={3}
              className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Email</label>
            <Input value={user.email} disabled className="opacity-60" />
            <p className="text-[11px] text-text-muted">Email address cannot be changed.</p>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfile.isPending || !name.trim()}
            >
              {updateProfile.isPending ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </form>
```

- [ ] **Step 3: Include bio/jobTitle in the save handler**

Replace:

```tsx
  const handleNameSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === user.name) return;
    updateProfile.mutate({ name: name.trim() }, {
      onSuccess: () => toast.success('Name updated'),
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };
```

with:

```tsx
  const handleNameSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfile.mutate({ name: name.trim(), bio: bio.trim(), jobTitle: jobTitle.trim() }, {
      onSuccess: () => toast.success('Profile updated'),
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };
```

- [ ] **Step 4: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 5: Verify in the browser**

Go to `/profile`, fill in Job Title and Bio, click Save Changes — expect a success toast. Refresh the page — expect both fields still populated (confirms the `useCurrentUserProfile` fetch round-trips correctly).

- [ ] **Step 6: Commit**

```bash
git add "frontend/src/app/profile/_components/ProfilePage.tsx"
git commit -m "feat(users): add bio and job title fields to the profile page"
```

---

## Task 6: Frontend — wire the four entry points and the DM deep link

**Files:**
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx`
- Modify: `frontend/src/components/shared/ManageChannelMembersModal.tsx`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/members/_components/MembersPage.tsx`

**Interfaces:**
- Consumes: `UserProfileDialog` (Task 4), existing `useStartDM`/`dms` (Phase 4), existing `organizationId`/`slug` already in scope in each of these components.
- Produces: fully interactive profile viewing from every entry point. Last task in this plan.

- [ ] **Step 1: Wire the message-sender avatar in `MessagePane.tsx`**

Replace:

```tsx
import { getSocket } from '@/lib/socket';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { FileAttachmentCard } from './fileDisplay';
import type { Channel, Message } from '@/types/channel.types';
```

with:

```tsx
import { getSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import UserProfileDialog from '@/components/shared/UserProfileDialog';
import { FileAttachmentCard } from './fileDisplay';
import type { Channel, Message } from '@/types/channel.types';
```

Replace:

```tsx
interface Props {
  channel: Channel;
  isAdmin: boolean;
}

export default function MessagePane({ channel, isAdmin }: Props) {
  const { user } = useAuthStore();
```

with:

```tsx
interface Props {
  channel: Channel;
  isAdmin: boolean;
  organizationId: string;
}

export default function MessagePane({ channel, isAdmin, organizationId }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
```

(`useState` is already imported in this file from Phase 1.)

Replace:

```tsx
              <div key={message.id} className="group relative flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {(message.sender?.name ?? '?').charAt(0).toUpperCase()}
                </div>
```

with:

```tsx
              <div key={message.id} className="group relative flex items-start gap-2.5">
                <button
                  onClick={() => message.sender && setProfileUserId(message.sender.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
                >
                  {(message.sender?.name ?? '?').charAt(0).toUpperCase()}
                </button>
```

Then, directly before the closing `</div>` at the very end of the component's returned JSX (after the existing `<ConfirmationDialog ... />` for message deletion), add the profile dialog. `router.push('?dmUserId=<id>')` — a relative URL with no path — replaces only the query string of the current page; since `MessagePane` is always rendered under `/org/<slug>/chat`, this lands back on the chat page with the param set, which `ChatPage` (Step 3 below) picks up. This avoids `MessagePane` needing to know the org's `slug` (it only has `organizationId`, not the slug):

```tsx
      {profileUserId && (
        <UserProfileDialog
          userId={profileUserId}
          organizationId={organizationId}
          onClose={() => setProfileUserId(null)}
          onMessage={(userId) => {
            setProfileUserId(null);
            router.push(`?dmUserId=${userId}`);
          }}
        />
      )}
```

- [ ] **Step 2: Pass `organizationId` into `MessagePane` from `ChannelView.tsx`**

In `frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx`, replace:

```tsx
      <div className="flex-1 overflow-hidden">
        {activeView === 'files' ? (
          <FileList channel={channel} />
        ) : (
          <MessagePane channel={channel} isAdmin={isAdmin} />
        )}
      </div>
```

with:

```tsx
      <div className="flex-1 overflow-hidden">
        {activeView === 'files' ? (
          <FileList channel={channel} />
        ) : (
          <MessagePane channel={channel} isAdmin={isAdmin} organizationId={organizationId} />
        )}
      </div>
```

(`ChannelView` already receives `organizationId` as a prop from `ChatPage`.)

- [ ] **Step 3: Wire the DM sidebar avatar and the `dmUserId` deep link in `ChatPage.tsx`**

Replace:

```tsx
import { use, useEffect, useState } from 'react';
import { Hash, Lock, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useChannels, useCreateChannel, useDMs, useStartDM } from '@/hooks/useChannel';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatSkeleton } from '@/components/shared/skeletons/ChatSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import type { Channel } from '@/types/channel.types';
import ChannelView from './ChannelView';
```

with:

```tsx
import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Hash, Lock, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useChannels, useCreateChannel, useDMs, useStartDM } from '@/hooks/useChannel';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatSkeleton } from '@/components/shared/skeletons/ChatSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import UserProfileDialog from '@/components/shared/UserProfileDialog';
import type { Channel } from '@/types/channel.types';
import ChannelView from './ChannelView';
```

Replace:

```tsx
export default function ChatPage({ params }: Props) {
  const { slug } = use(params);
  const { user } = useAuthStore();

  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: dms } = useDMs(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const createChannel = useCreateChannel(org?.id ?? '');
  const startDM = useStartDM(org?.id ?? '');

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);

  useEffect(() => {
    if (
      selectedChannel &&
      channels &&
      dms &&
      !channels.some((c) => c.id === selectedChannel.id) &&
      !dms.some((c) => c.id === selectedChannel.id)
    ) {
      setSelectedChannel(null);
    }
  }, [channels, dms, selectedChannel]);
```

with:

```tsx
export default function ChatPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: channels, isLoading: channelsLoading } = useChannels(org?.id ?? '');
  const { data: dms } = useDMs(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const createChannel = useCreateChannel(org?.id ?? '');
  const startDM = useStartDM(org?.id ?? '');

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    if (
      selectedChannel &&
      channels &&
      dms &&
      !channels.some((c) => c.id === selectedChannel.id) &&
      !dms.some((c) => c.id === selectedChannel.id)
    ) {
      setSelectedChannel(null);
    }
  }, [channels, dms, selectedChannel]);

  useEffect(() => {
    const dmUserId = searchParams.get('dmUserId');
    if (!dmUserId || !dms || !org) return;

    const existing = dms.find((dm) => dm.dmParticipant?.id === dmUserId);
    if (existing) {
      setSelectedChannel(existing);
      router.replace(`/org/${slug}/chat`);
      return;
    }

    startDM.mutate(dmUserId, {
      onSuccess: (channel) => setSelectedChannel(channel),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
      onSettled: () => router.replace(`/org/${slug}/chat`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, dms, org]);
```

Replace:

```tsx
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
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dm.dmParticipant) setProfileUserId(dm.dmParticipant.id);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary hover:opacity-80 transition-opacity"
                >
                  {(dm.dmParticipant?.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{dm.dmParticipant?.name ?? 'Unknown'}</span>
              </button>
            ))
          ) : (
            <p className="px-2.5 py-2 text-xs text-text-secondary italic">No direct messages yet.</p>
          )}
        </div>
      </aside>
```

(Using a `<span>` with `onClick` + `stopPropagation` here rather than a nested `<button>`, since the avatar sits inside the DM row's own `<button onClick={() => setSelectedChannel(dm)}>` — HTML doesn't allow nested `<button>` elements.)

Finally, replace:

```tsx
      {showDMModal && (
        <NewDMModal
          onClose={() => setShowDMModal(false)}
          onSelect={handleStartDM}
          members={(orgMembers ?? []).filter((m) => m.userId !== user?.id)}
          isPending={startDM.isPending}
        />
      )}
    </div>
  );
}
```

with:

```tsx
      {showDMModal && (
        <NewDMModal
          onClose={() => setShowDMModal(false)}
          onSelect={handleStartDM}
          members={(orgMembers ?? []).filter((m) => m.userId !== user?.id)}
          isPending={startDM.isPending}
        />
      )}

      {profileUserId && org && (
        <UserProfileDialog
          userId={profileUserId}
          organizationId={org.id}
          onClose={() => setProfileUserId(null)}
          onMessage={(userId) => {
            setProfileUserId(null);
            router.push(`/org/${slug}/chat?dmUserId=${userId}`);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the "Current Members" avatar in `ManageChannelMembersModal.tsx`**

Replace:

```tsx
import { toast } from 'sonner';
import { Loader2, UserPlus, X } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import {
  useChannelMembers,
  useInviteChannelMember,
  useRemoveChannelMember,
} from '@/hooks/useChannel';
import { useOrganizationMembers } from '@/hooks/useOrganization';
```

with:

```tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserPlus, X } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import {
  useChannelMembers,
  useInviteChannelMember,
  useRemoveChannelMember,
} from '@/hooks/useChannel';
import { useOrganizationMembers } from '@/hooks/useOrganization';
import UserProfileDialog from '@/components/shared/UserProfileDialog';
```

Replace:

```tsx
export default function ManageChannelMembersModal({
  channelId,
  organizationId,
  isOpen,
  isAdmin,
  onClose,
}: Props) {
  const { data: channelMembers, isLoading: channelMembersLoading } = useChannelMembers(channelId);
  const { data: orgMembers, isLoading: orgMembersLoading } = useOrganizationMembers(organizationId);

  const inviteMember = useInviteChannelMember(channelId);
  const removeMember = useRemoveChannelMember(channelId);

  if (!isOpen) return null;
```

with:

```tsx
export default function ManageChannelMembersModal({
  channelId,
  organizationId,
  isOpen,
  isAdmin,
  onClose,
}: Props) {
  const router = useRouter();
  const { data: channelMembers, isLoading: channelMembersLoading } = useChannelMembers(channelId);
  const { data: orgMembers, isLoading: orgMembersLoading } = useOrganizationMembers(organizationId);

  const inviteMember = useInviteChannelMember(channelId);
  const removeMember = useRemoveChannelMember(channelId);

  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  if (!isOpen) return null;
```

Replace:

```tsx
                      <li key={member.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/5 text-sm font-semibold text-primary">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary leading-none">{name}</p>
                            <p className="mt-0.5 text-xs text-text-secondary">{email}</p>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemove(member.userId, name)}
                            disabled={removeMember.isPending}
                            className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                            title="Remove from channel"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </li>
```

with:

```tsx
                      <li key={member.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-muted/50 transition-colors">
                        <button
                          onClick={() => setProfileUserId(member.userId)}
                          className="flex items-center gap-3 text-left"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/5 text-sm font-semibold text-primary hover:opacity-80 transition-opacity">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary leading-none">{name}</p>
                            <p className="mt-0.5 text-xs text-text-secondary">{email}</p>
                          </div>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemove(member.userId, name)}
                            disabled={removeMember.isPending}
                            className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                            title="Remove from channel"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </li>
```

- [ ] **Step 5: Render the profile dialog in `ManageChannelMembersModal.tsx`**

Replace the component's final lines:

```tsx
          </div>
        )}
      </div>
    </div>
  );
}
```

with:

```tsx
          </div>
        )}
      </div>

      {profileUserId && (
        <UserProfileDialog
          userId={profileUserId}
          organizationId={organizationId}
          onClose={() => setProfileUserId(null)}
          onMessage={(userId) => {
            setProfileUserId(null);
            onClose();
            router.push(`?dmUserId=${userId}`);
          }}
        />
      )}
    </div>
  );
}
```

(This modal is only ever rendered from `ChannelView.tsx`, which is only ever rendered from `/org/<slug>/chat` — so the same relative query-only `router.push` used in `MessagePane.tsx` works here too, and closing the members modal (`onClose()`) before pushing avoids leaving it open behind the now-selected DM.)

- [ ] **Step 6: Wire the avatar in `MembersPage.tsx`**

In `frontend/src/app/(dashboard)/org/[slug]/members/_components/MembersPage.tsx`, replace:

```tsx
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
```

with:

```tsx
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import UserProfileDialog from '@/components/shared/UserProfileDialog';
```

(`useRouter` is already imported in this file — only the new `UserProfileDialog` import is added.)

Replace:

```tsx
  const [activeConfirm, setActiveConfirm] = useState<'remove' | 'revoke' | 'leave' | 'delete' | 'ban' | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<any>(null);
```

with:

```tsx
  const [activeConfirm, setActiveConfirm] = useState<'remove' | 'revoke' | 'leave' | 'delete' | 'ban' | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<any>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
```

Replace:

```tsx
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          {member.user?.avatarUrl ? (
                            <img
                              src={member.user.avatarUrl}
                              alt={name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 text-primary font-semibold text-sm">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-text-primary">{name}</span>
                        </div>
                      </td>
```

with:

```tsx
                      <td className="whitespace-nowrap px-6 py-4">
                        <button
                          onClick={() => setProfileUserId(member.userId)}
                          className="flex items-center gap-3 text-left"
                        >
                          {member.user?.avatarUrl ? (
                            <img
                              src={member.user.avatarUrl}
                              alt={name}
                              className="h-8 w-8 rounded-full object-cover hover:opacity-80 transition-opacity"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 text-primary font-semibold text-sm hover:opacity-80 transition-opacity">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-text-primary">{name}</span>
                        </button>
                      </td>
```

Then, replace the component's final lines:

```tsx
      <ConfirmationDialog
        isOpen={activeConfirm === 'leave'}
        onClose={() => setActiveConfirm(null)}
        onConfirm={confirmLeave}
        title="Leave Workspace"
        description={`Are you sure you want to leave ${org?.name}? You will lose access to all projects.`}
        confirmText="Leave"
        isDestructive
        isLoading={leaveMutation.isPending}
      />
    </div>
  );
}
```

with:

```tsx
      <ConfirmationDialog
        isOpen={activeConfirm === 'leave'}
        onClose={() => setActiveConfirm(null)}
        onConfirm={confirmLeave}
        title="Leave Workspace"
        description={`Are you sure you want to leave ${org?.name}? You will lose access to all projects.`}
        confirmText="Leave"
        isDestructive
        isLoading={leaveMutation.isPending}
      />

      {profileUserId && org && (
        <UserProfileDialog
          userId={profileUserId}
          organizationId={org.id}
          onClose={() => setProfileUserId(null)}
          onMessage={(userId) => {
            setProfileUserId(null);
            router.push(`/org/${slug}/chat?dmUserId=${userId}`);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 8: Verify in the browser**

From the chat page: click a message sender's avatar — expect the profile dialog to open with their name/role/bio/job-title (whatever they've set) and a Message button (hidden on your own messages). Click Message — expect the dialog to close and that DM to open in the sidebar automatically. Click a DM sidebar avatar — expect the same dialog (rest of the row still selects the DM when clicked elsewhere). Open a channel's Members modal and click a member's avatar — expect the same dialog, opened on top of the members modal. From the org Members page, click a member's avatar — expect the dialog; click Message — expect navigation to the chat page with that DM already open.

- [ ] **Step 9: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/chat/_components/MessagePane.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChannelView.tsx" \
  "frontend/src/app/(dashboard)/org/[slug]/chat/_components/ChatPage.tsx" \
  frontend/src/components/shared/ManageChannelMembersModal.tsx \
  "frontend/src/app/(dashboard)/org/[slug]/members/_components/MembersPage.tsx"
git commit -m "feat(users): wire profile dialog into chat messages, DM list, channel members, and org members"
```