# Chat Phase 5 (Org-Level Ban) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent, org-wide ban on top of the existing kick (`removeOrganizationMember`), per `docs/superpowers/specs/2026-07-02-chat-channels-phase5-design.md`. Final phase of the chat roadmap — this is an organization-membership feature, not a chat/channel feature.

**Architecture:** New `organization_bans` table (one row per active ban). Banning reuses the exact removal sequence already used by kick (destroy membership → cascade out of channels → notify admins) via a small extracted helper, then records the ban. Invite creation and invite acceptance both gain a ban check.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, Next.js 16 / React 19, TanStack Query, sonner.

## Global Constraints

- No test runner exists in this repo. Every task's deliverable is verified manually via `curl` and/or the browser.
- Ban/unban/list-bans use the same authority as kick: `isOrganizationAdmin` (owner or `ORG_ADMIN`).
- No `reason` field on the ban record — matches this codebase's other moderation actions.
- No commit message in this plan includes a `Co-Authored-By` trailer.

---

## Task 1: Data layer — `OrganizationBan` model, migration, types, associations

**Files:**
- Create: `backend/src/sequelize/migrations/20260702070000-create-organization-bans.js`
- Create: `backend/src/models/organizationBans.model.ts`
- Modify: `backend/src/types/organizations.types.ts`
- Modify: `backend/src/models/index.ts`

**Interfaces:**
- Consumes: `Organization`, `User` models (existing).
- Produces: `OrganizationBan` Sequelize model (exported from `models/index.ts`); `OrganizationBans`, `OrganizationBanCreationAttributes`, `OrganizationBanInstance` types. Task 2 consumes all of these.

- [ ] **Step 1: Write the migration**

Create `backend/src/sequelize/migrations/20260702070000-create-organization-bans.js`:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('organization_bans', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      bannedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('organization_bans', ['organizationId']);
    await queryInterface.addIndex('organization_bans', ['organizationId', 'userId'], {
      unique: true,
      name: 'organization_bans_organization_id_user_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('organization_bans');
  },
};
```

- [ ] **Step 2: Write the model**

Create `backend/src/models/organizationBans.model.ts`:

```ts
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { OrganizationBanInstance } from '../types/organizations.types.js';

export const OrganizationBan = sequelize.define<OrganizationBanInstance>(
  'OrganizationBan',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    bannedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: 'organization_bans',
    timestamps: true,
    updatedAt: false,
  },
);
```

- [ ] **Step 3: Add types**

In `backend/src/types/organizations.types.ts`, append at the end of the file:

```ts

export interface OrganizationBans {
  id: string;
  organizationId: string;
  userId: string;
  bannedBy: string | null;
  createdAt?: Date;
  user?: UserInstance;
  bannedByUser?: UserInstance;
}

export type OrganizationBanCreationAttributes = Optional<
  OrganizationBans,
  'id' | 'createdAt'
>;

export interface OrganizationBanInstance
  extends Model<OrganizationBans, OrganizationBanCreationAttributes>, OrganizationBans {}
```

- [ ] **Step 4: Wire associations into `models/index.ts`**

Add the import next to the other model imports:

```ts
import { OrganizationBan } from './organizationBans.model.js';
```

Directly after the existing `Invitation` associations block:

```ts
// Invitations
Invitation.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Invitation.belongsTo(User, { as: 'invitedBy', foreignKey: 'invitedById' });
```

add:

```ts

// Organization Bans
Organization.hasMany(OrganizationBan, { foreignKey: 'organizationId', onDelete: 'CASCADE', as: 'bans' });
OrganizationBan.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
OrganizationBan.belongsTo(User, { foreignKey: 'userId', as: 'user' });
OrganizationBan.belongsTo(User, { foreignKey: 'bannedBy', as: 'bannedByUser' });
```

Finally, replace the final `export { ... }` block:

```ts
export {
  User,
  Verification,
  Organization,
  OrganizationMember,
  Invitation,
  Project,
  ProjectMember,
  KanbanColumn,
  Task,
  TaskAssignee,
  TaskComment,
  TaskAttachment,
  Subtask,
  Channel,
  ChannelMember,
  Message,
  MessageReaction,
  Notification,
  ActivityLog,
};
```

with:

```ts
export {
  User,
  Verification,
  Organization,
  OrganizationMember,
  Invitation,
  OrganizationBan,
  Project,
  ProjectMember,
  KanbanColumn,
  Task,
  TaskAssignee,
  TaskComment,
  TaskAttachment,
  Subtask,
  Channel,
  ChannelMember,
  Message,
  MessageReaction,
  Notification,
  ActivityLog,
};
```

- [ ] **Step 5: Run the migration and verify**

```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:status
```

Expected: `20260702070000-create-organization-bans: migrated`, status shows it `up`.

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add backend/src/sequelize/migrations/20260702070000-create-organization-bans.js \
  backend/src/models/organizationBans.model.ts backend/src/types/organizations.types.ts backend/src/models/index.ts
git commit -m "feat(org): add OrganizationBan model and migration"
```

---

## Task 2: Backend — ban/unban/list endpoints, invite/accept ban checks

**Files:**
- Modify: `backend/src/repositories/organization.repository.ts`
- Modify: `backend/src/controllers/organization.controller.ts`
- Modify: `backend/src/routes/organization.routes.ts`

**Interfaces:**
- Consumes: `OrganizationBan` model (Task 1), existing `organizationRepository`/`organizationMemberRepository`/`userRepository`/`cascadeRemoveUserFromOrgChannels` (all already used in `organization.controller.ts`).
- Produces: `organizationBanRepository` (`create`, `findOne`, `findAllByOrg`, `delete`); `banOrganizationMember`, `unbanOrganizationMember`, `listOrganizationBans` controllers; `removeMemberFromOrg` shared helper (used by both the existing kick and the new ban). No later task in this phase depends on this beyond the frontend consuming the routes.

- [ ] **Step 1: Add `organizationBanRepository`**

In `backend/src/repositories/organization.repository.ts`, change the import line:

```ts
import {
  Organization,
  OrganizationMember,
  Invitation,
  User,
  Project,
  ProjectMember,
  Task,
  KanbanColumn,
  ActivityLog,
} from '../models/index.js';
```

to:

```ts
import {
  Organization,
  OrganizationMember,
  Invitation,
  OrganizationBan,
  User,
  Project,
  ProjectMember,
  Task,
  KanbanColumn,
  ActivityLog,
} from '../models/index.js';
```

Then replace the type-import block:

```ts
import type {
  OrganizationCreationAttributes,
  OrganizationInstance,
  OrganizationMemberCreationAttributes,
  OrganizationMemberInstance,
  OrganizationInviteCreationAttributes,
  OrganizationInviteInstance,
} from '../types/organizations.types.js';
```

with:

```ts
import type {
  OrganizationCreationAttributes,
  OrganizationInstance,
  OrganizationMemberCreationAttributes,
  OrganizationMemberInstance,
  OrganizationInviteCreationAttributes,
  OrganizationInviteInstance,
  OrganizationBanInstance,
} from '../types/organizations.types.js';
```

Then append at the end of the file:

```ts

export const organizationBanRepository = {
  create: async (organizationId: string, userId: string, bannedBy: string): Promise<OrganizationBanInstance> => {
    return await OrganizationBan.create({ organizationId, userId, bannedBy });
  },

  findOne: async (organizationId: string, userId: string): Promise<OrganizationBanInstance | null> => {
    return await OrganizationBan.findOne({ where: { organizationId, userId } });
  },

  findAllByOrg: async (organizationId: string): Promise<OrganizationBanInstance[]> => {
    return await OrganizationBan.findAll({
      where: { organizationId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatarUrl'] },
        { model: User, as: 'bannedByUser', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });
  },

  delete: async (organizationId: string, userId: string): Promise<number> => {
    return await OrganizationBan.destroy({ where: { organizationId, userId } });
  },
};
```

- [ ] **Step 2: Extract the shared member-removal helper**

In `backend/src/controllers/organization.controller.ts`, change the import line:

```ts
import {
  organizationRepository,
  organizationMemberRepository,
  organizationInviteRepository,
  dashboardRepository,
} from '../repositories/organization.repository.js';
```

to:

```ts
import {
  organizationRepository,
  organizationMemberRepository,
  organizationInviteRepository,
  organizationBanRepository,
  dashboardRepository,
} from '../repositories/organization.repository.js';
```

Add a type import directly below the existing imports:

```ts
import type { OrganizationInstance } from '../types/organizations.types.js';
```

Then replace the `removeOrganizationMember` controller:

```ts
// Remove Member from Organization
export const removeOrganizationMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const userId = req.params.userId as string;
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    if (org.ownerId === userId) {
      throw new ApiError(400, 'Cannot remove the organization owner');
    }

    const member = await organizationMemberRepository.findOne({
      organizationId,
      userId,
    });

    if (!member) {
      throw new ApiError(404, 'Member not found in organization');
    }

    const memberUser = await userRepository.findById(userId);
    await member.destroy();
    await cascadeRemoveUserFromOrgChannels(organizationId, userId, memberUser?.name ?? 'A member');

    notifyAdminsOfMemberLeave(
      organizationId, org.ownerId, org.name,
      userId, memberUser?.name ?? 'A member', true,
    ).catch(() => {});

    return ok(res, null, 'Member removed successfully');
  }
);
```

with:

```ts
async function removeMemberFromOrg(org: OrganizationInstance, userId: string): Promise<void> {
  const member = await organizationMemberRepository.findOne({ organizationId: org.id, userId });
  if (!member) throw new ApiError(404, 'Member not found in organization');

  const memberUser = await userRepository.findById(userId);
  await member.destroy();
  await cascadeRemoveUserFromOrgChannels(org.id, userId, memberUser?.name ?? 'A member');

  notifyAdminsOfMemberLeave(
    org.id, org.ownerId, org.name,
    userId, memberUser?.name ?? 'A member', true,
  ).catch(() => {});
}

// Remove Member from Organization
export const removeOrganizationMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const userId = req.params.userId as string;
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    if (org.ownerId === userId) {
      throw new ApiError(400, 'Cannot remove the organization owner');
    }

    await removeMemberFromOrg(org, userId);

    return ok(res, null, 'Member removed successfully');
  }
);
```

- [ ] **Step 3: Add ban checks to invite creation and invite acceptance**

In `backend/src/controllers/organization.controller.ts`, replace:

```ts
    // Check if the user is already a member
    const existingMemberUser = await userRepository.findByEmail(targetEmail);
    if (existingMemberUser) {
      const isMember = await organizationMemberRepository.findOne({
        organizationId,
        userId: existingMemberUser.id,
      });
      if (isMember) {
        throw new ApiError(400, 'User is already a member of this organization');
      }
    }
```

with:

```ts
    // Check if the user is already a member
    const existingMemberUser = await userRepository.findByEmail(targetEmail);
    if (existingMemberUser) {
      const isMember = await organizationMemberRepository.findOne({
        organizationId,
        userId: existingMemberUser.id,
      });
      if (isMember) {
        throw new ApiError(400, 'User is already a member of this organization');
      }

      const ban = await organizationBanRepository.findOne(organizationId, existingMemberUser.id);
      if (ban) {
        throw new ApiError(400, 'This user is banned from this organization');
      }
    }
```

Then replace:

```ts
    if (org.isSuspended) {
      throw new ApiError(403, 'This organization has been suspended');
    }

    // Add user as member
    const [member] = await organizationMemberRepository.findOrCreate(
      invite.organizationId,
      user.id,
      { role: 'MEMBER' }
    );
    await autoJoinUserToPublicChannels(invite.organizationId, user.id);
```

with:

```ts
    if (org.isSuspended) {
      throw new ApiError(403, 'This organization has been suspended');
    }

    const ban = await organizationBanRepository.findOne(invite.organizationId, user.id);
    if (ban) {
      throw new ApiError(400, 'This user is banned from this organization');
    }

    // Add user as member
    const [member] = await organizationMemberRepository.findOrCreate(
      invite.organizationId,
      user.id,
      { role: 'MEMBER' }
    );
    await autoJoinUserToPublicChannels(invite.organizationId, user.id);
```

- [ ] **Step 4: Add ban/unban/list controllers**

In `backend/src/controllers/organization.controller.ts`, append at the end of the file:

```ts

// Ban Member from Organization
export const banOrganizationMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const userId = req.params.userId as string;
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new ApiError(404, 'Organization not found');

    if (org.ownerId === userId) {
      throw new ApiError(400, 'Cannot ban the organization owner');
    }

    const existingBan = await organizationBanRepository.findOne(organizationId, userId);
    if (existingBan) {
      throw new ApiError(400, 'User is already banned from this organization');
    }

    await removeMemberFromOrg(org, userId);
    await organizationBanRepository.create(organizationId, userId, user.id);

    return ok(res, null, 'Member banned successfully');
  }
);

// Unban Member
export const unbanOrganizationMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const userId = req.params.userId as string;

    const deleted = await organizationBanRepository.delete(organizationId, userId);
    if (deleted === 0) throw new ApiError(404, 'No active ban found for this user');

    return ok(res, null, 'Member unbanned successfully');
  }
);

// List Banned Users
export const listOrganizationBans = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const bans = await organizationBanRepository.findAllByOrg(organizationId);
    return ok(res, bans, 'Banned users retrieved successfully');
  }
);
```

- [ ] **Step 5: Add routes**

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
} from '../controllers/organization.controller.js';
```

Then add directly after the existing `/:organizationId/members/:userId/role` route block:

```ts

router
  .route('/:organizationId/members/:userId/ban')
  .post(verifyJWT, isOrganizationAdmin, validate(memberParamSchema), banOrganizationMember);

router
  .route('/:organizationId/bans/:userId')
  .delete(verifyJWT, isOrganizationAdmin, validate(memberParamSchema), unbanOrganizationMember);

router
  .route('/:organizationId/bans')
  .get(verifyJWT, isOrganizationAdmin, validate(organizationParamSchema), listOrganizationBans);
```

(No new validation schemas needed — `memberParamSchema` (`organizationId`+`userId`) and `organizationParamSchema` (`organizationId` only), both already imported in this file, cover every new route.)

- [ ] **Step 6: Verify with curl**

Start the dev server, log in as org owner (`USER_A`/`cookies_a.txt`) and a regular member (`USER_B`/`cookies_b.txt`, `USER_B_ID`, `USER_B_EMAIL` known), using `ORG_ID`:

```bash
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/organizations/ORG_ID/members/USER_B_ID/ban
```

Expected: `200` `{"success":true,"message":"Member banned successfully",...}`.

```bash
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/organizations/ORG_ID/members
```

Expected: `USER_B` no longer listed (kick side of ban worked).

```bash
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/organizations/ORG_ID/bans
```

Expected: array containing `USER_B` with `bannedByUser` set to `USER_A`.

```bash
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/organizations/ORG_ID/invites \
  -H "Content-Type: application/json" -d "{\"email\":\"USER_B_EMAIL\"}"
```

Expected: `400` (banned user rejected at invite time).

```bash
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/organizations/ORG_ID/members/USER_B_ID/ban
```

Expected: `400` (already banned).

```bash
curl -b /tmp/cookies_a.txt -s -X DELETE http://localhost:8080/api/v1/organizations/ORG_ID/bans/USER_B_ID
```

Expected: `200` `{"success":true,"message":"Member unbanned successfully",...}`.

```bash
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/api/v1/organizations/ORG_ID/bans/USER_B_ID
```

Expected: `404` (no active ban left to remove).

```bash
INV=$(curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/organizations/ORG_ID/invites \
  -H "Content-Type: application/json" -d "{\"email\":\"USER_B_EMAIL\"}")
echo "$INV"
# extract the token from the dev-mode inviteLink, then as USER_B:
curl -b /tmp/cookies_b.txt -s -X POST http://localhost:8080/api/v1/organizations/accept-invite \
  -H "Content-Type: application/json" -d '{"token":"<TOKEN_FROM_ABOVE>"}'
```

Expected: `200`/`201` success — re-invite and re-accept work normally now that the ban is lifted.

```bash
curl -b /tmp/cookies_a.txt -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/organizations/ORG_ID/members/USER_A_ID/ban
```

Expected: `400` (cannot ban the owner).

- [ ] **Step 7: Commit**

```bash
git add backend/src/repositories/organization.repository.ts backend/src/controllers/organization.controller.ts \
  backend/src/routes/organization.routes.ts
git commit -m "feat(org): add ban/unban/list-bans endpoints and ban checks on invite/accept"
```

---

## Task 3: Frontend plumbing — types, service, hooks for bans

**Files:**
- Modify: `frontend/src/types/organization.types.ts`
- Modify: `frontend/src/services/organization.service.ts`
- Modify: `frontend/src/hooks/useOrganization.ts`

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/axios.ts`).
- Produces: `OrganizationBan` type; `getOrganizationBans`, `banMember`, `unbanMember` service functions; `useOrganizationBans`, `useBanMember`, `useUnbanMember` hooks. Consumed by Task 4.

- [ ] **Step 1: Add the `OrganizationBan` type**

In `frontend/src/types/organization.types.ts`, append at the end of the file:

```ts

// ─── Ban ───────────────────────────────────────────────────────

export interface OrganizationBan {
  id: string;
  organizationId: string;
  userId: string;
  bannedBy: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  bannedByUser?: {
    id: string;
    name: string;
  };
}

export interface OrganizationBansResponse {
  success: boolean;
  message: string;
  data: OrganizationBan[];
}
```

- [ ] **Step 2: Add service functions**

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
} from '@/types/organization.types';
```

Then append at the end of the file:

```ts

export async function getOrganizationBans(organizationId: string): Promise<OrganizationBan[]> {
  const res = await api.get<OrganizationBansResponse>(`/organizations/${organizationId}/bans`);
  return res.data.data;
}

export async function banMember(organizationId: string, userId: string): Promise<void> {
  await api.post(`/organizations/${organizationId}/members/${userId}/ban`);
}

export async function unbanMember(organizationId: string, userId: string): Promise<void> {
  await api.delete(`/organizations/${organizationId}/bans/${userId}`);
}
```

- [ ] **Step 3: Add hooks**

In `frontend/src/hooks/useOrganization.ts`, change the import line:

```ts
import {
  getMyOrganizations,
  getOrganizationBySlug,
  createOrganization,
  updateOrganization,
  getOrganizationMembers,
  inviteUser,
  acceptInvite,
  removeMember,
  leaveOrganization,
  deleteOrganization,
  listPendingInvites,
  revokeInvite,
  changeMemberRole,
} from '@/services/organization.service';
```

to:

```ts
import {
  getMyOrganizations,
  getOrganizationBySlug,
  createOrganization,
  updateOrganization,
  getOrganizationMembers,
  inviteUser,
  acceptInvite,
  removeMember,
  leaveOrganization,
  deleteOrganization,
  listPendingInvites,
  revokeInvite,
  changeMemberRole,
  getOrganizationBans,
  banMember,
  unbanMember,
} from '@/services/organization.service';
```

Then append at the end of the file:

```ts

export const useOrganizationBans = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'bans'],
    queryFn: () => getOrganizationBans(organizationId),
    enabled: !!organizationId,
  });

export const useBanMember = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => banMember(organizationId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
      qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'bans'] });
    },
  });
};

export const useUnbanMember = (organizationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => unbanMember(organizationId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', organizationId, 'bans'] }),
  });
};
```

- [ ] **Step 4: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/organization.types.ts frontend/src/services/organization.service.ts frontend/src/hooks/useOrganization.ts
git commit -m "feat(org): add frontend types/service/hooks for org bans"
```

---

## Task 4: Frontend UI — Ban action and Banned Users tab

**Files:**
- Modify: `frontend/src/app/(dashboard)/org/[slug]/members/_components/MembersPage.tsx`

**Interfaces:**
- Consumes: `useOrganizationBans`, `useBanMember`, `useUnbanMember` (Task 3); existing `ConfirmationDialog`, `activeConfirm`/`confirmPayload` state pattern already in this file.
- Produces: fully interactive ban/unban UI. Last task in this phase and in the whole chat roadmap.

- [ ] **Step 1: Add imports, hooks, and the third tab**

Replace:

```tsx
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Loader2,
  LogOut,
  Mail,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';
```

with:

```tsx
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  Clock,
  Loader2,
  LogOut,
  Mail,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';
```

Replace:

```tsx
import {
  useOrganizationBySlug,
  useOrganizationMembers,
  useInviteUser,
  useRemoveMember,
  useLeaveOrganization,
  useDeleteOrganization,
  usePendingInvites,
  useRevokeInvite,
  useChangeMemberRole,
} from '@/hooks/useOrganization';
```

with:

```tsx
import {
  useOrganizationBySlug,
  useOrganizationMembers,
  useInviteUser,
  useRemoveMember,
  useLeaveOrganization,
  useDeleteOrganization,
  usePendingInvites,
  useRevokeInvite,
  useChangeMemberRole,
  useOrganizationBans,
  useBanMember,
  useUnbanMember,
} from '@/hooks/useOrganization';
```

Replace:

```tsx
  const [activeTab, setActiveTab] = useState<'members' | 'invites'>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);

  const inviteMutation = useInviteUser(org?.id ?? '');
  const removeMutation = useRemoveMember(org?.id ?? '');
  const leaveMutation = useLeaveOrganization(org?.id ?? '');
  const deleteMutation = useDeleteOrganization();
  const revokeInviteMutation = useRevokeInvite(org?.id ?? '');
  const changeRoleMutation = useChangeMemberRole(org?.id ?? '');

  const [activeConfirm, setActiveConfirm] = useState<'remove' | 'revoke' | 'leave' | 'delete' | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<any>(null);
```

with:

```tsx
  const [activeTab, setActiveTab] = useState<'members' | 'invites' | 'bans'>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);

  const inviteMutation = useInviteUser(org?.id ?? '');
  const removeMutation = useRemoveMember(org?.id ?? '');
  const leaveMutation = useLeaveOrganization(org?.id ?? '');
  const deleteMutation = useDeleteOrganization();
  const revokeInviteMutation = useRevokeInvite(org?.id ?? '');
  const changeRoleMutation = useChangeMemberRole(org?.id ?? '');
  const { data: bans, isLoading: bansLoading } = useOrganizationBans(org?.id ?? '');
  const banMutation = useBanMember(org?.id ?? '');
  const unbanMutation = useUnbanMember(org?.id ?? '');

  const [activeConfirm, setActiveConfirm] = useState<'remove' | 'revoke' | 'leave' | 'delete' | 'ban' | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<any>(null);
```

- [ ] **Step 2: Add ban/unban handlers**

Replace:

```tsx
  const handleRevokeInvite = (inviteId: string, email: string) => {
```

with:

```tsx
  const handleBanMember = (userId: string, name: string) => {
    setActiveConfirm('ban');
    setConfirmPayload({ userId, name });
  };

  const confirmBanMember = () => {
    if (!confirmPayload) return;
    banMutation.mutate(confirmPayload.userId, {
      onSuccess: () => {
        toast.success(`${confirmPayload.name} banned`);
        setActiveConfirm(null);
        setConfirmPayload(null);
      },
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleUnbanMember = (userId: string, name: string) => {
    unbanMutation.mutate(userId, {
      onSuccess: () => toast.success(`${name} unbanned`),
      onError: (err: unknown) => toast.error(parseApiError(err).message),
    });
  };

  const handleRevokeInvite = (inviteId: string, email: string) => {
```

- [ ] **Step 3: Add the Ban button next to Remove in the members table**

Replace:

```tsx
                        {isAdmin && !isOwner && !isSelf && (
                          <button
                            onClick={() => handleRemoveMember(member.userId, name)}
                            disabled={removeMutation.isPending}
                            className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                            title="Remove member"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
```

with:

```tsx
                        {isAdmin && !isOwner && !isSelf && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleBanMember(member.userId, name)}
                              disabled={banMutation.isPending}
                              className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                              title="Ban member"
                            >
                              <Ban size={16} />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.userId, name)}
                              disabled={removeMutation.isPending}
                              className="rounded p-1.5 text-text-secondary hover:bg-danger-soft/20 hover:text-danger transition-colors disabled:opacity-50"
                              title="Remove member"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
```

- [ ] **Step 4: Add the "Banned Users" tab button**

Replace:

```tsx
        {isAdmin && (
          <button
            onClick={() => setActiveTab('invites')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === 'invites'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <Mail size={13} />
            Pending Invites
            {pendingInvites && pendingInvites.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {pendingInvites.length}
              </span>
            )}
          </button>
        )}
      </div>
```

with:

```tsx
        {isAdmin && (
          <button
            onClick={() => setActiveTab('invites')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === 'invites'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <Mail size={13} />
            Pending Invites
            {pendingInvites && pendingInvites.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {pendingInvites.length}
              </span>
            )}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('bans')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === 'bans'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <Ban size={13} />
            Banned Users
            {bans && bans.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {bans.length}
              </span>
            )}
          </button>
        )}
      </div>
```

- [ ] **Step 5: Add the Banned Users tab body**

Replace:

```tsx
      {/* Invite Modal */}
```

with:

```tsx
      {/* Banned Users Tab */}
      {activeTab === 'bans' && isAdmin && (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-card">
          {bansLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
            </div>
          ) : bans && bans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-muted/50 text-xs font-semibold text-text-secondary">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Banned By</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {bans.map((ban) => (
                    <tr key={ban.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <p className="font-medium text-text-primary">{ban.user?.name ?? 'Unknown User'}</p>
                          <p className="text-xs text-text-secondary">{ban.user?.email ?? 'N/A'}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-text-secondary">
                        {ban.bannedByUser?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                          <Clock size={12} />
                          {new Date(ban.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <button
                          onClick={() => handleUnbanMember(ban.userId, ban.user?.name ?? 'This user')}
                          disabled={unbanMutation.isPending}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                          Unban
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Ban size={36} className="mb-3 text-text-secondary/40" />
              <p className="text-sm font-medium text-text-secondary">No banned users</p>
              <p className="mt-1 text-xs text-text-secondary/70">
                Members you ban from this workspace will show up here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
```

- [ ] **Step 6: Add the ban confirmation dialog**

Replace:

```tsx
      <ConfirmationDialog
        isOpen={activeConfirm === 'remove'}
        onClose={() => { setActiveConfirm(null); setConfirmPayload(null); }}
        onConfirm={confirmRemoveMember}
        title="Remove Member"
        description={`Are you sure you want to remove ${confirmPayload?.name} from this workspace?`}
        confirmText="Remove"
        isDestructive
        isLoading={removeMutation.isPending}
      />
```

with:

```tsx
      <ConfirmationDialog
        isOpen={activeConfirm === 'remove'}
        onClose={() => { setActiveConfirm(null); setConfirmPayload(null); }}
        onConfirm={confirmRemoveMember}
        title="Remove Member"
        description={`Are you sure you want to remove ${confirmPayload?.name} from this workspace?`}
        confirmText="Remove"
        isDestructive
        isLoading={removeMutation.isPending}
      />

      <ConfirmationDialog
        isOpen={activeConfirm === 'ban'}
        onClose={() => { setActiveConfirm(null); setConfirmPayload(null); }}
        onConfirm={confirmBanMember}
        title="Ban Member"
        description={`Ban ${confirmPayload?.name}? They will be removed and cannot rejoin this workspace unless unbanned.`}
        confirmText="Ban"
        isDestructive
        isLoading={banMutation.isPending}
      />
```

- [ ] **Step 7: Verify the build type-checks**

```bash
cd frontend && npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 8: Verify in the browser**

Go to a workspace's Members page as an admin. Click the Ban icon next to a member — expect a confirmation dialog with the "cannot rejoin" copy; confirm — expect them to disappear from the Members list and a "Banned Users" tab badge to appear/increment. Open the "Banned Users" tab — expect the banned user listed with who banned them and when, and an "Unban" button. Try inviting that same person's email — expect a toast error saying they're banned. Click "Unban" — expect them to disappear from the Banned Users list; inviting their email should now succeed.

- [ ] **Step 9: Commit**

```bash
git add "frontend/src/app/(dashboard)/org/[slug]/members/_components/MembersPage.tsx"
git commit -m "feat(org): add ban action and Banned Users tab to members page"
```
