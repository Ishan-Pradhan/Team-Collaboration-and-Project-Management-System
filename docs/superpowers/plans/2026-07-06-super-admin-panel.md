# Super Admin Panel & Org Feature Toggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give super admins a real panel (stats dashboard, org management, user management, audit log) and a generic per-organization feature-toggle system that actually gates chat and calendar, replacing the backend-only admin API that exists today.

**Architecture:** The backend already has `User.role: 'SUPER_ADMIN'`, `isAdmin` middleware, and partial admin routes (`admin.routes.ts`) — this plan extends that surface (new stats/growth/org-detail/feature-toggle/promote/demote/audit-log endpoints) rather than replacing it, adds a `featureFlags` JSONB column to `Organization` and a new `AdminActionLog` table, and wires flag enforcement into the existing chat/calendar middleware and controllers. The frontend gets a new `/admin/*` section (its own layout guard checking `role === 'SUPER_ADMIN'`, independent of the org-slug-based `DashboardLayout`) plus a nav entry point and feature-flag-aware nav hiding in the existing sidebar.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, Zod validation (backend); Next.js 16 App Router/React 19, TanStack Query, Tailwind v4 design tokens (frontend). No new npm dependencies on either side — the growth chart is hand-rolled inline SVG.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-06-super-admin-panel-design.md`.
- Tokens only in touched frontend files — no raw Tailwind palette classes (`gray-*`, `blue-*`, etc). The growth chart's two series use existing tokens `--color-workspace-northpeak` (#7a67a8, users) and `--color-brand` (#d4a84f, organizations) — this pair was run through the dataviz skill's `validate_palette.js` and passes all checks (lightness, chroma, CVD separation) except a contrast WARN against white, which is mitigated by direct end-of-line labels (already required regardless).
- No content access anywhere in the admin surface — org detail and stats endpoints return counts only, never task titles, message bodies, or personal event data. Personal events are excluded from every admin-facing query, not just hidden in the UI.
- Every admin mutation (block/unblock, promote/demote, suspend/unsuspend, feature-toggle) writes an `AdminActionLog` row; org-targeted actions additionally notify the org owner via the existing `notifyUser` util (bell + socket push).
- Disabling `chatEnabled`/`calendarEnabled` for an org hides the corresponding nav item entirely for that org's members (not a disabled-state message) and 403s the underlying API if hit directly.
- No new frontend route group — `/admin/*` lives at `frontend/src/app/admin/` directly (no dynamic route params anywhere under it, so no `(admin)` grouping or `params: Promise<...>` indirection is needed).
- No Swagger/OpenAPI doc blocks are added for the new admin routes in this plan (a deliberate scope cut, not an oversight) — existing routes' docs are untouched.
- No test runner in this repo — verification is `npx tsc --noEmit` (run from `backend/` or `frontend/` as appropriate), `npm run lint` (frontend), and manual checks (curl for backend routes, in-browser for UI).

---

## Task 1: `Organization.featureFlags` column

**Files:**
- Modify: `backend/src/types/organizations.types.ts`
- Modify: `backend/src/models/organizations.model.ts`
- Create: `backend/src/sequelize/migrations/20260706010000-add-feature-flags-to-organizations.js`

**Interfaces:**
- Produces: `OrganizationFeatureFlags` (`{ chatEnabled: boolean; calendarEnabled: boolean }`), and `Organizations.featureFlags: OrganizationFeatureFlags` — consumed by Task 3 (repository), Task 4 (controller), Task 5 (enforcement), and the frontend (Task 6).

- [ ] **Step 1: Add the type**

Find in `backend/src/types/organizations.types.ts`:
```ts
export interface Organizations {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  isSuspended: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  owner?: UserInstance;
}

export type OrganizationCreationAttributes = Optional<
  Organizations,
  'id' | 'description' | 'logoUrl' | 'isSuspended' | 'createdAt' | 'updatedAt'
>;
```
Replace with:
```ts
export interface OrganizationFeatureFlags {
  chatEnabled: boolean;
  calendarEnabled: boolean;
}

export interface Organizations {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  isSuspended: boolean;
  featureFlags: OrganizationFeatureFlags;
  createdAt?: Date;
  updatedAt?: Date;
  owner?: UserInstance;
}

export type OrganizationCreationAttributes = Optional<
  Organizations,
  'id' | 'description' | 'logoUrl' | 'isSuspended' | 'featureFlags' | 'createdAt' | 'updatedAt'
>;
```

- [ ] **Step 2: Add the column to the model**

Find in `backend/src/models/organizations.model.ts`:
```ts
    isSuspended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: 'Organizations',
    timestamps: true,
  }
);
```
Replace with:
```ts
    isSuspended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    featureFlags: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { chatEnabled: true, calendarEnabled: true },
    },
  },
  {
    tableName: 'Organizations',
    timestamps: true,
  }
);
```

- [ ] **Step 3: Create the migration**

Create `backend/src/sequelize/migrations/20260706010000-add-feature-flags-to-organizations.js`:
```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Organizations', 'featureFlags', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: { chatEnabled: true, calendarEnabled: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Organizations', 'featureFlags');
  },
};
```

- [ ] **Step 4: Run the migration**

Run: `cd backend && npx sequelize-cli db:migrate`
Expected: `== 20260706010000-add-feature-flags-to-organizations: migrated` (or similar), no errors.

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Manual verification**

```bash
psql "$DATABASE_URL" -c "SELECT id, \"featureFlags\" FROM \"Organizations\" LIMIT 3;"
```
(or use whatever DB client you normally use — check `backend/.env` for connection details). Expected: every existing row already has `{"chatEnabled": true, "calendarEnabled": true}` populated (Postgres backfills the default on `ADD COLUMN ... NOT NULL DEFAULT`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/types/organizations.types.ts backend/src/models/organizations.model.ts backend/src/sequelize/migrations/20260706010000-add-feature-flags-to-organizations.js
git commit -m "feat(admin): add featureFlags column to Organization"
```

---

## Task 2: `AdminActionLog` model, migration, and repository

**Files:**
- Create: `backend/src/types/adminActionLog.types.ts`
- Create: `backend/src/models/adminActionLog.model.ts`
- Create: `backend/src/sequelize/migrations/20260706020000-create-admin-action-logs.js`
- Modify: `backend/src/models/index.ts`
- Create: `backend/src/repositories/adminActionLog.repository.ts`

**Interfaces:**
- Produces: `AdminActionLog` (Sequelize model, exported from `models/index.js`), `AdminActionLogInstance`, `AdminActionLogCreationAttributes` (fields: `id`, `actorId`, `action`, `targetType: 'user' | 'organization'`, `targetId`, `metadata: Record<string, unknown> | null`, `createdAt?`); `adminActionLogRepository.create(data)`, `adminActionLogRepository.findAndCountAll({ limit, offset })` — consumed by Task 4.

- [ ] **Step 1: Create the type definitions**

Create `backend/src/types/adminActionLog.types.ts`:
```ts
import { Model, type Optional } from 'sequelize';
import type { UserInstance } from './users.types.js';

export type AdminAction =
  | 'user_blocked'
  | 'user_unblocked'
  | 'user_promoted'
  | 'user_demoted'
  | 'org_suspended'
  | 'org_unsuspended'
  | 'feature_toggled';

export interface AdminActionLogs {
  id: string;
  actorId: string;
  action: AdminAction;
  targetType: 'user' | 'organization';
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  actor?: UserInstance;
}

export type AdminActionLogCreationAttributes = Optional<
  AdminActionLogs,
  'id' | 'metadata' | 'createdAt'
>;

export interface AdminActionLogInstance
  extends Model<AdminActionLogs, AdminActionLogCreationAttributes>, AdminActionLogs {}
```

- [ ] **Step 2: Create the model**

Create `backend/src/models/adminActionLog.model.ts`:
```ts
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import type { AdminActionLogInstance } from '../types/adminActionLog.types.js';

export const AdminActionLog = sequelize.define<AdminActionLogInstance>(
  'AdminActionLog',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    targetType: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    targetId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: 'admin_action_logs',
    timestamps: true,
    updatedAt: false,
  },
);
```

- [ ] **Step 3: Create the migration**

Create `backend/src/sequelize/migrations/20260706020000-create-admin-action-logs.js`:
```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_action_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      actorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      action: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      targetType: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      targetId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('admin_action_logs', ['targetType', 'targetId']);
    await queryInterface.addIndex('admin_action_logs', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_action_logs');
  },
};
```

- [ ] **Step 4: Run the migration**

Run: `cd backend && npx sequelize-cli db:migrate`
Expected: `== 20260706020000-create-admin-action-logs: migrated`, no errors.

- [ ] **Step 5: Register the model and its association**

Find in `backend/src/models/index.ts`:
```ts
import { Notification } from './notifications.model.js';
import { ActivityLog } from './activityLog.model.js';
import { PersonalEvent } from './personalEvents.model.js';
```
Replace with:
```ts
import { Notification } from './notifications.model.js';
import { ActivityLog } from './activityLog.model.js';
import { PersonalEvent } from './personalEvents.model.js';
import { AdminActionLog } from './adminActionLog.model.js';
```

Find:
```ts
// Activity Logs
ActivityLog.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
ActivityLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });
```
Replace with:
```ts
// Activity Logs
ActivityLog.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
ActivityLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

// Admin Action Logs
AdminActionLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });
```

Find:
```ts
  Notification,
  ActivityLog,
  PersonalEvent,
};
```
Replace with:
```ts
  Notification,
  ActivityLog,
  PersonalEvent,
  AdminActionLog,
};
```

- [ ] **Step 6: Create the repository**

Create `backend/src/repositories/adminActionLog.repository.ts`:
```ts
import { AdminActionLog, User } from '../models/index.js';
import type { AdminActionLogCreationAttributes, AdminActionLogInstance } from '../types/adminActionLog.types.js';

export const adminActionLogRepository = {
  create: async (data: AdminActionLogCreationAttributes): Promise<AdminActionLogInstance> => {
    return await AdminActionLog.create(data);
  },

  findAndCountAll: async (options: {
    limit: number;
    offset: number;
  }): Promise<{ rows: AdminActionLogInstance[]; count: number }> => {
    return await AdminActionLog.findAndCountAll({
      include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: options.limit,
      offset: options.offset,
    });
  },
};
```

- [ ] **Step 7: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add backend/src/types/adminActionLog.types.ts backend/src/models/adminActionLog.model.ts backend/src/sequelize/migrations/20260706020000-create-admin-action-logs.js backend/src/models/index.ts backend/src/repositories/adminActionLog.repository.ts
git commit -m "feat(admin): add AdminActionLog model, migration, and repository"
```

---

## Task 3: Stats-supporting repository methods

**Files:**
- Modify: `backend/src/repositories/organization.repository.ts`
- Modify: `backend/src/repositories/users.repository.ts`
- Modify: `backend/src/repositories/project.repository.ts`
- Modify: `backend/src/repositories/task.repository.ts`

**Interfaces:**
- Consumes: `Organization`, `OrganizationMember`, `Project`, `Task`, `TaskAttachment`, `ActivityLog`, `User` models; `OrganizationFeatureFlags` type (Task 1).
- Produces: `organizationRepository.count()`, `.countSuspended()`, `.countCreatedSince(since: Date): Promise<{date: string; count: number}[]>`, `.findDetailById(id): Promise<{ org, memberCount, projectCount, taskCount, attachmentCount, lastActivityAt } | null>`, `.updateFeatureFlags(id, flag, enabled)`; `userRepository.countCreatedSince(since)`; `projectRepository.countAll()`; `taskRepository.countAll()` — all consumed by Task 4.

- [ ] **Step 1: Extend `organization.repository.ts` imports**

Find:
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
Replace with:
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
  TaskAttachment,
  KanbanColumn,
  ActivityLog,
} from '../models/index.js';
import type {
  OrganizationCreationAttributes,
  OrganizationInstance,
  OrganizationMemberCreationAttributes,
  OrganizationMemberInstance,
  OrganizationInviteCreationAttributes,
  OrganizationInviteInstance,
  OrganizationBanInstance,
  OrganizationFeatureFlags,
} from '../types/organizations.types.js';
```

- [ ] **Step 2: Add the new methods to `organizationRepository`**

Find:
```ts
  delete: async (id: string): Promise<boolean> => {
    const org = await Organization.findByPk(id);
    if (!org) return false;
    await org.destroy();
    return true;
  },
};
```
Replace with:
```ts
  delete: async (id: string): Promise<boolean> => {
    const org = await Organization.findByPk(id);
    if (!org) return false;
    await org.destroy();
    return true;
  },

  count: async (): Promise<number> => {
    return await Organization.count();
  },

  countSuspended: async (): Promise<number> => {
    return await Organization.count({ where: { isSuspended: true } });
  },

  countCreatedSince: async (since: Date): Promise<{ date: string; count: number }[]> => {
    const rows = await Organization.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'ASC']],
      raw: true,
    });
    return (rows as unknown as { date: string; count: string }[]).map((r) => ({
      date: r.date,
      count: parseInt(r.count, 10),
    }));
  },

  findDetailById: async (id: string) => {
    const org = await Organization.findByPk(id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
    });
    if (!org) return null;

    const projects = await Project.findAll({ where: { organizationId: id }, attributes: ['id'] });
    const projectIds = projects.map((p) => p.id);

    const [memberCount, taskCount, attachmentCount, lastActivity] = await Promise.all([
      OrganizationMember.count({ where: { organizationId: id } }),
      projectIds.length > 0
        ? Task.count({ where: { projectId: { [Op.in]: projectIds } } })
        : Promise.resolve(0),
      projectIds.length > 0
        ? TaskAttachment.count({ where: { projectId: { [Op.in]: projectIds } } })
        : Promise.resolve(0),
      projectIds.length > 0
        ? ActivityLog.findOne({
            where: { projectId: { [Op.in]: projectIds } },
            order: [['createdAt', 'DESC']],
            attributes: ['createdAt'],
          })
        : Promise.resolve(null),
    ]);

    return {
      org,
      memberCount,
      projectCount: projectIds.length,
      taskCount,
      attachmentCount,
      lastActivityAt: lastActivity?.createdAt ?? null,
    };
  },

  updateFeatureFlags: async (
    id: string,
    flag: keyof OrganizationFeatureFlags,
    enabled: boolean,
  ): Promise<OrganizationInstance | null> => {
    const org = await Organization.findByPk(id);
    if (!org) return null;
    const featureFlags = { ...org.featureFlags, [flag]: enabled };
    return await org.update({ featureFlags });
  },
};
```

- [ ] **Step 3: Extend `users.repository.ts`**

Find:
```ts
import { Op, type WhereOptions } from 'sequelize';
```
Replace with:
```ts
import { Op, fn, col, type WhereOptions } from 'sequelize';
```

Find:
```ts
  getUsersStats: async () => {
    const totalUsers = await User.count();
    const blockedCount = await User.count({ where: { isActive: false } });
    const adminsCount = await User.count({ where: { role: 'SUPER_ADMIN' } });

    return {
      totalUsers,
      blockedCount,
      adminsCount,
    };
  },
};
```
Replace with:
```ts
  getUsersStats: async () => {
    const totalUsers = await User.count();
    const blockedCount = await User.count({ where: { isActive: false } });
    const adminsCount = await User.count({ where: { role: 'SUPER_ADMIN' } });

    return {
      totalUsers,
      blockedCount,
      adminsCount,
    };
  },

  countCreatedSince: async (since: Date): Promise<{ date: string; count: number }[]> => {
    const rows = await User.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'ASC']],
      raw: true,
    });
    return (rows as unknown as { date: string; count: string }[]).map((r) => ({
      date: r.date,
      count: parseInt(r.count, 10),
    }));
  },
};
```

- [ ] **Step 4: Add `countAll` to `project.repository.ts`**

Find:
```ts
  isProjectManager: async (projectId: string, userId: string): Promise<boolean> => {
    const membership = await ProjectMember.findOne({
      where: { projectId, userId, role: 'PROJECT_MANAGER' },
    });
    return !!membership;
  },
};
```
Replace with:
```ts
  isProjectManager: async (projectId: string, userId: string): Promise<boolean> => {
    const membership = await ProjectMember.findOne({
      where: { projectId, userId, role: 'PROJECT_MANAGER' },
    });
    return !!membership;
  },

  countAll: async (): Promise<number> => {
    return await Project.count();
  },
};
```

- [ ] **Step 5: Add `countAll` to `task.repository.ts`**

Find:
```ts
  countByColumn: async (columnId: string): Promise<number> => {
    return await Task.count({ where: { columnId } });
  },
};
```
Replace with:
```ts
  countByColumn: async (columnId: string): Promise<number> => {
    return await Task.count({ where: { columnId } });
  },

  countAll: async (): Promise<number> => {
    return await Task.count();
  },
};
```

- [ ] **Step 6: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add backend/src/repositories/organization.repository.ts backend/src/repositories/users.repository.ts backend/src/repositories/project.repository.ts backend/src/repositories/task.repository.ts
git commit -m "feat(admin): add stats/detail repository methods for organizations, users, projects, tasks"
```

---

## Task 4: Admin API endpoints — stats, growth, org detail, feature toggle, promote/demote, audit log

**Files:**
- Modify: `backend/src/controllers/admin.controller.ts` (full rewrite)
- Modify: `backend/src/validations/admin.validation.ts` (full rewrite)
- Modify: `backend/src/routes/admin.routes.ts` (full rewrite)
- Modify: `backend/src/controllers/organization.controller.ts` (audit log + owner notification on suspend/unsuspend)

**Interfaces:**
- Consumes: `organizationRepository`, `userRepository`, `projectRepository`, `taskRepository` (Task 3), `adminActionLogRepository` (Task 2), `notifyUser` (`utils/notify.js`), `serializeUser` (`serializers/user.serializer.js`).
- Produces routes: `GET /admin/stats` (extended), `GET /admin/stats/growth?days=`, `PATCH /admin/users/:id/promote`, `PATCH /admin/users/:id/demote`, `GET /admin/organizations/:organizationId`, `PATCH /admin/organizations/:organizationId/features`, `GET /admin/audit-log` — consumed by Task 6's frontend service.

- [ ] **Step 1: Rewrite `admin.validation.ts`**

Replace the full contents of `backend/src/validations/admin.validation.ts` with:
```ts
import z from "zod";

const uuid = z.uuid('Invalid UUID');


export const toggleBlockUserSchema = {
    params: z.object({
        id: uuid,
    }),
};

export const growthStatsQuerySchema = {
  query: z.object({
    days: z.coerce.number().int().min(1).max(90).optional(),
  }),
};

export const promoteUserSchema = {
  params: z.object({
    id: uuid,
  }),
};

export const organizationIdParamSchema = {
  params: z.object({
    organizationId: uuid,
  }),
};

export const toggleOrgFeatureSchema = {
  params: z.object({
    organizationId: uuid,
  }),
  body: z.object({
    flag: z.enum(['chatEnabled', 'calendarEnabled']),
    enabled: z.boolean(),
  }),
};

export const auditLogQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
};
```

- [ ] **Step 2: Rewrite `admin.controller.ts`**

Replace the full contents of `backend/src/controllers/admin.controller.ts` with:
```ts
import type { Response } from 'express';
import { userRepository } from '../repositories/users.repository.js';
import { organizationRepository } from '../repositories/organization.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { taskRepository } from '../repositories/task.repository.js';
import { adminActionLogRepository } from '../repositories/adminActionLog.repository.js';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { serializeUser } from '../serializers/user.serializer.js';
import { notifyUser } from '../utils/notify.js';
import {
  buildPaginationMeta,
  getPaginationParams,
} from '../utils/pagination.utils.js';

//    GET ALL USERS (ADMIN ONLY)
export const getAllUsers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = getPaginationParams(req.query);

    const search = String(req.query.search || '').trim();

    const { rows: users, count: totalItems } =
      await userRepository.findAndCountAll({
        limit,
        offset,
        search,
      });

    const safeUsers = users.map(serializeUser);

    return ok(
      res,
      {
        items: safeUsers,
        meta: buildPaginationMeta({
          totalItems,
          page,
          limit,
          itemCount: safeUsers.length,
        }),
      },
      'Users retrieved successfully',
    );
  },
);

//   GET PLATFORM STATS (ADMIN ONLY)
export const getUserStats = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const [
      { totalUsers, blockedCount, adminsCount },
      totalOrganizations,
      suspendedOrgs,
      totalProjects,
      totalTasks,
    ] = await Promise.all([
      userRepository.getUsersStats(),
      organizationRepository.count(),
      organizationRepository.countSuspended(),
      projectRepository.countAll(),
      taskRepository.countAll(),
    ]);

    return ok(
      res,
      {
        totalUsers,
        blockedUsers: blockedCount,
        adminUsers: adminsCount,
        totalOrganizations,
        suspendedOrgs,
        totalProjects,
        totalTasks,
      },
      'Platform stats retrieved successfully',
    );
  },
);

//   GET GROWTH STATS (ADMIN ONLY) — new users/organizations per day
export const getGrowthStats = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const days = Number(req.query.days) || 30;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [userRows, orgRows] = await Promise.all([
      userRepository.countCreatedSince(since),
      organizationRepository.countCreatedSince(since),
    ]);

    const userMap = new Map(userRows.map((r) => [r.date, r.count]));
    const orgMap = new Map(orgRows.map((r) => [r.date, r.count]));

    const users: { date: string; count: number }[] = [];
    const organizations: { date: string; count: number }[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      users.push({ date: key, count: userMap.get(key) ?? 0 });
      organizations.push({ date: key, count: orgMap.get(key) ?? 0 });
    }

    return ok(res, { users, organizations }, 'Growth stats retrieved successfully');
  },
);

// BLOCK / UNBLOCK USER
export const blockAndUnblockUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const actor = req.user;
    if (!actor) throw new ApiError(401, 'Unauthorized');

    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const newStatus = !user.isActive;
    user.isActive = newStatus;

    await user.save();

    await adminActionLogRepository.create({
      actorId: actor.id,
      action: newStatus ? 'user_unblocked' : 'user_blocked',
      targetType: 'user',
      targetId: userId,
    });

    return ok(
      res,
      null,
      `User ${!newStatus ? 'blocked' : 'unblocked'} successfully`,
    );
  },
);

// PROMOTE USER TO SUPER ADMIN
export const promoteUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const actor = req.user;
    if (!actor) throw new ApiError(401, 'Unauthorized');

    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    user.role = 'SUPER_ADMIN';
    await user.save();

    await adminActionLogRepository.create({
      actorId: actor.id,
      action: 'user_promoted',
      targetType: 'user',
      targetId: userId,
    });

    return ok(res, serializeUser(user), 'User promoted to super admin successfully');
  },
);

// DEMOTE USER TO REGULAR USER
export const demoteUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const actor = req.user;
    if (!actor) throw new ApiError(401, 'Unauthorized');

    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    user.role = 'USER';
    await user.save();

    await adminActionLogRepository.create({
      actorId: actor.id,
      action: 'user_demoted',
      targetType: 'user',
      targetId: userId,
    });

    return ok(res, serializeUser(user), 'User demoted to regular user successfully');
  },
);

// GET ORGANIZATION DETAIL (SUPERADMIN ONLY)
export const getOrganizationDetail = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;

    const detail = await organizationRepository.findDetailById(organizationId);
    if (!detail) throw new ApiError(404, 'Organization not found');

    return ok(res, detail, 'Organization detail retrieved successfully');
  },
);

// TOGGLE ORGANIZATION FEATURE FLAG (SUPERADMIN ONLY)
export const toggleOrgFeature = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const { flag, enabled } = req.body as {
      flag: 'chatEnabled' | 'calendarEnabled';
      enabled: boolean;
    };
    const actor = req.user;
    if (!actor) throw new ApiError(401, 'Unauthorized');

    const org = await organizationRepository.updateFeatureFlags(organizationId, flag, enabled);
    if (!org) throw new ApiError(404, 'Organization not found');

    await adminActionLogRepository.create({
      actorId: actor.id,
      action: 'feature_toggled',
      targetType: 'organization',
      targetId: organizationId,
      metadata: { flag, enabled },
    });

    const flagLabel = flag === 'chatEnabled' ? 'Chat' : 'Calendar';
    await notifyUser({
      userId: org.ownerId,
      organizationId: org.id,
      type: 'org_feature_toggled',
      title: `${flagLabel} has been ${enabled ? 'enabled' : 'disabled'} for your organization`,
      body: `A super admin ${enabled ? 'enabled' : 'disabled'} the ${flagLabel.toLowerCase()} feature for ${org.name}.`,
      entityType: 'organization',
      entityId: org.id,
    });

    return ok(res, org, 'Feature flag updated successfully');
  },
);

// GET AUDIT LOG (SUPERADMIN ONLY)
export const getAuditLog = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { page, limit, offset } = getPaginationParams(req.query);

    const { rows, count: totalItems } = await adminActionLogRepository.findAndCountAll({ limit, offset });

    const items = rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      actor: row.actor ? { id: row.actor.id, name: row.actor.name, email: row.actor.email } : null,
    }));

    return ok(
      res,
      {
        items,
        meta: buildPaginationMeta({ totalItems, page, limit, itemCount: items.length }),
      },
      'Audit log retrieved successfully',
    );
  },
);
```

- [ ] **Step 3: Rewrite `admin.routes.ts`**

Replace the full contents of `backend/src/routes/admin.routes.ts` with:
```ts
import { Router } from 'express';
import {
  blockAndUnblockUser,
  getAllUsers,
  getUserStats,
  getGrowthStats,
  promoteUser,
  demoteUser,
  getOrganizationDetail,
  toggleOrgFeature,
  getAuditLog,
} from '../controllers/admin.controller.js';
import { isAdmin, verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  toggleBlockUserSchema,
  growthStatsQuerySchema,
  promoteUserSchema,
  organizationIdParamSchema,
  toggleOrgFeatureSchema,
  auditLogQuerySchema,
} from '../validations/admin.validation.js';

const router = Router();

router.route('/users').get(verifyJWT, isAdmin, getAllUsers);

router.route('/stats').get(verifyJWT, isAdmin, getUserStats);

router.route('/stats/growth').get(verifyJWT, isAdmin, validate(growthStatsQuerySchema), getGrowthStats);

router
  .route('/toggle-block/:id')
  .patch(
    verifyJWT,
    isAdmin,
    validate(toggleBlockUserSchema),
    blockAndUnblockUser,
  );

router.route('/users/:id/promote').patch(verifyJWT, isAdmin, validate(promoteUserSchema), promoteUser);

router.route('/users/:id/demote').patch(verifyJWT, isAdmin, validate(promoteUserSchema), demoteUser);

router.route('/organizations').get(verifyJWT, isAdmin, async (req, res, next) => {
  const { getAllOrganizations } = await import('../controllers/organization.controller.js');
  return getAllOrganizations(req, res, next);
});

router
  .route('/organizations/:organizationId')
  .get(verifyJWT, isAdmin, validate(organizationIdParamSchema), getOrganizationDetail);

router.route('/organizations/:organizationId/toggle-suspend').patch(verifyJWT, isAdmin, async (req, res, next) => {
  const { toggleSuspendOrganization } = await import('../controllers/organization.controller.js');
  return toggleSuspendOrganization(req, res, next);
});

router
  .route('/organizations/:organizationId/features')
  .patch(verifyJWT, isAdmin, validate(toggleOrgFeatureSchema), toggleOrgFeature);

router.route('/audit-log').get(verifyJWT, isAdmin, validate(auditLogQuerySchema), getAuditLog);

export default router;
```

- [ ] **Step 4: Audit log + owner notification on suspend/unsuspend**

Find in `backend/src/controllers/organization.controller.ts`:
```ts
import type { OrganizationInstance } from '../types/organizations.types.js';
import { userRepository } from '../repositories/users.repository.js';
import { Notification } from '../models/index.js';
import crypto from 'crypto';
import { cascadeRemoveUserFromOrgChannels, autoJoinUserToPublicChannels } from './channel.controller.js';
```
Replace with:
```ts
import type { OrganizationInstance } from '../types/organizations.types.js';
import { userRepository } from '../repositories/users.repository.js';
import { Notification } from '../models/index.js';
import crypto from 'crypto';
import { cascadeRemoveUserFromOrgChannels, autoJoinUserToPublicChannels } from './channel.controller.js';
import { notifyUser } from '../utils/notify.js';
import { adminActionLogRepository } from '../repositories/adminActionLog.repository.js';
```

Find:
```ts
// Toggle Suspend Organization (Superadmin only)
export const toggleSuspendOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;

    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    org.isSuspended = !org.isSuspended;
    await org.save();

    return ok(
      res,
      org,
      org.isSuspended
        ? 'Organization suspended successfully'
        : 'Organization unsuspended successfully'
    );
  }
);
```
Replace with:
```ts
// Toggle Suspend Organization (Superadmin only)
export const toggleSuspendOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.params.organizationId as string;

    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    org.isSuspended = !org.isSuspended;
    await org.save();

    const actor = req.user;
    if (actor) {
      await adminActionLogRepository.create({
        actorId: actor.id,
        action: org.isSuspended ? 'org_suspended' : 'org_unsuspended',
        targetType: 'organization',
        targetId: org.id,
      });
    }

    await notifyUser({
      userId: org.ownerId,
      organizationId: org.id,
      type: org.isSuspended ? 'org_suspended' : 'org_unsuspended',
      title: org.isSuspended
        ? 'Your organization has been suspended'
        : 'Your organization has been unsuspended',
      body: org.isSuspended
        ? `${org.name} has been suspended by a super admin.`
        : `${org.name} has been unsuspended and is active again.`,
      entityType: 'organization',
      entityId: org.id,
    });

    return ok(
      res,
      org,
      org.isSuspended
        ? 'Organization suspended successfully'
        : 'Organization unsuspended successfully'
    );
  }
);
```

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Manual verification**

With the dev server running and logged in as a `SUPER_ADMIN` user (grab the `accessToken` cookie value from browser dev tools):
```bash
curl -s -b "accessToken=<token>" http://localhost:8080/api/v1/admin/stats | head -c 500
curl -s -b "accessToken=<token>" "http://localhost:8080/api/v1/admin/stats/growth?days=7" | head -c 500
```
Expected: `stats` includes `totalOrganizations`, `suspendedOrgs`, `totalProjects`, `totalTasks` alongside the existing fields; `growth` returns `{ users: [...7 entries], organizations: [...7 entries] }`, each entry `{ date, count }`.

Then, pick a real organization ID and user ID from your dev DB and confirm:
```bash
curl -s -b "accessToken=<token>" http://localhost:8080/api/v1/admin/organizations/<orgId> | head -c 800
curl -s -b "accessToken=<token>" -X PATCH -H "Content-Type: application/json" \
  -d '{"flag":"chatEnabled","enabled":false}' \
  http://localhost:8080/api/v1/admin/organizations/<orgId>/features
curl -s -b "accessToken=<token>" http://localhost:8080/api/v1/admin/audit-log | head -c 500
```
Expected: org detail returns counts (no task/message content); the feature-toggle call returns the updated org with `featureFlags.chatEnabled: false`; the audit log includes a `feature_toggled` entry with the actor's name. Re-enable the flag afterward so later tasks aren't blocked by it.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/admin.controller.ts backend/src/validations/admin.validation.ts backend/src/routes/admin.routes.ts backend/src/controllers/organization.controller.ts
git commit -m "feat(admin): add stats/growth/org-detail/feature-toggle/promote/demote/audit-log endpoints"
```

---

## Task 5: Feature-flag enforcement on chat and calendar

**Files:**
- Modify: `backend/src/middlewares/auth.middleware.ts`
- Modify: `backend/src/controllers/channel.controller.ts`
- Modify: `backend/src/controllers/personalEvent.controller.ts`

**Interfaces:**
- Consumes: `Organization.featureFlags` (Task 1), `organizationRepository.findById` (already existing).
- Produces: 403 responses ("Chat has been disabled for this organization" / "Calendar has been disabled for this organization") from every route that touches chat or calendar when the org's respective flag is off.

- [ ] **Step 1: `isChannelOrgAdmin` — add the chat-flag check**

Find in `backend/src/middlewares/auth.middleware.ts`:
```ts
export const isChannelOrgAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelId = req.params.channelId as string;
  if (!channelId) throw new ApiError(400, 'Channel ID is required');

  const { Channel, Organization, OrganizationMember } = await import('../models/index.js');

  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const org = await Organization.findByPk(channel.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (org.isSuspended) {
    throw new ApiError(403, 'This organization has been suspended');
  }

  if (org.ownerId === user.id) {
    return next();
  }

  const member = await OrganizationMember.findOne({
    where: { organizationId: channel.organizationId, userId: user.id },
  });

  if (!member || member.role !== 'ORG_ADMIN') {
    throw new ApiError(403, 'Unauthorized request. Organization Admin role required.');
  }

  next();
};
```
Replace with:
```ts
export const isChannelOrgAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelId = req.params.channelId as string;
  if (!channelId) throw new ApiError(400, 'Channel ID is required');

  const { Channel, Organization, OrganizationMember } = await import('../models/index.js');

  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const org = await Organization.findByPk(channel.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (org.isSuspended) {
    throw new ApiError(403, 'This organization has been suspended');
  }

  if (!org.featureFlags.chatEnabled) {
    throw new ApiError(403, 'Chat has been disabled for this organization');
  }

  if (org.ownerId === user.id) {
    return next();
  }

  const member = await OrganizationMember.findOne({
    where: { organizationId: channel.organizationId, userId: user.id },
  });

  if (!member || member.role !== 'ORG_ADMIN') {
    throw new ApiError(403, 'Unauthorized request. Organization Admin role required.');
  }

  next();
};
```

- [ ] **Step 2: `isChannelMember` — add the chat-flag check**

Find:
```ts
export const isChannelMember = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelId = req.params.channelId as string;
  if (!channelId) throw new ApiError(400, 'Channel ID is required');

  const { Channel, ChannelMember, Organization } = await import('../models/index.js');

  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const org = await Organization.findByPk(channel.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (org.isSuspended) {
    throw new ApiError(403, 'This organization has been suspended');
  }

  const membership = await ChannelMember.findOne({ where: { channelId, userId: user.id } });
  if (!membership) {
    throw new ApiError(403, 'Unauthorized request. Channel membership required.');
  }

  next();
};
```
Replace with:
```ts
export const isChannelMember = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channelId = req.params.channelId as string;
  if (!channelId) throw new ApiError(400, 'Channel ID is required');

  const { Channel, ChannelMember, Organization } = await import('../models/index.js');

  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new ApiError(404, 'Channel not found');

  const org = await Organization.findByPk(channel.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (org.isSuspended) {
    throw new ApiError(403, 'This organization has been suspended');
  }

  if (!org.featureFlags.chatEnabled) {
    throw new ApiError(403, 'Chat has been disabled for this organization');
  }

  const membership = await ChannelMember.findOne({ where: { channelId, userId: user.id } });
  if (!membership) {
    throw new ApiError(403, 'Unauthorized request. Channel membership required.');
  }

  next();
};
```

- [ ] **Step 3: `createChannel` — add the chat-flag check**

Find in `backend/src/controllers/channel.controller.ts`:
```ts
export const createChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const { name, type } = req.body as { name: string; type: 'PUBLIC' | 'PRIVATE' };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const existing = await channelRepository.findByOrgAndName(organizationId, name.trim());
```
Replace with:
```ts
export const createChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const { name, type } = req.body as { name: string; type: 'PUBLIC' | 'PRIVATE' };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.chatEnabled) throw new ApiError(403, 'Chat has been disabled for this organization');

  const existing = await channelRepository.findByOrgAndName(organizationId, name.trim());
```

- [ ] **Step 4: `listChannels` — add the chat-flag check**

Find:
```ts
export const listChannels = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channels = await channelRepository.findVisibleToUser(organizationId, user.id);
  return ok(res, channels, 'Channels retrieved successfully');
});
```
Replace with:
```ts
export const listChannels = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.chatEnabled) throw new ApiError(403, 'Chat has been disabled for this organization');

  const channels = await channelRepository.findVisibleToUser(organizationId, user.id);
  return ok(res, channels, 'Channels retrieved successfully');
});
```

- [ ] **Step 5: `startDM` — add the chat-flag check**

Find:
```ts
  if (targetUserId === user.id) throw new ApiError(400, 'Cannot start a DM with yourself');

  const org = await organizationRepository.findById(organizationId);
  const targetMembership = await organizationMemberRepository.findOne({ organizationId, userId: targetUserId });
```
Replace with:
```ts
  if (targetUserId === user.id) throw new ApiError(400, 'Cannot start a DM with yourself');

  const org = await organizationRepository.findById(organizationId);
  if (org && !org.featureFlags.chatEnabled) {
    throw new ApiError(403, 'Chat has been disabled for this organization');
  }
  const targetMembership = await organizationMemberRepository.findOne({ organizationId, userId: targetUserId });
```

- [ ] **Step 6: `listDMs` — add the chat-flag check**

Find:
```ts
export const listDMs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const channels = await channelRepository.findDMsForUser(organizationId, user.id);
```
Replace with:
```ts
export const listDMs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.params.organizationId as string;
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.chatEnabled) throw new ApiError(403, 'Chat has been disabled for this organization');

  const channels = await channelRepository.findDMsForUser(organizationId, user.id);
```

- [ ] **Step 7: Rewrite `personalEvent.controller.ts` with the calendar-flag check**

Replace the full contents of `backend/src/controllers/personalEvent.controller.ts` with:
```ts
import type { Response } from 'express';
import { personalEventRepository } from '../repositories/personalEvent.repository.js';
import { organizationRepository } from '../repositories/organization.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import type { AuthRequest } from '../types/auth.types.js';

export const listMyPersonalEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { organizationId } = req.params as { organizationId: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.calendarEnabled) throw new ApiError(403, 'Calendar has been disabled for this organization');

  const events = await personalEventRepository.findMineInOrg(userId, organizationId);
  return ok(res, events, 'Personal events retrieved successfully');
});

export const createPersonalEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { organizationId } = req.params as { organizationId: string };
  const { title, dueDate } = req.body as { title: string; dueDate: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const org = await organizationRepository.findById(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (!org.featureFlags.calendarEnabled) throw new ApiError(403, 'Calendar has been disabled for this organization');

  const event = await personalEventRepository.create({ userId, organizationId, title, dueDate });
  return ok(res, event, 'Personal event created successfully');
});

export const deletePersonalEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { eventId } = req.params as { eventId: string };
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const event = await personalEventRepository.findByIdForUser(eventId, userId);
  if (!event) throw new ApiError(404, 'Personal event not found');

  await personalEventRepository.delete(eventId);
  return ok(res, null, 'Personal event deleted successfully');
});
```

- [ ] **Step 8: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 9: Manual verification**

Using the org you toggled `chatEnabled: false` for in Task 4's verification (re-toggle it off again if you already re-enabled it), confirm as a member of that org:
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" -b "accessToken=<memberToken>" \
  http://localhost:8080/api/v1/organizations/<orgId>/channels
```
Expected: `HTTP 403`. Re-enable `chatEnabled` via `PATCH /admin/organizations/<orgId>/features` and confirm it returns `HTTP 200` again. Repeat the same on/off check for `calendarEnabled` against `GET /organizations/<orgId>/personal-events`.

- [ ] **Step 10: Commit**

```bash
git add backend/src/middlewares/auth.middleware.ts backend/src/controllers/channel.controller.ts backend/src/controllers/personalEvent.controller.ts
git commit -m "feat(admin): enforce chatEnabled/calendarEnabled feature flags on chat and calendar routes"
```

---

## Task 6: Frontend types, admin service, and hooks

**Files:**
- Modify: `frontend/src/types/organization.types.ts`
- Create: `frontend/src/types/admin.types.ts`
- Create: `frontend/src/services/admin.service.ts`
- Create: `frontend/src/hooks/useAdmin.ts`

**Interfaces:**
- Consumes: `api` (`@/lib/axios`).
- Produces: `OrganizationFeatureFlags`, `PlatformStats`, `GrowthPoint`, `GrowthStats`, `AdminUser`, `AdminOrganizationSummary`, `AdminOrganizationDetail`, `AuditLogEntry`, `PaginationMeta`, `PaginatedResponse<T>` types; `useAdminStats()`, `useAdminGrowth(days)`, `useAdminUsers(params)`, `useToggleBlockUser()`, `usePromoteUser()`, `useDemoteUser()`, `useAdminOrganizations()`, `useAdminOrganizationDetail(organizationId)`, `useToggleSuspendOrganization()`, `useToggleOrgFeature()`, `useAuditLog(params)` — consumed by Tasks 8–10.

- [ ] **Step 1: Add `featureFlags` to the frontend `Organization` type**

Find in `frontend/src/types/organization.types.ts`:
```ts
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
}
```
Replace with:
```ts
export interface OrganizationFeatureFlags {
  chatEnabled: boolean;
  calendarEnabled: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  isSuspended: boolean;
  featureFlags: OrganizationFeatureFlags;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Create `admin.types.ts`**

Create `frontend/src/types/admin.types.ts`:
```ts
import type { OrganizationFeatureFlags } from './organization.types';

export interface PlatformStats {
  totalUsers: number;
  blockedUsers: number;
  adminUsers: number;
  totalOrganizations: number;
  suspendedOrgs: number;
  totalProjects: number;
  totalTasks: number;
}

export interface GrowthPoint {
  date: string;
  count: number;
}

export interface GrowthStats {
  users: GrowthPoint[];
  organizations: GrowthPoint[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'SUPER_ADMIN';
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AdminOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  isSuspended: boolean;
  featureFlags: OrganizationFeatureFlags;
  ownerId: string;
  createdAt: string;
  owner?: { id: string; name: string; email: string };
}

export interface AdminOrganizationDetail {
  org: AdminOrganizationSummary;
  memberCount: number;
  projectCount: number;
  taskCount: number;
  attachmentCount: number;
  lastActivityAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: 'user' | 'organization';
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: { items: T[]; meta: PaginationMeta };
}
```

- [ ] **Step 3: Create `admin.service.ts`**

Create `frontend/src/services/admin.service.ts`:
```ts
import { api } from '@/lib/axios';
import type {
  PlatformStats,
  GrowthStats,
  AdminUser,
  AdminOrganizationSummary,
  AdminOrganizationDetail,
  AuditLogEntry,
  PaginatedResponse,
} from '@/types/admin.types';

export async function getPlatformStats(): Promise<PlatformStats> {
  const res = await api.get<{ success: boolean; message: string; data: PlatformStats }>('/admin/stats');
  return res.data.data;
}

export async function getGrowthStats(days = 30): Promise<GrowthStats> {
  const res = await api.get<{ success: boolean; message: string; data: GrowthStats }>('/admin/stats/growth', {
    params: { days },
  });
  return res.data.data;
}

export async function getAdminUsers(params: { page?: number; limit?: number; search?: string }) {
  const res = await api.get<PaginatedResponse<AdminUser>>('/admin/users', { params });
  return res.data.data;
}

export async function toggleBlockUser(userId: string): Promise<void> {
  await api.patch(`/admin/toggle-block/${userId}`);
}

export async function promoteUser(userId: string): Promise<AdminUser> {
  const res = await api.patch<{ success: boolean; message: string; data: AdminUser }>(`/admin/users/${userId}/promote`);
  return res.data.data;
}

export async function demoteUser(userId: string): Promise<AdminUser> {
  const res = await api.patch<{ success: boolean; message: string; data: AdminUser }>(`/admin/users/${userId}/demote`);
  return res.data.data;
}

export async function getAdminOrganizations(): Promise<AdminOrganizationSummary[]> {
  const res = await api.get<{ success: boolean; message: string; data: AdminOrganizationSummary[] }>('/admin/organizations');
  return res.data.data;
}

export async function getAdminOrganizationDetail(organizationId: string): Promise<AdminOrganizationDetail> {
  const res = await api.get<{ success: boolean; message: string; data: AdminOrganizationDetail }>(
    `/admin/organizations/${organizationId}`
  );
  return res.data.data;
}

export async function toggleSuspendOrganization(organizationId: string): Promise<void> {
  await api.patch(`/admin/organizations/${organizationId}/toggle-suspend`);
}

export async function toggleOrgFeature(
  organizationId: string,
  flag: 'chatEnabled' | 'calendarEnabled',
  enabled: boolean,
): Promise<void> {
  await api.patch(`/admin/organizations/${organizationId}/features`, { flag, enabled });
}

export async function getAuditLog(params: { page?: number; limit?: number }) {
  const res = await api.get<PaginatedResponse<AuditLogEntry>>('/admin/audit-log', { params });
  return res.data.data;
}
```

- [ ] **Step 4: Create `useAdmin.ts`**

Create `frontend/src/hooks/useAdmin.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPlatformStats,
  getGrowthStats,
  getAdminUsers,
  toggleBlockUser,
  promoteUser,
  demoteUser,
  getAdminOrganizations,
  getAdminOrganizationDetail,
  toggleSuspendOrganization,
  toggleOrgFeature,
  getAuditLog,
} from '@/services/admin.service';

export const useAdminStats = () =>
  useQuery({ queryKey: ['admin', 'stats'], queryFn: getPlatformStats });

export const useAdminGrowth = (days = 30) =>
  useQuery({ queryKey: ['admin', 'stats', 'growth', days], queryFn: () => getGrowthStats(days) });

export const useAdminUsers = (params: { page?: number; limit?: number; search?: string }) =>
  useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => getAdminUsers(params),
  });

export const useToggleBlockUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleBlockUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const usePromoteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: promoteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useDemoteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: demoteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useAdminOrganizations = () =>
  useQuery({ queryKey: ['admin', 'organizations'], queryFn: getAdminOrganizations });

export const useAdminOrganizationDetail = (organizationId: string | null) =>
  useQuery({
    queryKey: ['admin', 'organizations', organizationId],
    queryFn: () => getAdminOrganizationDetail(organizationId as string),
    enabled: !!organizationId,
  });

export const useToggleSuspendOrganization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleSuspendOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  });
};

export const useToggleOrgFeature = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      flag,
      enabled,
    }: {
      organizationId: string;
      flag: 'chatEnabled' | 'calendarEnabled';
      enabled: boolean;
    }) => toggleOrgFeature(organizationId, flag, enabled),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      qc.invalidateQueries({ queryKey: ['admin', 'organizations', variables.organizationId] });
    },
  });
};

export const useAuditLog = (params: { page?: number; limit?: number }) =>
  useQuery({ queryKey: ['admin', 'audit-log', params], queryFn: () => getAuditLog(params) });
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/organization.types.ts frontend/src/types/admin.types.ts frontend/src/services/admin.service.ts frontend/src/hooks/useAdmin.ts
git commit -m "feat(admin): add frontend types/service/hooks for the admin panel"
```

---

## Task 7: Admin entry point, layout guard, and org feature-flag nav gating

**Files:**
- Create: `frontend/src/components/layout/AdminLayout.tsx`
- Create: `frontend/src/app/admin/layout.tsx`
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (`@/store/auth.store`), `useLogout` (`@/hooks/useAuth`), `Logo` (`@/components/shared/Logo`), `cn` (`@/lib/utils`).
- Produces: `/admin` route guard (redirects non-`SUPER_ADMIN` users to `/`); a "Super Admin" sidebar link in `DashboardLayout` visible only to `SUPER_ADMIN` users; Calendar/Chat nav items hidden when the active org's `featureFlags` disable them.

- [ ] **Step 1: Create `AdminLayout`**

Create `frontend/src/components/layout/AdminLayout.tsx`:
```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Building2, Users, ScrollText, LogOut, ArrowLeft } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2, exact: false },
  { name: 'Users', href: '/admin/users', icon: Users, exact: false },
  { name: 'Audit Log', href: '/admin/audit-log', icon: ScrollText, exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => router.push('/auth/login') });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border-subtle bg-primary">
        <div className="flex h-14 items-center gap-2 border-b border-border-subtle px-4">
          <Logo />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Super Admin</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                  active
                    ? 'bg-white text-primary font-medium'
                    : 'text-white hover:bg-primary-foreground hover:text-primary'
                )}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border-subtle p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white hover:bg-primary-foreground hover:text-primary transition-all"
          >
            <ArrowLeft size={18} />
            <span>Back to app</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white hover:bg-primary-foreground hover:text-primary transition-all"
          >
            <LogOut size={18} />
            <span>Logout{user?.name ? ` (${user.name})` : ''}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create the `/admin` layout guard**

Create `frontend/src/app/admin/layout.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/store/auth.store';

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated || user?.role !== 'SUPER_ADMIN') {
      router.push('/');
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-text-secondary" size={24} />
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
```

- [ ] **Step 3: Hide Calendar/Chat nav items when the org disables them**

Find in `frontend/src/components/layout/DashboardLayout.tsx`:
```tsx
import {
  Bell,
  BellOff,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  Users,
  X,
  Hash,
  Lock,
} from 'lucide-react';
```
Replace with:
```tsx
import {
  Bell,
  BellOff,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  X,
  Hash,
  Lock,
} from 'lucide-react';
```

Find:
```tsx
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
```
Replace with:
```tsx
    {
      name: 'Calendar',
      href: currentSlug ? `/org/${currentSlug}/calendar` : '#',
      icon: CalendarDays,
      disabled: !currentSlug || activeOrg?.featureFlags?.calendarEnabled === false,
    },
    {
      name: 'Chat',
      href: currentSlug ? `/org/${currentSlug}/chat` : '#',
      icon: MessageSquare,
      disabled: !currentSlug || activeOrg?.featureFlags?.chatEnabled === false,
      badgeCount: currentSlug ? unreadChannels?.length : undefined,
    },
```

- [ ] **Step 4: Add the "Super Admin" entry point**

Find:
```tsx
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-border-subtle p-3">
```
Replace with:
```tsx
        </nav>

        {user?.role === 'SUPER_ADMIN' && (
          <div className="border-t border-border-subtle p-3">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white hover:bg-primary-foreground hover:text-primary transition-all"
            >
              <ShieldCheck size={18} />
              <span>Super Admin</span>
            </Link>
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="border-t border-border-subtle p-3">
```

- [ ] **Step 5: Typecheck and lint**

Run: `cd frontend && npx tsc --noEmit && npx eslint src/components/layout/DashboardLayout.tsx src/components/layout/AdminLayout.tsx src/app/admin/layout.tsx`
Expected: no output/errors.

- [ ] **Step 6: Manual verification**

Log in as a `SUPER_ADMIN` user — confirm a "Super Admin" link appears at the bottom of the sidebar and navigates to `/admin` (which will 404/blank until Task 8 adds `page.tsx` — confirming the layout guard itself renders without redirecting is enough for this task). Log in as a regular user and confirm the link is absent, and manually visiting `/admin` redirects to `/`. Then, using the org you feature-toggled off in Task 5, confirm its members no longer see "Calendar"/"Chat" in the sidebar; re-enable and confirm they reappear.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/AdminLayout.tsx frontend/src/app/admin/layout.tsx frontend/src/components/layout/DashboardLayout.tsx
git commit -m "feat(admin): add super admin entry point, layout guard, and feature-flag nav gating"
```

---

## Task 8: Stats dashboard page + growth chart

**Files:**
- Create: `frontend/src/app/admin/_components/GrowthChart.tsx`
- Create: `frontend/src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `useAdminStats`, `useAdminGrowth` (Task 6); `GrowthPoint` type (Task 6).

- [ ] **Step 1: Create the growth chart**

Create `frontend/src/app/admin/_components/GrowthChart.tsx`:
```tsx
'use client';

import type { GrowthPoint } from '@/types/admin.types';

interface GrowthChartProps {
  users: GrowthPoint[];
  organizations: GrowthPoint[];
}

const WIDTH = 640;
const HEIGHT = 200;
const PADDING_LEFT = 24;
const PADDING_RIGHT = 40;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 16;

function buildPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

// Minimal by design: a native <title> per point is the hover layer here
// (no crosshair/tooltip component) — this is an internal 30-day admin
// chart, not a customer-facing one.
export default function GrowthChart({ users, organizations }: GrowthChartProps) {
  const maxCount = Math.max(1, ...users.map((p) => p.count), ...organizations.map((p) => p.count));
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = users.length > 1 ? plotWidth / (users.length - 1) : 0;

  const toPoints = (series: GrowthPoint[]) =>
    series.map((p, i) => ({
      x: PADDING_LEFT + i * stepX,
      y: PADDING_TOP + plotHeight - (p.count / maxCount) * plotHeight,
      count: p.count,
      date: p.date,
    }));

  const userPoints = toPoints(users);
  const orgPoints = toPoints(organizations);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => PADDING_TOP + plotHeight * t);
  const lastUser = userPoints[userPoints.length - 1];
  const lastOrg = orgPoints[orgPoints.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="New users and organizations per day"
      >
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={PADDING_LEFT}
            x2={WIDTH - PADDING_RIGHT}
            y1={y}
            y2={y}
            stroke="var(--color-border-subtle)"
            strokeWidth={1}
          />
        ))}

        <path
          d={buildPath(userPoints)}
          fill="none"
          stroke="var(--color-workspace-northpeak)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={buildPath(orgPoints)}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {userPoints.map((p, i) => (
          <circle key={`u-${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-workspace-northpeak)" stroke="var(--color-surface)" strokeWidth={2}>
            <title>{`${p.date}: ${p.count} new users`}</title>
          </circle>
        ))}
        {orgPoints.map((p, i) => (
          <circle key={`o-${i}`} cx={p.x} cy={p.y} r={4} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth={2}>
            <title>{`${p.date}: ${p.count} new organizations`}</title>
          </circle>
        ))}

        {lastUser && (
          <text x={lastUser.x + 6} y={lastUser.y} dominantBaseline="middle" fill="var(--color-text-secondary)" className="text-[10px] font-medium">
            {lastUser.count}
          </text>
        )}
        {lastOrg && (
          <text x={lastOrg.x + 6} y={lastOrg.y} dominantBaseline="middle" fill="var(--color-text-secondary)" className="text-[10px] font-medium">
            {lastOrg.count}
          </text>
        )}
      </svg>

      <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-workspace-northpeak)' }} />
          New users
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
          New organizations
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the overview page**

Create `frontend/src/app/admin/page.tsx`:
```tsx
'use client';

import { useAdminStats, useAdminGrowth } from '@/hooks/useAdmin';
import GrowthChart from './_components/GrowthChart';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: growth, isLoading: growthLoading } = useAdminGrowth(30);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Platform Overview</h1>

      {statsLoading || !stats ? (
        <p className="text-sm text-text-muted">Loading stats…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Total organizations" value={stats.totalOrganizations} />
          <StatTile label="Suspended organizations" value={stats.suspendedOrgs} />
          <StatTile label="Total users" value={stats.totalUsers} />
          <StatTile label="Blocked users" value={stats.blockedUsers} />
          <StatTile label="Total projects" value={stats.totalProjects} />
          <StatTile label="Total tasks" value={stats.totalTasks} />
        </div>
      )}

      <div className="rounded-xl border border-border-subtle bg-white p-5">
        <h2 className="text-sm font-semibold text-text-primary">New users & organizations — last 30 days</h2>
        {growthLoading || !growth ? (
          <p className="mt-4 text-sm text-text-muted">Loading…</p>
        ) : (
          <div className="mt-4">
            <GrowthChart users={growth.users} organizations={growth.organizations} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `cd frontend && npx tsc --noEmit && npx eslint src/app/admin/page.tsx src/app/admin/_components/GrowthChart.tsx`
Expected: no output/errors.

- [ ] **Step 4: Manual verification**

Open `/admin` as a super admin. Confirm the six stat tiles show real counts matching the DB, and the chart renders two lines (purple = users, gold = organizations) with a legend below and a number labeled at the end of each line. Hover over a point and confirm a native tooltip shows the date and count.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/_components/GrowthChart.tsx frontend/src/app/admin/page.tsx
git commit -m "feat(admin): add platform stats dashboard with growth chart"
```

---

## Task 9: Organizations management page

**Files:**
- Create: `frontend/src/app/admin/organizations/page.tsx`

**Interfaces:**
- Consumes: `useAdminOrganizations`, `useAdminOrganizationDetail`, `useToggleSuspendOrganization`, `useToggleOrgFeature` (Task 6); `Badge` (`@/components/ui/badge`), `Checkbox` (`@/components/ui/checkbox`), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` (`@/components/ui/dialog`), `ConfirmationDialog` (`@/components/shared/ConfirmationDialog`), `parseApiError` (`@/lib/axios`).

- [ ] **Step 1: Create the page**

Create `frontend/src/app/admin/organizations/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  useAdminOrganizations,
  useAdminOrganizationDetail,
  useToggleSuspendOrganization,
  useToggleOrgFeature,
} from '@/hooks/useAdmin';
import { parseApiError } from '@/lib/axios';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';

export default function AdminOrganizationsPage() {
  const { data: organizations, isLoading } = useAdminOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string; isSuspended: boolean } | null>(null);

  const { data: detail, isLoading: detailLoading } = useAdminOrganizationDetail(selectedOrgId);
  const toggleSuspend = useToggleSuspendOrganization();
  const toggleFeature = useToggleOrgFeature();

  const handleToggleFeature = (organizationId: string, flag: 'chatEnabled' | 'calendarEnabled', enabled: boolean) => {
    toggleFeature.mutate(
      { organizationId, flag, enabled },
      { onError: (err) => toast.error(parseApiError(err).message) }
    );
  };

  const confirmToggleSuspend = () => {
    if (!suspendTarget) return;
    toggleSuspend.mutate(suspendTarget.id, {
      onSuccess: () => {
        toast.success(suspendTarget.isSuspended ? 'Organization unsuspended' : 'Organization suspended');
        setSuspendTarget(null);
      },
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Organizations</h1>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading organizations…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
          {organizations?.map((org) => (
            <div
              key={org.id}
              className="flex items-center justify-between border-b border-border-subtle px-4 py-3 last:border-b-0"
            >
              <button onClick={() => setSelectedOrgId(org.id)} className="flex-1 text-left">
                <p className="text-sm font-medium text-text-primary">{org.name}</p>
                <p className="text-xs text-text-muted">{org.owner?.email ?? 'Unknown owner'}</p>
              </button>
              <div className="flex items-center gap-3">
                {org.isSuspended ? <Badge variant="danger">Suspended</Badge> : <Badge>Active</Badge>}
                <button
                  onClick={() => setSuspendTarget({ id: org.id, name: org.name, isSuspended: org.isSuspended })}
                  className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
                >
                  {org.isSuspended ? 'Unsuspend' : 'Suspend'}
                </button>
              </div>
            </div>
          ))}
          {organizations?.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-muted">No organizations yet</p>
          )}
        </div>
      )}

      <Dialog open={!!selectedOrgId} onOpenChange={(open) => !open && setSelectedOrgId(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{detail?.org.name ?? 'Organization'}</DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-text-secondary" size={20} />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-text-muted">Members</p>
                  <p className="font-medium text-text-primary">{detail.memberCount}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Projects</p>
                  <p className="font-medium text-text-primary">{detail.projectCount}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Tasks</p>
                  <p className="font-medium text-text-primary">{detail.taskCount}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Attachments</p>
                  <p className="font-medium text-text-primary">{detail.attachmentCount}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-text-muted">Last activity</p>
                  <p className="font-medium text-text-primary">
                    {detail.lastActivityAt ? new Date(detail.lastActivityAt).toLocaleString() : 'No activity yet'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-border-subtle pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Features</p>
                <label className="flex items-center gap-2.5 text-sm text-text-primary">
                  <Checkbox
                    checked={detail.org.featureFlags.chatEnabled}
                    onCheckedChange={(checked) => handleToggleFeature(detail.org.id, 'chatEnabled', checked === true)}
                  />
                  Chat enabled
                </label>
                <label className="flex items-center gap-2.5 text-sm text-text-primary">
                  <Checkbox
                    checked={detail.org.featureFlags.calendarEnabled}
                    onCheckedChange={(checked) => handleToggleFeature(detail.org.id, 'calendarEnabled', checked === true)}
                  />
                  Calendar enabled
                </label>
              </div>

              <div className="flex items-center gap-2 border-t border-border-subtle pt-4 text-xs text-text-secondary">
                {detail.org.isSuspended ? (
                  <>
                    <ShieldAlert size={14} className="text-danger" /> This organization is suspended
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} className="text-success" /> This organization is active
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={confirmToggleSuspend}
        title={suspendTarget?.isSuspended ? 'Unsuspend organization' : 'Suspend organization'}
        description={
          suspendTarget?.isSuspended
            ? `${suspendTarget?.name} will regain full access immediately.`
            : `${suspendTarget?.name} will lose access immediately. Members won't be able to use the app until unsuspended.`
        }
        confirmText={suspendTarget?.isSuspended ? 'Unsuspend' : 'Suspend'}
        isDestructive={!suspendTarget?.isSuspended}
        isLoading={toggleSuspend.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `cd frontend && npx tsc --noEmit && npx eslint src/app/admin/organizations/page.tsx`
Expected: no output/errors.

- [ ] **Step 3: Manual verification**

Open `/admin/organizations`. Click an org row — confirm the detail dialog shows counts and the two feature checkboxes reflecting current state. Toggle "Chat enabled" off — confirm the checkbox updates, and (from Task 5/7's verification) that org's members lose the Chat nav item and get 403s on the channels API. Click "Suspend" on an org — confirm the confirmation dialog appears, and confirming flips the badge to "Suspended".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/organizations/page.tsx
git commit -m "feat(admin): add organizations management page"
```

---

## Task 10: Users management page

**Files:**
- Create: `frontend/src/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `useAdminUsers`, `useToggleBlockUser`, `usePromoteUser`, `useDemoteUser` (Task 6); `useAuthStore` (`@/store/auth.store`); `Badge` (`@/components/ui/badge`), `Input` (`@/components/ui/input`), `ConfirmationDialog` (`@/components/shared/ConfirmationDialog`).

- [ ] **Step 1: Create the page**

Create `frontend/src/app/admin/users/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldMinus, ShieldPlus } from 'lucide-react';
import { useAdminUsers, useToggleBlockUser, usePromoteUser, useDemoteUser } from '@/hooks/useAdmin';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import type { AdminUser } from '@/types/admin.types';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers({ page, limit: 20, search });

  const toggleBlock = useToggleBlockUser();
  const promote = usePromoteUser();
  const demote = useDemoteUser();

  const [roleTarget, setRoleTarget] = useState<{ user: AdminUser; action: 'promote' | 'demote' } | null>(null);

  const handleToggleBlock = (userId: string) => {
    toggleBlock.mutate(userId, {
      onSuccess: () => toast.success('User status updated'),
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  const confirmRoleChange = () => {
    if (!roleTarget) return;
    const mutation = roleTarget.action === 'promote' ? promote : demote;
    mutation.mutate(roleTarget.user.id, {
      onSuccess: () => {
        toast.success(roleTarget.action === 'promote' ? 'User promoted to super admin' : 'User demoted to regular user');
        setRoleTarget(null);
      },
      onError: (err) => toast.error(parseApiError(err).message),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Users</h1>
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-text-muted">Loading users…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
            {data.items.map((u) => (
              <div key={u.id} className="flex items-center justify-between border-b border-border-subtle px-4 py-3 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-text-primary">{u.name}</p>
                  <p className="text-xs text-text-muted">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.role === 'SUPER_ADMIN' && <Badge>Super Admin</Badge>}
                  {!u.isActive && <Badge variant="danger">Blocked</Badge>}
                  {u.id !== currentUser?.id && (
                    <>
                      <button
                        onClick={() => handleToggleBlock(u.id)}
                        className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
                      >
                        {u.isActive ? 'Block' : 'Unblock'}
                      </button>
                      <button
                        onClick={() => setRoleTarget({ user: u, action: u.role === 'SUPER_ADMIN' ? 'demote' : 'promote' })}
                        className="flex items-center gap-1 rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
                      >
                        {u.role === 'SUPER_ADMIN' ? <ShieldMinus size={13} /> : <ShieldPlus size={13} />}
                        {u.role === 'SUPER_ADMIN' ? 'Demote' : 'Promote'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {data.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-muted">No users found</p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              Page {data.meta.currentPage} of {Math.max(1, data.meta.totalPages)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-border-subtle px-3 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-md border border-border-subtle px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmationDialog
        isOpen={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        onConfirm={confirmRoleChange}
        title={roleTarget?.action === 'promote' ? 'Promote to Super Admin' : 'Demote to regular user'}
        description={
          roleTarget?.action === 'promote'
            ? `${roleTarget?.user.name} will gain full super admin access to this panel.`
            : `${roleTarget?.user.name} will lose super admin access.`
        }
        confirmText={roleTarget?.action === 'promote' ? 'Promote' : 'Demote'}
        isDestructive={roleTarget?.action === 'demote'}
        isLoading={promote.isPending || demote.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `cd frontend && npx tsc --noEmit && npx eslint src/app/admin/users/page.tsx`
Expected: no output/errors.

- [ ] **Step 3: Manual verification**

Open `/admin/users`. Search for a known user by name/email — confirm results filter. Block a test user — confirm the "Blocked" badge appears and that user can no longer log in. Promote a test user to Super Admin (confirm dialog appears first) — confirm the badge appears and that user can now access `/admin` on their next login. Demote them back. Confirm your own row shows no Block/Promote buttons (self-action guard).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/users/page.tsx
git commit -m "feat(admin): add users management page"
```

---

## Task 11: Audit log page

**Files:**
- Create: `frontend/src/app/admin/audit-log/page.tsx`

**Interfaces:**
- Consumes: `useAuditLog` (Task 6).

- [ ] **Step 1: Create the page**

Create `frontend/src/app/admin/audit-log/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useAuditLog } from '@/hooks/useAdmin';

const ACTION_LABELS: Record<string, string> = {
  user_blocked: 'Blocked user',
  user_unblocked: 'Unblocked user',
  user_promoted: 'Promoted user to Super Admin',
  user_demoted: 'Demoted user to regular user',
  org_suspended: 'Suspended organization',
  org_unsuspended: 'Unsuspended organization',
  feature_toggled: 'Toggled organization feature',
};

export default function AdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog({ page, limit: 25 });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Audit Log</h1>

      {isLoading || !data ? (
        <p className="text-sm text-text-muted">Loading audit log…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
            {data.items.map((entry) => (
              <div key={entry.id} className="border-b border-border-subtle px-4 py-3 last:border-b-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                  <p className="text-xs text-text-muted">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {entry.actor?.name ?? 'Unknown admin'} · target: {entry.targetType} {entry.targetId}
                  {entry.metadata ? ` · ${JSON.stringify(entry.metadata)}` : ''}
                </p>
              </div>
            ))}
            {data.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-muted">No admin actions yet</p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              Page {data.meta.currentPage} of {Math.max(1, data.meta.totalPages)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-border-subtle px-3 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-md border border-border-subtle px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `cd frontend && npx tsc --noEmit && npx eslint src/app/admin/audit-log/page.tsx`
Expected: no output/errors.

- [ ] **Step 3: Manual verification**

Open `/admin/audit-log`. Confirm every action performed while verifying Tasks 4–10 (block/unblock, promote/demote, suspend/unsuspend, feature toggles) shows up, newest first, with a human-readable label, the correct actor name, and (for feature toggles) the flag/enabled metadata visible.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/audit-log/page.tsx
git commit -m "feat(admin): add audit log page"
```

---

## Final Verification

- [ ] **Full backend typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no output.

- [ ] **Full frontend typecheck + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: no output / no new errors.

- [ ] **Grep for raw palette colors in touched frontend files**

Run:
```bash
grep -rn "gray-\|blue-\|red-\|emerald-\|amber-\|orange-" \
  frontend/src/app/admin frontend/src/components/layout/AdminLayout.tsx \
  frontend/src/components/layout/DashboardLayout.tsx
```
Expected: no output.

- [ ] **Full manual pass**

Walk through the design spec's Testing section end-to-end in one sitting:
1. `/admin` shows correct stat cards and a 30-day growth chart; a non-super-admin is redirected away.
2. Suspending an org from `/admin/organizations` flips its status, logs an `AdminActionLog` row, and notifies the owner.
3. Toggling `chatEnabled`/`calendarEnabled` off: nav item disappears for that org's members, the underlying API 403s, an audit row appears, and the owner is notified. Re-enabling reverses all of it.
4. Blocking/promoting/demoting a user from `/admin/users` works and is reflected in the audit log.
5. No endpoint anywhere in this feature returns task titles, message bodies, or personal event data — only counts.
