import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Team Collaboration & Project Management System API',
      version: '1.0.0',
      description:
        'REST API for a multi-tenant team collaboration and project management platform. ' +
        'Covers authentication (local + OAuth), organizations and membership, projects and ' +
        'Kanban boards, tasks with comments/subtasks/attachments, real-time chat channels and ' +
        'direct messages, notifications, personal calendar events, and platform administration.',
      contact: {
        name: 'API support',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Current server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
          description:
            'HTTP-only cookie set on login/register. Include credentials in every request.',
        },
      },
      schemas: {
        // ── Shared primitives ──────────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: {},
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            totalItems: { type: 'integer', example: 42 },
            itemCount: { type: 'integer', example: 10 },
            totalPages: { type: 'integer', example: 5 },
            currentPage: { type: 'integer', example: 1 },
          },
        },
        // ── User ───────────────────────────────────────────────────────
        UserPublic: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Jane Doe' },
            email: { type: 'string', format: 'email', example: 'jane@example.com' },
            avatarUrl: { type: 'string', nullable: true, example: 'https://gravatar.com/avatar/...' },
            role: { type: 'string', enum: ['USER', 'SUPER_ADMIN'], example: 'USER' },
            isVerified: { type: 'boolean', example: true },
            isActive: { type: 'boolean', example: true },
            authProvider: { type: 'string', enum: ['local', 'google', 'github'], example: 'local' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Organization: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'My Awesome Company' },
            ownerId: { type: 'string', format: 'uuid' },
            isSuspended: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Chat ───────────────────────────────────────────────────────
        Channel: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            organizationId: { type: 'string', format: 'uuid' },
            name: { type: 'string', nullable: true, example: 'general' },
            type: { type: 'string', enum: ['PUBLIC', 'PRIVATE', 'DM'], example: 'PUBLIC' },
            createdBy: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            channelId: { type: 'string', format: 'uuid' },
            senderId: { type: 'string', format: 'uuid', nullable: true },
            type: { type: 'string', enum: ['TEXT', 'SYSTEM', 'FILE'], example: 'TEXT' },
            content: { type: 'string', example: 'Hey team, standup in 5.' },
            fileName: { type: 'string', nullable: true },
            fileUrl: { type: 'string', nullable: true },
            fileType: { type: 'string', nullable: true },
            fileSize: { type: 'integer', nullable: true },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Notifications & calendar ─────────────────────────────────────
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            organizationId: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid', nullable: true },
            type: { type: 'string', example: 'task_assigned' },
            title: { type: 'string', example: 'Jane Doe assigned you to "Fix login bug"' },
            body: { type: 'string', nullable: true },
            entityType: { type: 'string', nullable: true, example: 'task' },
            entityId: { type: 'string', format: 'uuid', nullable: true },
            isRead: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PersonalEvent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            organizationId: { type: 'string', format: 'uuid' },
            title: { type: 'string', example: 'Dentist appointment' },
            dueDate: { type: 'string', format: 'date', example: '2026-08-01' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    // Global security applied to all endpoints unless overridden
    security: [{ cookieAuth: [] }],
    tags: [
      { name: 'Health', description: 'Server status' },
      { name: 'Auth', description: 'Register, login, logout and token management' },
      { name: 'OAuth', description: 'Google & GitHub OAuth 2.0 flows' },
      { name: 'Email Verification', description: 'Verify and resend email confirmations' },
      { name: 'Password', description: 'Forgot / reset / change password' },
      { name: 'Admin', description: 'User management (admin only)' },
      { name: 'Organizations', description: 'Workspaces and organizational member management' },
      { name: 'Projects', description: 'Project tracking and management within organizations' },
      { name: 'Tasks', description: 'Task and Kanban board operations' },
      { name: 'Channels', description: 'Chat channels, direct messages, and file sharing' },
      { name: 'Notifications', description: "A user's in-app notification feed" },
      { name: 'Personal Events', description: "A user's personal calendar events within an organization" },
    ],
  },
  // Enumerate each route file explicitly.
  // path.join produces backslashes on Windows which breaks swagger-jsdoc's
  // glob engine — forward-slash paths are safe cross-platform.
  apis: (() => {
    // tsx sets __dirname to the source file's directory.
    // Use both __dirname-relative and cwd-relative paths as fallbacks.
    const fromDirname = path.resolve(__dirname, '../routes');
    const fromCwd = path.resolve(process.cwd(), 'src/routes');

    const routesDir = fromDirname.replace(/\\/g, '/');
    const cwdDir = fromCwd.replace(/\\/g, '/');

    const files = ['auth', 'admin', 'health', 'organization', 'project', 'task', 'channel', 'notification', 'personalEvent'];
    const exts = ['ts', 'js'];

    const paths: string[] = [];
    for (const dir of [routesDir, cwdDir]) {
      for (const file of files) {
        for (const ext of exts) {
          paths.push(`${dir}/${file}.routes.${ext}`);
        }
      }
    }

    console.log('[Swagger] Scanning route files from:', routesDir);
    return paths;
  })(),
};

export const swaggerSpec = swaggerJsdoc(options);
