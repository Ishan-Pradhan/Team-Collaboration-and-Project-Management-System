import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { projectRepository } from '../repositories/project.repository.js';
import { kanbanColumnRepository } from '../repositories/kanbanColumn.repository.js';
import {
  organizationMemberRepository,
  organizationRepository,
} from '../repositories/organization.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { notifyUser } from '../utils/notify.js';
import { logActivity } from '../utils/activity.js';
import { activityLogRepository } from '../repositories/activityLog.repository.js';
import { env } from '../config/env.js';

// ─── Helpers ──────────────────────────────────────────────────

async function getOrgContext(organizationId: string, userId: string) {
  const org = await organizationRepository.findById(organizationId);
  const orgMembership = await organizationMemberRepository.findOne({ organizationId, userId });
  const isOrgPrivileged = org?.ownerId === userId || orgMembership?.role === 'ORG_ADMIN';
  return { org, orgMembership, isOrgPrivileged };
}

// ─── Create a new project ─────────────────────────────────────

export const createProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const { name, description } = req.body as { name: string; description?: string | null };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const { orgMembership, isOrgPrivileged } = await getOrgContext(organizationId, user.id);

    if (!orgMembership) {
      throw new ApiError(403, 'You must be a member of this organization to create a project');
    }

    if (!isOrgPrivileged) {
      throw new ApiError(403, 'Only organization owners and admins can create projects');
    }

    const project = await projectRepository.create({
      organizationId,
      name: name.trim(),
      description: description ? description.trim() : null,
      status: 'ACTIVE',
      createdById: user.id,
    });

    // Creator is automatically the Project Manager
    await projectRepository.addMember(project.id, user.id, 'PROJECT_MANAGER');
    await kanbanColumnRepository.createDefault(project.id);

    return res.status(201).json({
      success: true,
      message: 'Project created successfully with default Kanban columns',
      data: project,
    });
  }
);

// ─── List projects in organization ────────────────────────────

export const listProjects = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const { org, orgMembership } = await getOrgContext(organizationId, user.id);

    if (!orgMembership && org?.ownerId !== user.id) {
      throw new ApiError(403, 'Unauthorized access to organization projects');
    }

    const projects = await projectRepository.findByOrgForUser(organizationId, user.id);
    const projectIds = projects.map((p) => p.id);
    const [memberCounts, taskCounts, completedTaskCounts] = await Promise.all([
      projectRepository.findMemberCountsByProjectIds(projectIds),
      projectRepository.findTaskCountsByProjectIds(projectIds),
      projectRepository.findCompletedTaskCountsByProjectIds(projectIds),
    ]);

    return ok(
      res,
      projects.map((p) => ({
        ...p.toJSON(),
        myRole: p.myRole,
        memberCount: memberCounts.get(p.id) ?? 0,
        taskCount: taskCounts.get(p.id) ?? 0,
        completedTaskCount: completedTaskCounts.get(p.id) ?? 0,
      })),
      'Projects retrieved successfully'
    );
  }
);

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

// ─── Update project ───────────────────────────────────────────

export const updateProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const { name, description, status } = req.body as { name?: string; description?: string | null; status?: 'ACTIVE' | 'ARCHIVED' };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    const { isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);

    if (!isOrgPrivileged && !isProjectManager) {
      throw new ApiError(403, 'Only organization admins or project managers can update the project');
    }

    const updated = await projectRepository.update(projectId, {
      name: name !== undefined ? name.trim() : project.name,
      description: description !== undefined ? description : project.description,
      status: status !== undefined ? status : project.status,
    });

    return ok(res, updated, 'Project updated successfully');
  }
);

// ─── Archive project ──────────────────────────────────────────

export const archiveProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    const { isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);

    if (!isOrgPrivileged && !isProjectManager) {
      throw new ApiError(403, 'Only organization admins or project managers can archive the project');
    }

    const archived = await projectRepository.archive(projectId);
    return ok(res, archived, 'Project archived successfully');
  }
);

// ─── Unarchive project ────────────────────────────────────────

export const unarchiveProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');
    if (project.status !== 'ARCHIVED') throw new ApiError(400, 'Project is not archived');

    const { isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);

    if (!isOrgPrivileged && !isProjectManager) {
      throw new ApiError(403, 'Only organization admins or project managers can unarchive the project');
    }

    const restored = await projectRepository.unarchive(projectId);
    return ok(res, restored, 'Project restored successfully');
  }
);

// ─── Delete project ───────────────────────────────────────────

export const deleteProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    // Deletion is restricted to org owners/admins — it's irreversible
    const { isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    if (!isOrgPrivileged) {
      throw new ApiError(403, 'Only organization owners and admins can delete a project');
    }

    await projectRepository.delete(projectId);
    return ok(res, null, 'Project deleted permanently');
  }
);

// ─── Add Project Member ───────────────────────────────────────

export const addProjectMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const { userId } = req.body as { userId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    const { org, isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);

    if (!isOrgPrivileged && !isProjectManager) {
      throw new ApiError(403, 'Only organization admins or project managers can add members');
    }

    const targetOrgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId,
    });

    if (!targetOrgMembership) {
      throw new ApiError(400, 'User must belong to the organization before joining a project');
    }

    const existing = await projectRepository.findMembership(projectId, userId);
    if (existing) throw new ApiError(400, 'User is already a member of this project');

    const member = await projectRepository.addMember(projectId, userId, 'MEMBER');

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

// ─── Remove Project Member ────────────────────────────────────

export const removeProjectMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, userId } = req.params as { projectId: string; userId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    // The project manager (creator role) cannot be removed
    const targetMembership = await projectRepository.findMembership(projectId, userId);
    if (targetMembership?.role === 'PROJECT_MANAGER') {
      const otherPMs = await projectRepository.findMembers(projectId)
        .then((members) => members.filter((m) => m.role === 'PROJECT_MANAGER' && m.userId !== userId));
      if (otherPMs.length === 0) {
        throw new ApiError(400, 'Cannot remove the last Project Manager from a project');
      }
    }

    const { org, isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    const isProjectManager = await projectRepository.isProjectManager(projectId, user.id);
    const isSelf = user.id === userId;

    if (!isOrgPrivileged && !isProjectManager && !isSelf) {
      throw new ApiError(403, 'You do not have permission to remove this member');
    }

    const removedCount = await projectRepository.removeMember(projectId, userId);
    if (removedCount === 0) throw new ApiError(404, 'Member not found in this project');

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

// ─── List Project Members ─────────────────────────────────────

export const listProjectMembers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    const membership = await projectRepository.findMembership(projectId, user.id);
    if (!membership) throw new ApiError(403, 'You are not a member of this project');

    const members = await projectRepository.findMembers(projectId);
    return ok(res, members, 'Project members retrieved successfully');
  }
);

// ─── Update Project Member Role ───────────────────────────────

export const updateProjectMemberRole = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, userId } = req.params as { projectId: string; userId: string };
    const { role } = req.body as { role: 'PROJECT_MANAGER' | 'MEMBER' };
    const user = req.user;

    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await projectRepository.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    // Only org owner or admin can assign/revoke PM role
    const { isOrgPrivileged } = await getOrgContext(project.organizationId, user.id);
    if (!isOrgPrivileged) {
      throw new ApiError(403, 'Only organization owners and admins can assign the Project Manager role');
    }

    const membership = await projectRepository.findMembership(projectId, userId);
    if (!membership) throw new ApiError(404, 'User is not a member of this project');

    // Prevent removing the last PM
    if (role === 'MEMBER' && membership.role === 'PROJECT_MANAGER') {
      const members = await projectRepository.findMembers(projectId);
      const pmCount = members.filter((m) => m.role === 'PROJECT_MANAGER').length;
      if (pmCount <= 1) {
        throw new ApiError(400, 'Cannot remove the last Project Manager from a project');
      }
    }

    const updated = await projectRepository.updateMemberRole(projectId, userId, role);
    if (updated === 0) throw new ApiError(404, 'Member not found');

    return ok(res, null, `Member role updated to ${role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Member'} successfully`);
  }
);
