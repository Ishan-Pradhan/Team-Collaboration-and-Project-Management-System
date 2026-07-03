import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { taskRepository } from '../repositories/task.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { kanbanColumnRepository } from '../repositories/kanbanColumn.repository.js';
import { taskCommentRepository } from '../repositories/taskComment.repository.js';
import { taskAttachmentRepository } from '../repositories/taskAttachment.repository.js';
import { subtaskRepository } from '../repositories/subtask.repository.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary.service.js';
import { organizationMemberRepository, organizationRepository } from '../repositories/organization.repository.js';
import { activityLogRepository } from '../repositories/activityLog.repository.js';
import { notifyUser } from '../utils/notify.js';
import { env } from '../config/env.js';
function cloudinaryResourceType(mimeType: string): 'image' | 'video' | 'raw' {
  if (mimeType.startsWith('image/') || mimeType === 'application/pdf') return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}


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
    const data = tasks.map((t) => {
      const json = t.toJSON() as unknown as Record<string, unknown>;
      const comments = (json.comments as unknown[]) ?? [];
      const attachments = (json.attachments as unknown[]) ?? [];
      const subtasks = (json.subtasks as { isCompleted: boolean }[]) ?? [];
      return {
        ...json,
        commentCount: comments.length,
        attachmentCount: attachments.length,
        subtaskCount: subtasks.length,
        subtaskCompletedCount: subtasks.filter((s) => s.isCompleted).length,
        comments: undefined,
        attachments: undefined,
        subtasks: undefined,
      };
    });
    return ok(res, data, 'Tasks retrieved successfully');
  }
);

// POST /projects/:projectId/tasks  — create task
export const createTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const { title, description, columnId, priority, assigneeIds, dueDate } = req.body as {
      title: string;
      description?: string | null;
      columnId: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeIds?: string[];
      dueDate?: string | null;
    };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await requireProjectMembership(projectId, user.id);

    const columns = await kanbanColumnRepository.findByProject(projectId);
    const colExists = columns.some((c) => c.id === columnId);
    if (!colExists) throw new ApiError(400, 'Column does not belong to this project');

    const position = await taskRepository.countByColumn(columnId);

    const task = await taskRepository.create({
      projectId,
      columnId,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority ?? 'MEDIUM',
      dueDate: dueDate || null,
      createdById: user.id,
      position,
    });

    if (assigneeIds && assigneeIds.length > 0) {
      await taskRepository.syncAssignees(task.id, assigneeIds);
    }

    const created = await taskRepository.findById(task.id);

    if (created?.assignees && created.assignees.length > 0) {
      const org = await organizationRepository.findById(project.organizationId);
      await Promise.all(
        created.assignees
          .filter((assignee) => assignee.id !== user.id)
          .map((assignee) =>
            notifyUser({
              userId: assignee.id,
              organizationId: project.organizationId,
              projectId: project.id,
              type: 'task_assigned',
              title: `${user.name} assigned you to "${created.title}"`,
              body: `You were assigned to a task in ${project.name}.`,
              entityType: 'task',
              entityId: created.id,
              email: {
                to: assignee.email,
                subject: `${user.name} assigned you to "${created.title}"`,
                bodyText: `You were assigned to a task in ${project.name}.`,
                link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}?taskId=${created.id}`,
              },
            })
          )
      );
    }

    activityLogRepository.log({
      projectId,
      actorId: user.id,
      type: 'task_created',
      entityType: 'task',
      entityId: task.id,
      metadata: { taskTitle: task.title, taskId: task.id },
    }).catch(() => {});

    return res.status(201).json({ success: true, message: 'Task created successfully', data: created });
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
    const { title, description, priority, assigneeIds, dueDate } = req.body as {
      title?: string;
      description?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assigneeIds?: string[];
      dueDate?: string | null;
    };
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');

    const project = await requireProjectMembership(projectId, user.id);

    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId)
      throw new ApiError(404, 'Task not found');

    const previousAssigneeIds = new Set((task.assignees ?? []).map((a) => a.id));

    await taskRepository.update(taskId, {
      title: title !== undefined ? title.trim() : task.title,
      description: description !== undefined ? description : task.description,
      priority: priority !== undefined ? priority : task.priority,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
    });

    if (assigneeIds !== undefined) {
      await taskRepository.syncAssignees(taskId, assigneeIds);
    }

    const updated = await taskRepository.findById(taskId);

    if (assigneeIds !== undefined && updated?.assignees) {
      const newlyAssigned = updated.assignees.filter(
        (assignee) => !previousAssigneeIds.has(assignee.id) && assignee.id !== user.id
      );
      if (newlyAssigned.length > 0) {
        const org = await organizationRepository.findById(project.organizationId);
        await Promise.all(
          newlyAssigned.map((assignee) =>
            notifyUser({
              userId: assignee.id,
              organizationId: project.organizationId,
              projectId: project.id,
              type: 'task_assigned',
              title: `${user.name} assigned you to "${updated.title}"`,
              body: `You were assigned to a task in ${project.name}.`,
              entityType: 'task',
              entityId: taskId,
              email: {
                to: assignee.email,
                subject: `${user.name} assigned you to "${updated.title}"`,
                bodyText: `You were assigned to a task in ${project.name}.`,
                link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}?taskId=${taskId}`,
              },
            })
          )
        );
      }
    }

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

    const fromColumnId = task.columnId;
    const updated = await taskRepository.move(taskId, columnId, position ?? 0);

    if (fromColumnId !== columnId) {
      const fromCol = columns.find((c) => c.id === fromColumnId)?.name;
      const toCol = columns.find((c) => c.id === columnId)?.name;
      activityLogRepository.log({
        projectId,
        actorId: user.id,
        type: 'task_moved',
        entityType: 'task',
        entityId: taskId,
        metadata: { taskTitle: task.title, taskId, fromColumn: fromCol ?? null, toColumn: toCol ?? null },
      }).catch(() => {});
    }

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
    const orgMembership = await organizationMemberRepository.findOne({
      organizationId: project.organizationId,
      userId: user.id,
    });
    const isOrgAdmin = orgMembership?.role === 'ORG_ADMIN';
    const isCreator = task.createdById === user.id;

    if (!isOrgAdmin && !isCreator)
      throw new ApiError(403, 'Only the task creator or org admins can delete tasks');

    const taskTitle = task.title;
    await taskRepository.delete(taskId);

    activityLogRepository.log({
      projectId,
      actorId: user.id,
      type: 'task_deleted',
      entityType: 'task',
      entityId: taskId,
      metadata: { taskTitle, taskId },
    }).catch(() => {});

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

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────

const isOrgAdminForProject = async (projectId: string, userId: string): Promise<boolean> => {
  const project = await projectRepository.findById(projectId);
  if (!project) return false;
  const orgMembership = await organizationMemberRepository.findOne({
    organizationId: project.organizationId,
    userId,
  });
  return orgMembership?.role === 'ORG_ADMIN' || project.createdById === userId;
};

// ─────────────────────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────────────────────

// GET /projects/:projectId/tasks/:taskId/comments
export const listComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId } = req.params as { projectId: string; taskId: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const comments = await taskCommentRepository.findByTask(taskId);
  return ok(res, comments, 'Comments retrieved successfully');
});

// POST /projects/:projectId/tasks/:taskId/comments
export const createComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId } = req.params as { projectId: string; taskId: string };
  const { content } = req.body as { content: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const project = await requireProjectMembership(projectId, user.id);

  const task = await taskRepository.findById(taskId);
  if (!task || task.projectId !== projectId) throw new ApiError(404, 'Task not found');

  const comment = await taskCommentRepository.create({ taskId, authorId: user.id, content: content.trim() });

  const otherAssignees = (task.assignees ?? []).filter((assignee) => assignee.id !== user.id);
  if (otherAssignees.length > 0) {
    const org = await organizationRepository.findById(project.organizationId);
    const trimmedContent = content.trim();
    await Promise.all(
      otherAssignees.map((assignee) =>
        notifyUser({
          userId: assignee.id,
          organizationId: project.organizationId,
          projectId: project.id,
          type: 'task_comment_added',
          title: `${user.name} commented on "${task.title}"`,
          body: trimmedContent.slice(0, 200),
          entityType: 'task',
          entityId: taskId,
          email: {
            to: assignee.email,
            subject: `${user.name} commented on "${task.title}"`,
            bodyText: trimmedContent.slice(0, 200),
            link: `${(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/org/${org?.slug}/projects/${project.id}?taskId=${taskId}`,
          },
        })
      )
    );
  }

  activityLogRepository.log({
    projectId,
    actorId: user.id,
    type: 'comment_added',
    entityType: 'task',
    entityId: taskId,
    metadata: { taskTitle: task.title, taskId, commentId: comment.id, content: content.trim() },
  }).catch(() => {});

  return res.status(201).json({ success: true, message: 'Comment added', data: comment });
});

// DELETE /projects/:projectId/tasks/:taskId/comments/:commentId
export const deleteComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId, commentId } = req.params as {
    projectId: string; taskId: string; commentId: string;
  };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const comment = await taskCommentRepository.findById(commentId);
  if (!comment || comment.taskId !== taskId) throw new ApiError(404, 'Comment not found');

  const admin = await isOrgAdminForProject(projectId, user.id);
  if (!admin && comment.authorId !== user.id)
    throw new ApiError(403, 'You can only delete your own comments');

  if (admin && comment.authorId !== user.id) {
    await taskCommentRepository.deleteByAdmin(commentId);
  } else {
    await taskCommentRepository.delete(commentId, user.id);
  }

  return ok(res, null, 'Comment deleted');
});

// ─────────────────────────────────────────────────────────────
// SUBTASKS
// ─────────────────────────────────────────────────────────────

// GET /projects/:projectId/tasks/:taskId/subtasks
export const listSubtasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId } = req.params as { projectId: string; taskId: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const subtasks = await subtaskRepository.findByTask(taskId);
  return ok(res, subtasks, 'Subtasks retrieved');
});

// POST /projects/:projectId/tasks/:taskId/subtasks
export const createSubtask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId } = req.params as { projectId: string; taskId: string };
  const { title } = req.body as { title: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const task = await taskRepository.findById(taskId);
  if (!task || task.projectId !== projectId) throw new ApiError(404, 'Task not found');

  const position = await subtaskRepository.countByTask(taskId);
  const subtask = await subtaskRepository.create({ taskId, title: title.trim(), createdById: user.id, position });
  return res.status(201).json({ success: true, message: 'Subtask created', data: subtask });
});

// PATCH /projects/:projectId/tasks/:taskId/subtasks/:subtaskId/toggle
export const toggleSubtask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId, subtaskId } = req.params as {
    projectId: string; taskId: string; subtaskId: string;
  };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const subtask = await subtaskRepository.findById(subtaskId);
  if (!subtask || subtask.taskId !== taskId) throw new ApiError(404, 'Subtask not found');

  const updated = await subtaskRepository.toggle(subtaskId, !subtask.isCompleted);
  return ok(res, updated, 'Subtask toggled');
});

// DELETE /projects/:projectId/tasks/:taskId/subtasks/:subtaskId
export const deleteSubtask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId, subtaskId } = req.params as {
    projectId: string; taskId: string; subtaskId: string;
  };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const subtask = await subtaskRepository.findById(subtaskId);
  if (!subtask || subtask.taskId !== taskId) throw new ApiError(404, 'Subtask not found');

  const admin = await isOrgAdminForProject(projectId, user.id);
  if (!admin && subtask.createdById !== user.id)
    throw new ApiError(403, 'You can only delete your own subtasks');

  await subtaskRepository.delete(subtaskId);
  return ok(res, null, 'Subtask deleted');
});

// ─────────────────────────────────────────────────────────────
// ATTACHMENTS
// ─────────────────────────────────────────────────────────────

// GET /projects/:projectId/tasks/:taskId/attachments
export const listTaskAttachments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId } = req.params as { projectId: string; taskId: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const attachments = await taskAttachmentRepository.findByTask(taskId);
  return ok(res, attachments, 'Attachments retrieved');
});

// GET /projects/:projectId/files  — all project files
export const listProjectFiles = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const files = await taskAttachmentRepository.findByProject(projectId);
  return ok(res, files, 'Project files retrieved');
});

// POST /projects/:projectId/tasks/:taskId/attachments  — upload file
export const uploadAttachment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId } = req.params as { projectId: string; taskId: string };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const task = await taskRepository.findById(taskId);
  if (!task || task.projectId !== projectId) throw new ApiError(404, 'Task not found');

  const file = req.file;
  if (!file) throw new ApiError(400, 'No file uploaded');

  const uploaded = await uploadToCloudinary(file.buffer, {
    folder: `task-attachments/${projectId}/${taskId}`,
    resourceType: 'auto',
  });

  const attachment = await taskAttachmentRepository.create({
    taskId,
    projectId,
    uploadedById: user.id,
    fileName: file.originalname,
    fileUrl: uploaded.url,
    cloudinaryPublicId: uploaded.publicId,
    fileType: file.mimetype,
    fileSize: file.size,
  });

  return res.status(201).json({ success: true, message: 'File uploaded', data: attachment });
});

// DELETE /projects/:projectId/tasks/:taskId/attachments/:attachmentId
export const deleteAttachment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId, attachmentId } = req.params as {
    projectId: string; taskId: string; attachmentId: string;
  };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const attachment = await taskAttachmentRepository.findById(attachmentId);
  if (!attachment || attachment.taskId !== taskId) throw new ApiError(404, 'Attachment not found');

  const admin = await isOrgAdminForProject(projectId, user.id);
  if (!admin && attachment.uploadedById !== user.id)
    throw new ApiError(403, 'You can only delete files you uploaded');

  await deleteFromCloudinary(attachment.cloudinaryPublicId, cloudinaryResourceType(attachment.fileType));
  await taskAttachmentRepository.delete(attachmentId);
  return ok(res, null, 'Attachment deleted');
});

// GET /projects/:projectId/tasks/:taskId/attachments/:attachmentId/download
// Proxies the file from Cloudinary so auth is enforced and the browser receives a proper
// Content-Disposition: attachment header without a cross-origin redirect.
export const downloadAttachment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, taskId, attachmentId } = req.params as {
    projectId: string; taskId: string; attachmentId: string;
  };
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  await requireProjectMembership(projectId, user.id);

  const attachment = await taskAttachmentRepository.findById(attachmentId);
  if (!attachment || attachment.taskId !== taskId) throw new ApiError(404, 'Attachment not found');

  const upstream = await fetch(attachment.fileUrl);
  if (!upstream.ok) throw new ApiError(502, 'Could not retrieve file from storage');

  const safeName = encodeURIComponent(attachment.fileName);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
  res.setHeader('Content-Type', attachment.fileType);
  if (attachment.fileSize) res.setHeader('Content-Length', String(attachment.fileSize));
  res.setHeader('Cache-Control', 'private, no-store');

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.end(buffer);
});
