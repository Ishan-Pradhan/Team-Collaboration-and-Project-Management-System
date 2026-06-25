import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { taskRepository } from '../repositories/task.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { kanbanColumnRepository } from '../repositories/kanbanColumn.repository.js';

// Helper — verify user is a project member
const requireProjectMembership = async (projectId: string, userId: string) => {
  const project = await projectRepository.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const membership = await projectRepository.findMembership(projectId, userId);
  if (!membership) throw new ApiError(403, 'You are not a member of this project');

  return project;
};

// ─────────────────────────────────────────────────────────────
// TASK HANDLERS
// ─────────────────────────────────────────────────────────────

// GET /projects/:projectId/tasks  — all tasks in a project
export const listProjectTasks = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const tasks = await taskRepository.findByProject(projectId);
    return ok(res, tasks, 'Tasks retrieved successfully');
  }
);

// POST /projects/:projectId/tasks  — create task
export const createTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const { title, description, columnId, priority, assigneeId, dueDate } = req.body as {
      title: string;
      description?: string | null;
      columnId: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeId?: string | null;
      dueDate?: string | null;
    };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    // Verify column belongs to project
    const columns = await kanbanColumnRepository.findByProject(projectId);
    const colExists = columns.some((c) => c.id === columnId);
    if (!colExists) throw new ApiError(400, 'Column does not belong to this project');

    // Position = count of existing tasks in that column
    const position = await taskRepository.countByColumn(columnId);

    const task = await taskRepository.create({
      projectId,
      columnId,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority ?? 'MEDIUM',
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      createdById: user.id,
      position,
    });

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task,
    });
  }
);

// GET /projects/:projectId/tasks/:taskId  — get task detail
export const getTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, taskId } = req.params as { projectId: string; taskId: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId)
      throw new ApiError(404, 'Task not found');

    return ok(res, task, 'Task retrieved successfully');
  }
);

// PUT /projects/:projectId/tasks/:taskId  — update task
export const updateTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, taskId } = req.params as { projectId: string; taskId: string };
    const { title, description, priority, assigneeId, dueDate } = req.body as {
      title?: string;
      description?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeId?: string | null;
      dueDate?: string | null;
    };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId)
      throw new ApiError(404, 'Task not found');

    const updated = await taskRepository.update(taskId, {
      title: title !== undefined ? title.trim() : task.title,
      description: description !== undefined ? description : task.description,
      priority: priority !== undefined ? priority : task.priority,
      assigneeId: assigneeId !== undefined ? assigneeId : task.assigneeId,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
    });

    return ok(res, updated, 'Task updated successfully');
  }
);

// PATCH /projects/:projectId/tasks/:taskId/move  — move task to column
export const moveTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, taskId } = req.params as { projectId: string; taskId: string };
    const { columnId, position } = req.body as { columnId: string; position: number };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId)
      throw new ApiError(404, 'Task not found');

    // Verify column belongs to project
    const columns = await kanbanColumnRepository.findByProject(projectId);
    const colExists = columns.some((c) => c.id === columnId);
    if (!colExists) throw new ApiError(400, 'Column does not belong to this project');

    const updated = await taskRepository.move(taskId, columnId, position ?? 0);
    return ok(res, updated, 'Task moved successfully');
  }
);

// DELETE /projects/:projectId/tasks/:taskId  — delete task
export const deleteTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, taskId } = req.params as { projectId: string; taskId: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await requireProjectMembership(projectId, user.id);

    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId)
      throw new ApiError(404, 'Task not found');

    // Only task creator, project creator, or org admin can delete
    const { organizationMemberRepository } = await import(
      '../repositories/organization.repository.js'
    );
    const orgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId: user.id,
    });
    const isOrgAdmin = orgMembership?.role === 'ORG_ADMIN';
    const isCreator = task.createdById === user.id;

    if (!isOrgAdmin && !isCreator)
      throw new ApiError(403, 'Only the task creator or org admins can delete tasks');

    await taskRepository.delete(taskId);
    return ok(res, null, 'Task deleted successfully');
  }
);

// ─────────────────────────────────────────────────────────────
// KANBAN COLUMN HANDLERS
// ─────────────────────────────────────────────────────────────

// GET /projects/:projectId/columns  — list columns
export const listColumns = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const columns = await kanbanColumnRepository.findByProject(projectId);
    return ok(res, columns, 'Columns retrieved successfully');
  }
);

// POST /projects/:projectId/columns  — create column
export const createColumn = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const { name, color } = req.body as { name: string; color?: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    // Position = current column count
    const existing = await kanbanColumnRepository.findByProject(projectId);
    const position = existing.length;

    const column = await kanbanColumnRepository.create({
      projectId,
      name: name.trim(),
      position,
      color: color || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Column created successfully',
      data: column,
    });
  }
);

// PUT /projects/:projectId/columns/:columnId  — update column
export const updateColumn = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, columnId } = req.params as { projectId: string; columnId: string };
    const { name, color } = req.body as { name?: string; color?: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const updated = await kanbanColumnRepository.update(columnId, {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
    });

    if (!updated) throw new ApiError(404, 'Column not found');
    return ok(res, updated, 'Column updated successfully');
  }
);

// DELETE /projects/:projectId/columns/:columnId  — delete column
export const deleteColumn = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId, columnId } = req.params as { projectId: string; columnId: string };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    const count = await kanbanColumnRepository.delete(columnId);
    if (count === 0) throw new ApiError(404, 'Column not found');

    return ok(res, null, 'Column deleted successfully');
  }
);

// PATCH /projects/:projectId/columns/reorder  — reorder columns
export const reorderColumns = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const { orderedIds } = req.body as { orderedIds: string[] };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    await requireProjectMembership(projectId, user.id);

    await kanbanColumnRepository.reorder(projectId, orderedIds);

    const columns = await kanbanColumnRepository.findByProject(projectId);
    return ok(res, columns, 'Columns reordered successfully');
  }
);
