import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: '',
      version: '1.0.0',
      description:
        'REST API for the  ' +
        'Supports user authentication ' +
        'admin operations.',
      contact: {
        name: '',
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
            role: { type: 'string', enum: ['user', 'superadmin'], example: 'user' },
            isVerified: { type: 'boolean', example: true },
            isBlocked: { type: 'boolean', example: false },
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

    const files = ['auth', 'admin', 'health', 'organization'];
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
