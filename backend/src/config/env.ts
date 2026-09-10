import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // Redis
  REDIS_URL: z.string().min(1),

  // JWT
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, 'ACCESS_TOKEN_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1),

  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, 'REFRESH_TOKEN_SECRET must be at least 32 chars'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),

  // Email
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.url(),

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.url(),

  // Cloudinary
  CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Optional
  FRONTEND_URL: z.url().optional(),
  // Set to `lax` when the API and frontend share a registrable domain, e.g.
  // api.example.com + app.example.com. Defaults to `none`, which cross-site
  // deployments require but which weakens CSRF protection (see cookie.config.ts).
  COOKIE_SAMESITE: z.enum(['lax', 'none', 'strict']).optional(),
  // Domain on which cookies are set (e.g. `.ishanpradhan.com.np` to share across subdomains).
  // Leave empty for host-only cookies.
  COOKIE_DOMAIN: z.string().optional(),
  // Public URL of this API itself — needed because the email-verification
  // link is a direct backend GET route (unlike password reset/invites,
  // which link to frontend pages). Falls back to localhost for local dev.
  BACKEND_URL: z.url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
