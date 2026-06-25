import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { projectRepository } from '../repositories/project.repository.js';
import { kanbanColumnRepository } from '../repositories/kanbanColumn.repository.js';
import { organizationMemberRepository } from '../repositories/organization.repository.js';

// Create a new project
export const createProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const { name, description } = req.body as { name: string; description?: string | null };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Verify user belongs to organization
    const orgMembership = await organizationMemberRepository.findOne({
      organizationId,
      userId: user.id,
    });

    if (!orgMembership) {
      throw new ApiError(403, 'You must be a member of this organization to create a project');
    }

    // Create the project
    const project = await projectRepository.create({
      organizationId,
      name: name.trim(),
      description: description ? description.trim() : null,
      status: 'ACTIVE',
      createdById: user.id,
    });

    // Auto-add creator as project member
    await projectRepository.addMember(project.id, user.id);

    // Auto-create default columns
    await kanbanColumnRepository.createDefault(project.id);

    return res.status(201).json({
      success: true,
      message: 'Project created successfully with default Kanban columns',
      data: project,
    });
  }
);

// List projects in organization
export const listProjects = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.params as { organizationId: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Verify user belongs to organization
    const orgMembership = await organizationMemberRepository.findOne({
      organizationId,
      userId: user.id,
    });

    if (!orgMembership) {
      throw new ApiError(403, 'Unauthorized access to organization projects');
    }

    const projects = await projectRepository.findByOrg(organizationId);
    return ok(res, projects, 'Projects retrieved successfully');
  }
);

// Get project detail
export const getProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Verify project membership
    const membership = await projectRepository.findMembership(projectId, user.id);
    if (!membership) {
      throw new ApiError(403, 'You are not a member of this project');
    }

    return ok(res, project, 'Project details retrieved successfully');
  }
);

// Update project
export const updateProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const { name, description, status } = req.body as { name?: string; description?: string | null; status?: 'ACTIVE' | 'ARCHIVED' };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Verify org admin or project creator
    const orgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId: user.id,
    });

    const isOrgAdmin = orgMembership?.role === 'ORG_ADMIN';
    const isCreator = project.createdById === user.id;

    if (!isOrgAdmin && !isCreator) {
      throw new ApiError(403, 'Only organization admins or project creators can update the project');
    }

    const updated = await projectRepository.update(projectId, {
      name: name !== undefined ? name.trim() : project.name,
      description: description !== undefined ? description : project.description,
      status: status !== undefined ? status : project.status,
    });

    return ok(res, updated, 'Project updated successfully');
  }
);

// Archive project
export const archiveProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Verify org admin or project creator
    const orgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId: user.id,
    });

    const isOrgAdmin = orgMembership?.role === 'ORG_ADMIN';
    const isCreator = project.createdById === user.id;

    if (!isOrgAdmin && !isCreator) {
      throw new ApiError(403, 'Only organization admins or project creators can archive the project');
    }

    const archived = await projectRepository.archive(projectId);
    return ok(res, archived, 'Project archived successfully');
  }
);

// Add Project Member
export const addProjectMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const { userId } = req.body as { userId: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Verify authority to add members (org admin or project creator)
    const orgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId: user.id,
    });

    const isOrgAdmin = orgMembership?.role === 'ORG_ADMIN';
    const isCreator = project.createdById === user.id;

    if (!isOrgAdmin && !isCreator) {
      throw new ApiError(403, 'Only organization admins or project creators can add members');
    }

    // Check if target user belongs to organization
    const targetOrgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId,
    });

    if (!targetOrgMembership) {
      throw new ApiError(400, 'User must belong to the organization before joining a project');
    }

    // Check if user is already a member
    const existing = await projectRepository.findMembership(projectId, userId);
    if (existing) {
      throw new ApiError(400, 'User is already a member of this project');
    }

    const member = await projectRepository.addMember(projectId, userId);
    return res.status(201).json({
      success: true,
      message: 'Member added to project successfully',
      data: member,
    });
  }
);

// Remove Project Member
export const removeProjectMember = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, userId } = req.params as { projectId: string; userId: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Creator cannot be removed
    if (project.createdById === userId) {
      throw new ApiError(400, 'Cannot remove the project creator/owner');
    }

    // Verify authority (org admin, project creator, or self-remove)
    const orgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId: user.id,
    });

    const isOrgAdmin = orgMembership?.role === 'ORG_ADMIN';
    const isCreator = project.createdById === user.id;
    const isSelf = user.id === userId;

    if (!isOrgAdmin && !isCreator && !isSelf) {
      throw new ApiError(403, 'You do not have permission to remove this member');
    }

    const removedCount = await projectRepository.removeMember(projectId, userId);
    if (removedCount === 0) {
      throw new ApiError(404, 'Member not found in this project');
    }

    return ok(res, null, 'Member removed from project successfully');
  }
);

// List Project Members
export const listProjectMembers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Verify requester is a member of the project
    const membership = await projectRepository.findMembership(projectId, user.id);
    if (!membership) {
      throw new ApiError(403, 'You are not a member of this project');
    }

    const members = await projectRepository.findMembers(projectId);
    return ok(res, members, 'Project members retrieved successfully');
  }
);
