import { User } from './users.model.js';
import { Verification } from './verification.model.js';
import { Organization } from './organizations.model.js';
import { OrganizationMember } from './organizationMembers.model.js';
import { Invitation } from './invitations.model.js';
import { Project } from './projects.model.js';
import { ProjectMember } from './projectMembers.model.js';
import { KanbanColumn } from './kanbanColumns.model.js';
import { Task } from './tasks.model.js';
import { TaskAssignee } from './taskAssignees.model.js';
import { TaskComment } from './taskComments.model.js';
import { TaskAttachment } from './taskAttachments.model.js';
import { Subtask } from './subtasks.model.js';
import { ChatMessage } from './chatMessages.model.js';
import { Notification } from './notifications.model.js';

// Setup associations

// User ↔ Organization (through OrganizationMember)
User.belongsToMany(Organization, { through: OrganizationMember, foreignKey: 'userId' });
Organization.belongsToMany(User, { through: OrganizationMember, foreignKey: 'organizationId' });
Organization.hasMany(OrganizationMember, { foreignKey: 'organizationId', as: 'members' });
OrganizationMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
OrganizationMember.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// Organization → Owner
Organization.belongsTo(User, { as: 'owner', foreignKey: 'ownerId' });

// Organization → Projects
Organization.hasMany(Project, { foreignKey: 'organizationId', onDelete: 'CASCADE', as: 'projects' });
Project.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// User ↔ Project (through ProjectMember)
User.belongsToMany(Project, { through: ProjectMember, foreignKey: 'userId' });
Project.belongsToMany(User, { through: ProjectMember, foreignKey: 'projectId' });
Project.hasMany(ProjectMember, { foreignKey: 'projectId', as: 'members' });
ProjectMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ProjectMember.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Project → Kanban Columns
Project.hasMany(KanbanColumn, { foreignKey: 'projectId', onDelete: 'CASCADE', as: 'columns' });
KanbanColumn.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Column → Tasks
KanbanColumn.hasMany(Task, { foreignKey: 'columnId', as: 'tasks' });
Task.belongsTo(KanbanColumn, { foreignKey: 'columnId', as: 'column' });

// Task associations
Task.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Task.belongsTo(User, { as: 'creator', foreignKey: 'createdById' });
Task.belongsToMany(User, { through: TaskAssignee, foreignKey: 'taskId', otherKey: 'userId', as: 'assignees' });
User.belongsToMany(Task, { through: TaskAssignee, foreignKey: 'userId', otherKey: 'taskId', as: 'assignedTasks' });
Task.hasMany(TaskComment, { foreignKey: 'taskId', onDelete: 'CASCADE', as: 'comments' });
Task.hasMany(TaskAttachment, { foreignKey: 'taskId', onDelete: 'CASCADE', as: 'attachments' });
Task.hasMany(Subtask, { foreignKey: 'taskId', onDelete: 'CASCADE', as: 'subtasks' });

// Task Comments
TaskComment.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });
TaskComment.belongsTo(User, { as: 'author', foreignKey: 'authorId' });

// Task Attachments
TaskAttachment.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });
TaskAttachment.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedById' });

// Subtasks
Subtask.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });
Subtask.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

// Chat Messages
ChatMessage.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
ChatMessage.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });

// Invitations
Invitation.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Invitation.belongsTo(User, { as: 'invitedBy', foreignKey: 'invitedById' });

// Notifications
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User ↔ Verification (if still needed)
User.hasMany(Verification, { foreignKey: 'userId', as: 'verifications' });
Verification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

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
  ChatMessage,
  Notification,
};

