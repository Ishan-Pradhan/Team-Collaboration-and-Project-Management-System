# Real-Time Activity Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-built-but-dormant `ActivityLog` system real-time and complete: wire up the never-fired `member_added`/new `member_removed` events, add live delivery via a new `project:{id}` socket room, and add a per-project "Activity" tab alongside the org dashboard's existing "Recent Activity" panel (which just needs to start updating live).

**Architecture:** A new `logActivity()` helper wraps the existing `activityLogRepository.log()` with a socket emit to a new `project:{projectId}` room. All six activity-producing call sites (4 existing in `task.controller.ts`, 2 new in `project.controller.ts`) route through it. The frontend extracts the org dashboard's existing `ActivityRow`/`buildActivityText`/`ACTIVITY_ICON` into a shared component (adding a `member_removed` case and fixing `member_added`'s text to name who did the adding), reuses it in a new project-level Activity tab, and adds a live-invalidation listener to both surfaces.

**Tech Stack:** Express 5, Sequelize 6, Socket.io, Next.js 16, TanStack Query.

## Global Constraints

- Follow RMVCS: controllers hold business logic, repositories hold all Sequelize access.
- No test runner exists in this repo. Verification is manual: `curl` for the backend, browser interaction for the frontend.
- No commit message in this plan includes a `Co-Authored-By` trailer.
- No DB migration needed anywhere in this plan — `activity_logs.type` is a plain `STRING(50)` column with no DB-level enum constraint, so adding `member_removed` is a TypeScript-only change.

---

## Task 1: Backend — `project:{id}` socket room, widened type, `logActivity` helper

**Files:**
- Modify: `backend/src/socket/index.ts`
- Modify: `backend/src/models/activityLog.model.ts`
- Create: `backend/src/utils/activity.ts`

**Interfaces:**
- Consumes: `activityLogRepository.log` (`backend/src/repositories/activityLog.repository.ts`, pre-existing), `getIO` (`backend/src/socket/index.ts`).
- Produces: `project:{projectId}` socket room (every connected user auto-joins one per project they belong to); `ActivityLogType` now includes `'member_removed'`; `logActivity(params): Promise<void>`. Consumed by Task 2 and Task 3.

- [ ] **Step 1: Join the new socket room on connect**

In `backend/src/socket/index.ts`, replace:

```ts
import { OrganizationMember, ChannelMember } from '../models/index.js';
```

with:

```ts
import { OrganizationMember, ChannelMember, ProjectMember } from '../models/index.js';
```

Then replace:

```ts
    const [orgMemberships, channelMemberships] = await Promise.all([
      OrganizationMember.findAll({ where: { userId }, attributes: ['organizationId'] }),
      ChannelMember.findAll({ where: { userId }, attributes: ['channelId'] }),
    ]);

    orgMemberships.forEach((m) => socket.join(`org:${m.organizationId}`));
    channelMemberships.forEach((m) => socket.join(`channel:${m.channelId}`));
```

with:

```ts
    const [orgMemberships, channelMemberships, projectMemberships] = await Promise.all([
      OrganizationMember.findAll({ where: { userId }, attributes: ['organizationId'] }),
      ChannelMember.findAll({ where: { userId }, attributes: ['channelId'] }),
      ProjectMember.findAll({ where: { userId }, attributes: ['projectId'] }),
    ]);

    orgMemberships.forEach((m) => socket.join(`org:${m.organizationId}`));
    channelMemberships.forEach((m) => socket.join(`channel:${m.channelId}`));
    projectMemberships.forEach((m) => socket.join(`project:${m.projectId}`));
```

- [ ] **Step 2: Widen `ActivityLogType`**

In `backend/src/models/activityLog.model.ts`, replace:

```ts
export type ActivityLogType = 'task_created' | 'task_moved' | 'task_deleted' | 'comment_added' | 'member_added';
```

with:

```ts
export type ActivityLogType = 'task_created' | 'task_moved' | 'task_deleted' | 'comment_added' | 'member_added' | 'member_removed';
```

- [ ] **Step 3: Write the `logActivity` helper**

Create `backend/src/utils/activity.ts`:

```ts
import { activityLogRepository } from '../repositories/activityLog.repository.js';
import { getIO } from '../socket/index.js';
import type { ActivityLogType } from '../models/activityLog.model.js';

interface LogActivityParams {
  projectId: string;
  actorId: string;
  type: ActivityLogType;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

// Wraps the write + the real-time push in one place instead of duplicating
// "log, then emit" at every call site. The socket payload is intentionally
// minimal (just enough to know which project changed) — listeners refetch
// through the existing read endpoints rather than trusting an inline copy.
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await activityLogRepository.log({
      projectId: params.projectId,
      actorId: params.actorId,
      type: params.type,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      metadata: params.metadata ?? null,
    });

    getIO().to(`project:${params.projectId}`).emit('activity:new', { projectId: params.projectId });
  } catch (err) {
    console.error('[logActivity] failed to log/broadcast activity:', err);
  }
}
```

- [ ] **Step 4: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/socket/index.ts src/models/activityLog.model.ts src/utils/activity.ts
git commit -m "feat(activity): add project socket room and logActivity helper"
```

---

## Task 2: Backend — wire `task.controller.ts` through `logActivity`

**Files:**
- Modify: `backend/src/controllers/task.controller.ts`

**Interfaces:**
- Consumes: `logActivity` (Task 1).
- Produces: the four existing task-related activity types now also push live over the new socket room. No new exports.

- [ ] **Step 1: Swap the import**

In `backend/src/controllers/task.controller.ts`, replace:

```ts
import { activityLogRepository } from '../repositories/activityLog.repository.js';
```

with:

```ts
import { logActivity } from '../utils/activity.js';
```

- [ ] **Step 2: Replace the four call sites**

Replace:

```ts
    activityLogRepository.log({
      projectId,
      actorId: user.id,
      type: 'task_created',
      entityType: 'task',
      entityId: task.id,
      metadata: { taskTitle: task.title, taskId: task.id },
    }).catch(() => {});
```

with:

```ts
    logActivity({
      projectId,
      actorId: user.id,
      type: 'task_created',
      entityType: 'task',
      entityId: task.id,
      metadata: { taskTitle: task.title, taskId: task.id },
    });
```

Replace:

```ts
      activityLogRepository.log({
        projectId,
        actorId: user.id,
        type: 'task_moved',
        entityType: 'task',
        entityId: taskId,
        metadata: { taskTitle: task.title, taskId, fromColumn: fromCol ?? null, toColumn: toCol ?? null },
      }).catch(() => {});
```

with:

```ts
      logActivity({
        projectId,
        actorId: user.id,
        type: 'task_moved',
        entityType: 'task',
        entityId: taskId,
        metadata: { taskTitle: task.title, taskId, fromColumn: fromCol ?? null, toColumn: toCol ?? null },
      });
```

Replace:

```ts
    activityLogRepository.log({
      projectId,
      actorId: user.id,
      type: 'task_deleted',
      entityType: 'task',
      entityId: taskId,
      metadata: { taskTitle, taskId },
    }).catch(() => {});
```

with:

```ts
    logActivity({
      projectId,
      actorId: user.id,
      type: 'task_deleted',
      entityType: 'task',
      entityId: taskId,
      metadata: { taskTitle, taskId },
    });
```

Replace:

```ts
  activityLogRepository.log({
    projectId,
    actorId: user.id,
    type: 'comment_added',
    entityType: 'task',
    entityId: taskId,
    metadata: { taskTitle: task.title, taskId, commentId: comment.id, content: content.trim() },
  }).catch(() => {});
```

with:

```ts
  logActivity({
    projectId,
    actorId: user.id,
    type: 'comment_added',
    entityType: 'task',
    entityId: taskId,
    metadata: { taskTitle: task.title, taskId, commentId: comment.id, content: content.trim() },
  });
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/controllers/task.controller.ts
git commit -m "feat(activity): route task activity logging through logActivity"
```

---

## Task 3: Backend — member events + new per-project activity endpoint

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`
- Modify: `backend/src/routes/project.routes.ts`

**Interfaces:**
- Consumes: `logActivity` (Task 1), `activityLogRepository.findByProjects` (pre-existing).
- Produces: `member_added`/`member_removed` activity entries on project membership changes; `GET /projects/:projectId/activity` → `ActivityLog[]` (same shape as `DashboardData['recentActivity']`, serialized inline — see Step 3). Consumed by Task 6 (frontend Activity tab).

- [ ] **Step 1: Log `member_added` in `addProjectMember`**

In `backend/src/controllers/project.controller.ts`, replace:

```ts
import { userRepository } from '../repositories/users.repository.js';
import { notifyUser } from '../utils/notify.js';
import { env } from '../config/env.js';
```

with:

```ts
import { userRepository } from '../repositories/users.repository.js';
import { notifyUser } from '../utils/notify.js';
import { logActivity } from '../utils/activity.js';
import { activityLogRepository } from '../repositories/activityLog.repository.js';
import { env } from '../config/env.js';
```

Then replace:

```ts
    const targetUser = await userRepository.findById(userId);
    await notifyUser({
      userId,
      organizationId: project.organizationId,
      type: 'project_member_added',
      title: `${user.name} added you to ${project.name}`,
      body: `You were added to the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
      entityType: 'project',
      entityId: project.id,
      email: targetUser
        ? {
            to: targetUser.email,
            subject: `${user.name} added you to ${project.name}`,
            bodyText: `You were added to the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
            link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}`,
          }
        : undefined,
    });

    return res.status(201).json({
      success: true,
      message: 'Member added to project successfully',
      data: member,
    });
  }
);
```

with:

```ts
    const targetUser = await userRepository.findById(userId);
    await notifyUser({
      userId,
      organizationId: project.organizationId,
      type: 'project_member_added',
      title: `${user.name} added you to ${project.name}`,
      body: `You were added to the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
      entityType: 'project',
      entityId: project.id,
      email: targetUser
        ? {
            to: targetUser.email,
            subject: `${user.name} added you to ${project.name}`,
            bodyText: `You were added to the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
            link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}`,
          }
        : undefined,
    });

    logActivity({
      projectId: project.id,
      actorId: user.id,
      type: 'member_added',
      entityType: 'user',
      entityId: userId,
      metadata: { targetName: targetUser?.name ?? 'A member' },
    });

    return res.status(201).json({
      success: true,
      message: 'Member added to project successfully',
      data: member,
    });
  }
);
```

- [ ] **Step 2: Log `member_removed` in `removeProjectMember`**

Replace:

```ts
    // Only notify when someone else removed this user — self-removal needs no self-notification.
    if (!isSelf) {
      const targetUser = await userRepository.findById(userId);
      await notifyUser({
        userId,
        organizationId: project.organizationId,
        type: 'project_member_removed',
        title: `You were removed from ${project.name}`,
        body: `${user.name} removed you from the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
        entityType: 'project',
        entityId: project.id,
        email: targetUser
          ? {
              to: targetUser.email,
              subject: `You were removed from ${project.name}`,
              bodyText: `${user.name} removed you from the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
              link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/projects`,
            }
          : undefined,
      });
    }

    return ok(res, null, 'Member removed from project successfully');
```

with:

```ts
    // Only notify when someone else removed this user — self-removal needs no self-notification.
    if (!isSelf) {
      const targetUser = await userRepository.findById(userId);
      await notifyUser({
        userId,
        organizationId: project.organizationId,
        type: 'project_member_removed',
        title: `You were removed from ${project.name}`,
        body: `${user.name} removed you from the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
        entityType: 'project',
        entityId: project.id,
        email: targetUser
          ? {
              to: targetUser.email,
              subject: `You were removed from ${project.name}`,
              bodyText: `${user.name} removed you from the ${project.name} project in ${org?.name ?? 'your workspace'}.`,
              link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/projects`,
            }
          : undefined,
      });

      logActivity({
        projectId: project.id,
        actorId: user.id,
        type: 'member_removed',
        entityType: 'user',
        entityId: userId,
        metadata: { targetName: targetUser?.name ?? 'A member' },
      });
    }

    return ok(res, null, 'Member removed from project successfully');
  }
);
```

- [ ] **Step 3: Add the `getProjectActivity` controller**

In `backend/src/controllers/project.controller.ts`, replace:

```ts
// ─── Get project detail ───────────────────────────────────────

export const getProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    const membership = await projectRepository.findMembership(projectId, user.id);
    if (!membership) throw new ApiError(403, 'You are not a member of this project');

    return ok(res, project, 'Project details retrieved successfully');
  }
);
```

with:

```ts
// ─── Get project detail ───────────────────────────────────────

export const getProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    const membership = await projectRepository.findMembership(projectId, user.id);
    if (!membership) throw new ApiError(403, 'You are not a member of this project');

    return ok(res, project, 'Project details retrieved successfully');
  }
);

// ─── Get project activity ──────────────────────────────────────

export const getProjectActivity = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    const membership = await projectRepository.findMembership(projectId, user.id);
    if (!membership) throw new ApiError(403, 'You are not a member of this project');

    const entries = await activityLogRepository.findByProjects([projectId], 20);
    const serialized = entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      createdAt: entry.createdAt,
      projectId: entry.projectId,
      projectName: (entry as unknown as { project?: { name: string } }).project?.name ?? project.name,
      metadata: entry.metadata ?? {},
      actor: {
        id: entry.actorId,
        name: (entry as unknown as { actor?: { name: string; avatarUrl: string | null } }).actor?.name ?? 'Someone',
        avatarUrl: (entry as unknown as { actor?: { name: string; avatarUrl: string | null } }).actor?.avatarUrl ?? null,
      },
    }));

    return ok(res, serialized, 'Activity retrieved successfully');
  }
);
```

Note: `ActivityLogInstance` (`backend/src/models/activityLog.model.ts`) doesn't declare `actor`/`project` as typed association properties (unlike `TaskInstance`, which declares `assignees`/`creator`) — `activityLogRepository.findByProjects` already includes those associations at the Sequelize level (confirmed in the existing `findByProjects` implementation), but TypeScript doesn't know about them without a cast, hence the inline `as unknown as { ... }` casts above rather than editing the model's public type for a single read path.

- [ ] **Step 4: Add the route**

In `backend/src/routes/project.routes.ts`, replace:

```ts
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  archiveProject,
  unarchiveProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  listProjectMembers,
  updateProjectMemberRole,
} from '../controllers/project.controller.js';
```

with:

```ts
import {
  createProject,
  listProjects,
  getProject,
  getProjectActivity,
  updateProject,
  archiveProject,
  unarchiveProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  listProjectMembers,
  updateProjectMemberRole,
} from '../controllers/project.controller.js';
```

Then replace:

```ts
router
  .route('/projects/:projectId')
  .get(verifyJWT, validate(projectParamSchema), getProject)
  .put(verifyJWT, validate(updateProjectSchema), updateProject);
```

with:

```ts
router
  .route('/projects/:projectId')
  .get(verifyJWT, validate(projectParamSchema), getProject)
  .put(verifyJWT, validate(updateProjectSchema), updateProject);

router.get(
  '/projects/:projectId/activity',
  verifyJWT,
  validate(projectParamSchema),
  getProjectActivity
);
```

- [ ] **Step 5: Verify the build type-checks**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify with curl**

Start the dev server, log in as two dev accounts in the same org and project (`USER_A` = project manager, `USER_B_ID` = target), cookies at `/tmp/cookies_a.txt`:

```bash
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/projects/PROJECT_ID/activity
```

Expected: `200` with an array (may already have `task_created` etc. entries from earlier testing).

```bash
curl -b /tmp/cookies_a.txt -s -X POST http://localhost:8080/api/v1/projects/PROJECT_ID/members \
  -H "Content-Type: application/json" -d '{"userId":"USER_B_ID"}' -o /dev/null -w "%{http_code}\n"
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/projects/PROJECT_ID/activity | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data'][0])"
```

Expected: the newest entry has `"type":"member_added"`, `"metadata":{"targetName":"<USER_B's name>"}`, `"actor":{"name":"<USER_A's name>", ...}`.

```bash
curl -b /tmp/cookies_a.txt -s -X DELETE http://localhost:8080/api/v1/projects/PROJECT_ID/members/USER_B_ID -o /dev/null -w "%{http_code}\n"
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/projects/PROJECT_ID/activity | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data'][0])"
```

Expected: the newest entry now has `"type":"member_removed"`.

- [ ] **Step 7: Commit**

```bash
cd backend
git add src/controllers/project.controller.ts src/routes/project.routes.ts
git commit -m "feat(activity): log project membership changes and add per-project activity endpoint"
```

---

## Task 4: Frontend — shared `ActivityEntry` type + extracted `ActivityRow`

**Files:**
- Modify: `frontend/src/types/project.types.ts`
- Create: `frontend/src/components/shared/ActivityRow.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ActivityEntry` type (exported from `project.types.ts`); `ActivityRow` component. Consumed by Task 5 (`OrgOverviewPage.tsx`) and Task 6 (new Activity tab).

- [ ] **Step 1: Extract and widen the type**

In `frontend/src/types/project.types.ts`, replace:

```ts
  recentActivity: {
    id: string;
    type: 'task_created' | 'task_moved' | 'task_deleted' | 'comment_added' | 'member_added';
    createdAt: string;
    projectId: string;
    projectName: string;
    metadata: {
      taskTitle?: string;
      taskId?: string;
      fromColumn?: string | null;
      toColumn?: string | null;
      content?: string;
      commentId?: string;
    };
    actor: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  }[];
```

with:

```ts
  recentActivity: ActivityEntry[];
```

Then find the top of the file (before the `DashboardData` interface) and add the extracted, widened type as its own export. Replace:

```ts
export interface DashboardData {
```

with:

```ts
export interface ActivityEntry {
  id: string;
  type: 'task_created' | 'task_moved' | 'task_deleted' | 'comment_added' | 'member_added' | 'member_removed';
  createdAt: string;
  projectId: string;
  projectName: string;
  metadata: {
    taskTitle?: string;
    taskId?: string;
    fromColumn?: string | null;
    toColumn?: string | null;
    content?: string;
    commentId?: string;
    targetName?: string;
  };
  actor: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface DashboardData {
```

- [ ] **Step 2: Write the extracted `ActivityRow`**

Create `frontend/src/components/shared/ActivityRow.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRightLeft, MessageSquare, Plus, UserMinus, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityEntry } from '@/types/project.types';

const AVATAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ name, url, size = 7 }: { name: string; url?: string | null; size?: number }) {
  const px = size * 4;
  const style = { width: px, height: px, fontSize: px * 0.38, flexShrink: 0 };
  if (url) return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={style} />;
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold uppercase shrink-0"
      style={{ ...style, backgroundColor: avatarColor(name) }}>
      {name.charAt(0)}
    </div>
  );
}

const ACTIVITY_ICON: Record<string, { node: React.ReactNode; bg: string }> = {
  task_created: { node: <Plus size={10} />, bg: 'bg-emerald-100 text-emerald-600' },
  task_moved: { node: <ArrowRightLeft size={10} />, bg: 'bg-blue-100 text-blue-600' },
  task_deleted: { node: <AlertTriangle size={10} />, bg: 'bg-red-100 text-red-600' },
  comment_added: { node: <MessageSquare size={10} />, bg: 'bg-gray-100 text-gray-500' },
  member_added: { node: <UserPlus size={10} />, bg: 'bg-purple-100 text-purple-600' },
  member_removed: { node: <UserMinus size={10} />, bg: 'bg-orange-100 text-orange-600' },
};

function buildActivityText(item: ActivityEntry): React.ReactNode {
  const { metadata } = item;
  const task = metadata.taskTitle ? (
    <span className="font-medium text-gray-800">{metadata.taskTitle}</span>
  ) : null;

  switch (item.type) {
    case 'task_created': return <>created {task}</>;
    case 'task_moved':
      return (
        <>
          moved {task}
          {metadata.fromColumn && metadata.toColumn && (
            <span className="text-gray-400"> · {metadata.fromColumn} → {metadata.toColumn}</span>
          )}
        </>
      );
    case 'comment_added':
      return (
        <>
          commented on {task}
          {metadata.content && (
            <span className="text-gray-400 italic"> "{metadata.content}"</span>
          )}
        </>
      );
    case 'task_deleted':
      return (
        <>deleted <span className="line-through text-gray-400">{metadata.taskTitle}</span></>
      );
    case 'member_added':
      return <>added <span className="font-medium text-gray-800">{metadata.targetName ?? 'a member'}</span> to the project</>;
    case 'member_removed':
      return <>removed <span className="font-medium text-gray-800">{metadata.targetName ?? 'a member'}</span> from the project</>;
    default: return null;
  }
}

interface ActivityRowProps {
  item: ActivityEntry;
  slug: string;
  showProjectLink?: boolean;
}

export function ActivityRow({ item, slug, showProjectLink = true }: ActivityRowProps) {
  const router = useRouter();
  const icon = ACTIVITY_ICON[item.type] ?? ACTIVITY_ICON.task_created;
  const taskId = item.type !== 'task_deleted' ? item.metadata.taskId : undefined;

  return (
    <li
      className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => taskId && router.push(`/org/${slug}/projects/${item.projectId}?taskId=${taskId}`)}
    >
      <Avatar name={item.actor.name} url={item.actor.avatarUrl} size={7} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-600 leading-snug">
          <span className="font-semibold text-gray-900">{item.actor.name}</span>
          {' '}
          {buildActivityText(item)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[0.65rem] font-medium', icon.bg)}>
            {icon.node}
          </span>
          {showProjectLink && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/org/${slug}/projects/${item.projectId}`); }}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                {item.projectName}
              </button>
              <span className="text-gray-200 text-xs">·</span>
            </>
          )}
          <span className="text-xs text-gray-400">{formatRelativeTime(item.createdAt)}</span>
        </div>
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/types/project.types.ts src/components/shared/ActivityRow.tsx
git commit -m "feat(activity): extract shared ActivityRow with member_removed support"
```

---

## Task 5: Frontend — `OrgOverviewPage.tsx` uses the extracted component + goes live

**Files:**
- Modify: `frontend/src/app/(dashboard)/org/[slug]/_components/OrgOverviewPage.tsx`

**Interfaces:**
- Consumes: `ActivityRow` (Task 4), `getSocket` (`frontend/src/lib/socket.ts`).
- Produces: nothing new — this task removes duplicated code and adds real-time. Terminal for the org-dashboard surface.

- [ ] **Step 1: Remove the now-duplicated local helpers and imports**

In `frontend/src/app/(dashboard)/org/[slug]/_components/OrgOverviewPage.tsx`, replace:

```ts
import {
  AlertTriangle, ArrowRight, CheckSquare,
  Clock, FolderOpen, MessageSquare, Plus, ArrowRightLeft, UserPlus,
} from 'lucide-react';
import { ErrorState } from '@/components/shared/ErrorState';
import type { DashboardData } from '@/types/project.types';
```

with:

```ts
import {
  AlertTriangle, ArrowRight, CheckSquare,
  Clock, FolderOpen, MessageSquare,
} from 'lucide-react';
import { ErrorState } from '@/components/shared/ErrorState';
import { ActivityRow } from '@/components/shared/ActivityRow';
import { getSocket } from '@/lib/socket';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DashboardData } from '@/types/project.types';
```

`avatarColor`/`AVATAR_COLORS`/the `Avatar` component stay in this file untouched — they're also used by the "My Projects" and "Team" sections below, not just the activity feed. Only the activity-specific helpers get removed, since those move to `ActivityRow.tsx`.

- [ ] **Step 2: Remove the now-duplicated activity-only helpers**

Replace:

```ts
function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDueDateLabel(dueDate: string | null): { label: string; cls: string } | null {
```

- [ ] **Step 3: Remove the old `ACTIVITY_ICON`, `buildActivityText`, and local `ActivityRow`**

Replace:

```ts
// ─── Activity row ─────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, { node: React.ReactNode; bg: string }> = {
  task_created: { node: <Plus size={10} />, bg: 'bg-emerald-100 text-emerald-600' },
  task_moved: { node: <ArrowRightLeft size={10} />, bg: 'bg-blue-100 text-blue-600' },
  task_deleted: { node: <AlertTriangle size={10} />, bg: 'bg-red-100 text-red-600' },
  comment_added: { node: <MessageSquare size={10} />, bg: 'bg-gray-100 text-gray-500' },
  member_added: { node: <UserPlus size={10} />, bg: 'bg-purple-100 text-purple-600' },
};

function buildActivityText(item: DashboardData['recentActivity'][number]): React.ReactNode {
  const { metadata } = item;
  const task = metadata.taskTitle ? (
    <span className="font-medium text-gray-800">{metadata.taskTitle}</span>
  ) : null;

  switch (item.type) {
    case 'task_created': return <>created {task}</>;
    case 'task_moved':
      return (
        <>
          moved {task}
          {metadata.fromColumn && metadata.toColumn && (
            <span className="text-gray-400"> · {metadata.fromColumn} → {metadata.toColumn}</span>
          )}
        </>
      );
    case 'comment_added':
      return (
        <>
          commented on {task}
          {metadata.content && (
            <span className="text-gray-400 italic"> "{metadata.content}"</span>
          )}
        </>
      );
    case 'task_deleted':
      return (
        <>deleted <span className="line-through text-gray-400">{metadata.taskTitle}</span></>
      );
    case 'member_added': return <>joined the project</>;
    default: return null;
  }
}

function ActivityRow({
  item, slug, router,
}: {
  item: DashboardData['recentActivity'][number];
  slug: string;
  router: ReturnType<typeof useRouter>;
}) {
  const icon = ACTIVITY_ICON[item.type] ?? ACTIVITY_ICON.task_created;
  const taskId = item.type !== 'task_deleted' ? item.metadata.taskId : undefined;

  return (
    <li
      className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => taskId && router.push(`/org/${slug}/projects/${item.projectId}?taskId=${taskId}`)}
    >
      <Avatar name={item.actor.name} url={item.actor.avatarUrl} size={7} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-600 leading-snug">
          <span className="font-semibold text-gray-900">{item.actor.name}</span>
          {' '}
          {buildActivityText(item)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[0.65rem] font-medium', icon.bg)}>
            {icon.node}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/org/${slug}/projects/${item.projectId}`); }}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            {item.projectName}
          </button>
          <span className="text-gray-200 text-xs">·</span>
          <span className="text-xs text-gray-400">{formatRelativeTime(item.createdAt)}</span>
        </div>
      </div>
    </li>
  );
}
```

with nothing — delete the whole block (the `// ─── Skeleton ───` comment that originally followed it, a few lines further down, stays untouched).

- [ ] **Step 4: Update the JSX call site**

Replace:

```tsx
            <ul className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
              {dashboard.recentActivity.map((item) => (
                <ActivityRow key={item.id} item={item} slug={slug} router={router} />
              ))}
            </ul>
```

with:

```tsx
            <ul className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
              {dashboard.recentActivity.map((item) => (
                <ActivityRow key={item.id} item={item} slug={slug} />
              ))}
            </ul>
```

- [ ] **Step 5: Add the real-time listener**

Replace:

```ts
  const { data: org } = useOrganizationBySlug(slug);
  const { data: dashboard, isLoading, error, refetch } = useOrgDashboard(org?.id ?? '');

  if (isLoading || !org) return <DashboardSkeleton />;
  if (error || !dashboard) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message="Something went wrong loading your dashboard."
        onRetry={() => refetch()}
      />
    );
  }
```

with:

```ts
  const { data: org } = useOrganizationBySlug(slug);
  const { data: dashboard, isLoading, error, refetch } = useOrgDashboard(org?.id ?? '');
  const qc = useQueryClient();

  useEffect(() => {
    if (!org || !dashboard) return;
    const myProjectIds = new Set(dashboard.myProjects.map((p) => p.id));
    const socket = getSocket();

    const onActivityNew = ({ projectId }: { projectId: string }) => {
      if (myProjectIds.has(projectId)) {
        qc.invalidateQueries({ queryKey: ['organizations', org.id, 'dashboard'] });
      }
    };

    socket.on('activity:new', onActivityNew);
    return () => {
      socket.off('activity:new', onActivityNew);
    };
  }, [org, dashboard, qc]);

  if (isLoading || !org) return <DashboardSkeleton />;
  if (error || !dashboard) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message="Something went wrong loading your dashboard."
        onRetry={() => refetch()}
      />
    );
  }
```

Note: `dashboard.myProjects` (already returned by `getDashboardData`, see `backend/src/repositories/organization.repository.ts`) is what makes the access check here match the backend's — the socket only ever delivers events for projects the user joined a room for in the first place, so this client-side check is a UI nicety (avoiding a wasted refetch for events about projects that happen to share the same org but aren't in `myProjects`... which in practice never happens, since the server never sends those events to this socket at all). It's cheap insurance, not the actual security boundary.

- [ ] **Step 6: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add "src/app/(dashboard)/org/[slug]/_components/OrgOverviewPage.tsx"
git commit -m "feat(activity): use shared ActivityRow on the org dashboard and go live"
```

---

## Task 6: Frontend — per-project Activity tab + end-to-end verification

**Files:**
- Modify: `frontend/src/services/project.service.ts`
- Modify: `frontend/src/hooks/useProject.ts`
- Modify: `frontend/src/app/(dashboard)/org/[slug]/projects/[projectId]/_components/KanbanPage.tsx`

**Interfaces:**
- Consumes: `ActivityRow` (Task 4), `GET /projects/:projectId/activity` (Task 3), `getSocket` (`frontend/src/lib/socket.ts`).
- Produces: `getProjectActivity(projectId)` service function; `useProjectActivity(projectId)` hook; new "Activity" tab on the Kanban page. Terminal task for this plan.

- [ ] **Step 1: Add the service function**

In `frontend/src/services/project.service.ts`, replace:

```ts
import type {
  Project,
  ProjectsResponse,
  ProjectResponse,
  ProjectMembersResponse,
  KanbanColumnsResponse,
  TasksResponse,
  TaskResponse,
  Task,
  KanbanColumn,
  TaskComment,
  Subtask,
  TaskAttachment,
  DashboardData,
} from '@/types/project.types';
```

with:

```ts
import type {
  Project,
  ProjectsResponse,
  ProjectResponse,
  ProjectMembersResponse,
  KanbanColumnsResponse,
  TasksResponse,
  TaskResponse,
  Task,
  KanbanColumn,
  TaskComment,
  Subtask,
  TaskAttachment,
  DashboardData,
  ActivityEntry,
} from '@/types/project.types';
```

Then replace:

```ts
export async function getProject(projectId: string): Promise<Project> {
  const res = await api.get<ProjectResponse>(`/projects/${projectId}`);
  return res.data.data;
}
```

with:

```ts
export async function getProject(projectId: string): Promise<Project> {
  const res = await api.get<ProjectResponse>(`/projects/${projectId}`);
  return res.data.data;
}

export async function getProjectActivity(projectId: string): Promise<ActivityEntry[]> {
  const res = await api.get<{ success: boolean; message: string; data: ActivityEntry[] }>(
    `/projects/${projectId}/activity`
  );
  return res.data.data;
}
```

- [ ] **Step 2: Add the hook**

In `frontend/src/hooks/useProject.ts`, replace:

```ts
import {
  getOrgDashboard,
  getOrgProjects,
  getProject,
  createProject,
```

with:

```ts
import {
  getOrgDashboard,
  getOrgProjects,
  getProject,
  getProjectActivity,
  createProject,
```

Then find the `useOrgDashboard` hook and replace:

```ts
export const useOrgDashboard = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'dashboard'],
    queryFn: () => getOrgDashboard(organizationId),
    enabled: !!organizationId,
  });
```

with:

```ts
export const useOrgDashboard = (organizationId: string) =>
  useQuery({
    queryKey: ['organizations', organizationId, 'dashboard'],
    queryFn: () => getOrgDashboard(organizationId),
    enabled: !!organizationId,
  });

export const useProjectActivity = (projectId: string) =>
  useQuery({
    queryKey: ['projects', projectId, 'activity'],
    queryFn: () => getProjectActivity(projectId),
    enabled: !!projectId,
  });
```

- [ ] **Step 3: Add the "Activity" tab**

In `frontend/src/app/(dashboard)/org/[slug]/projects/[projectId]/_components/KanbanPage.tsx`, replace:

```ts
import {
  useProject,
  useProjectColumns,
  useProjectTasks,
  useCreateColumn,
  useDeleteColumn,
  useReorderColumns,
  useMoveTask,
  useProjectMembers,
  useProjectFiles,
  useArchiveProject,
  useUnarchiveProject,
  useDeleteProject,
} from '@/hooks/useProject';
```

with:

```ts
import {
  useProject,
  useProjectColumns,
  useProjectTasks,
  useCreateColumn,
  useDeleteColumn,
  useReorderColumns,
  useMoveTask,
  useProjectMembers,
  useProjectFiles,
  useProjectActivity,
  useArchiveProject,
  useUnarchiveProject,
  useDeleteProject,
} from '@/hooks/useProject';
import { ActivityRow } from '@/components/shared/ActivityRow';
import { getSocket } from '@/lib/socket';
```

Then replace:

```ts
  const tabs = [
    { name: 'Board', icon: Layout },
    { name: 'List', icon: List },
    { name: 'Calendar', icon: CalendarDays },
    { name: 'Files', icon: Paperclip },
    { name: 'Settings', icon: Settings },
  ];
```

with:

```ts
  const tabs = [
    { name: 'Board', icon: Layout },
    { name: 'List', icon: List },
    { name: 'Calendar', icon: CalendarDays },
    { name: 'Files', icon: Paperclip },
    { name: 'Activity', icon: History },
    { name: 'Settings', icon: Settings },
  ];
```

Add the `History` icon to the existing lucide-react import at the top of the file — replace:

```ts
import { Archive, ArchiveRestore, CalendarDays, ChevronDown, Download, ExternalLink, Eye, File, FileText, Image as ImageIcon, Layout, List, Loader2, Paperclip, Plus, Settings, Trash2, Users, X } from 'lucide-react';
```

with:

```ts
import { Archive, ArchiveRestore, CalendarDays, ChevronDown, Download, ExternalLink, Eye, File, FileText, History, Image as ImageIcon, Layout, List, Loader2, Paperclip, Plus, Settings, Trash2, Users, X } from 'lucide-react';
```

Then replace:

```tsx
      ) : activeTab === 'Files' ? (
        <ProjectFilesView projectId={projectId} currentUserId={currentUser?.id ?? ''} isAdmin={isAdmin} />
      ) : (
        <ProjectSettingsView project={project} slug={slug} isAdmin={isAdmin} isOrgAdmin={isOrgAdmin} />
      )}
```

with:

```tsx
      ) : activeTab === 'Files' ? (
        <ProjectFilesView projectId={projectId} currentUserId={currentUser?.id ?? ''} isAdmin={isAdmin} />
      ) : activeTab === 'Activity' ? (
        <ProjectActivityView projectId={projectId} slug={slug} />
      ) : (
        <ProjectSettingsView project={project} slug={slug} isAdmin={isAdmin} isOrgAdmin={isOrgAdmin} />
      )}
```

- [ ] **Step 4: Write `ProjectActivityView`**

In the same file, add a new function alongside the existing `ProjectFilesView`/`ProjectSettingsView` functions (find `function ProjectFilesView({` and insert this new function directly before it):

```tsx
function ProjectActivityView({ projectId, slug }: { projectId: string; slug: string }) {
  const { data: activity = [], isLoading } = useProjectActivity(projectId);
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const onActivityNew = ({ projectId: eventProjectId }: { projectId: string }) => {
      if (eventProjectId === projectId) {
        qc.invalidateQueries({ queryKey: ['projects', projectId, 'activity'] });
      }
    };
    socket.on('activity:new', onActivityNew);
    return () => {
      socket.off('activity:new', onActivityNew);
    };
  }, [projectId, qc]);

  if (isLoading) {
    return <div className="flex-1 p-8 text-sm text-gray-400">Loading activity...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Recent Activity</h2>
      {activity.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
          {activity.map((item) => (
            <ActivityRow key={item.id} item={item} slug={slug} showProjectLink={false} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

`useQueryClient` isn't imported in this file yet (the existing mutation hooks each manage their own query client internally via `useProject.ts`), so add it. Replace:

```ts
import { use, useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
```

with:

```ts
import { use, useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
```

- [ ] **Step 5: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify with curl (backend re-check) and in the browser**

```bash
curl -b /tmp/cookies_a.txt -s http://localhost:8080/api/v1/projects/PROJECT_ID/activity | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['data']), 'entries')"
```

Expected: a nonzero count, matching whatever task/member activity exists on that project from earlier testing.

Then in the browser, with two logged-in sessions on the same project:

1. Open the project's new "Activity" tab as `USER_B`, while `USER_A` creates a task, moves it, comments on it, and adds/removes a member.
2. Confirm each action appears in `USER_B`'s Activity tab live, without a refresh, in the correct human-readable form (including the corrected "added {name} to the project" / "removed {name} from the project" text for membership changes).
3. Navigate to the org dashboard (`/org/<slug>`) as `USER_B` and confirm the existing "Recent Activity" panel also updates live for the same events.
4. Click a task-related activity row and confirm it navigates to that task's detail panel (`?taskId=`), matching the pre-existing click-through behavior.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/services/project.service.ts src/hooks/useProject.ts \
  "src/app/(dashboard)/org/[slug]/projects/[projectId]/_components/KanbanPage.tsx"
git commit -m "feat(activity): add per-project Activity tab with real-time updates"
```