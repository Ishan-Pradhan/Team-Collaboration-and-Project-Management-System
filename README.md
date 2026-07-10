# capms

Team Collaboration and Project Management System — a multi-tenant workspace platform combining project/task tracking, a Kanban board, team chat, notifications, a personal calendar, and platform administration in a single application.

## Overview

capms lets an organization manage projects as Kanban boards, assign and track tasks with comments/subtasks/attachments, communicate in channels and direct messages, and keep a per-user notification feed and personal calendar — all scoped to an organization with role-based access (owner, organization admin, project manager, member). A separate super admin surface covers platform-wide user and organization management.

The backend and frontend are independent packages in a single repository; they share no code and communicate exclusively over the REST API.

## Tech stack

**Backend**
- Node.js, Express 5, TypeScript
- PostgreSQL via Sequelize (migrations, not `sync()`)
- Redis + BullMQ for background jobs (due-date reminders, transactional email)
- Socket.IO for real-time chat and notifications
- JWT auth in HttpOnly cookies, Google/GitHub OAuth
- Cloudinary for file storage, Resend for transactional email
- Swagger/OpenAPI docs generated from JSDoc annotations on the routes

**Frontend**
- Next.js 16 (App Router), React 19
- TanStack Query for server state, Zustand for client state
- Tailwind CSS v4 with a custom design token system, Radix UI primitives
- React Hook Form + Zod for form validation
- dnd-kit for the Kanban board's drag-and-drop

**Infrastructure**
- Docker Compose orchestrates the frontend, backend, PostgreSQL, and Redis
- A one-off migration container applies the database schema on startup

## Repository structure

```
backend/    Express REST API (RMVCS: routes -> middleware -> controllers -> repositories -> models)
frontend/   Next.js App Router client
docker-compose.yml   Full local stack: frontend, backend, migrate, redis, db
```

## Getting started

### Prerequisites

- Docker and Docker Compose, **or**
- Node.js 20+, PostgreSQL 15+, and Redis 7+ for running the services directly

### Environment variables

Copy `backend/.env` from your own values (there is no committed template — none of the secrets below should ever be committed). At minimum the backend needs:

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `REDIS_URL` | Redis connection for the BullMQ job queue |
| `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN` | Access token signing |
| `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN` | Refresh token signing |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL` | GitHub OAuth |
| `CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | File uploads |
| `FRONTEND_URL` | Used to build links in emails and for CORS |
| `PORT` | API port (defaults to 8080) |

The frontend needs one variable, in `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

This is read at build time (it's inlined into the client bundle), so when building a Docker image it must be supplied as a build argument rather than a runtime environment variable.

### Run with Docker

From the repository root, with `backend/.env` in place:

```bash
docker compose up --build
```

This builds and starts the frontend, backend, PostgreSQL, and Redis, and runs pending migrations before the API comes up. Default ports:

| Service | Port |
|---|---|
| Frontend | 3000 |
| Backend API | 8080 |
| PostgreSQL | 5433 |
| Redis | 6381 |

Override any of them with `FRONTEND_PORT`, `PORT`, `DOCKER_DB_PORT`, or `DOCKER_REDIS_PORT`. `backend/docker-compose.yml` also exists independently, for running just the API with its database and Redis, without the frontend.

### Run locally without Docker

```bash
# backend
cd backend
npx sequelize-cli db:migrate
npm run dev          # tsx watch src/index.ts, http://localhost:8080

# frontend, in a second terminal
cd frontend
npm run dev          # http://localhost:3000
```

## API documentation

With the backend running, interactive Swagger UI is available at `http://localhost:8080/api/docs`, and the raw OpenAPI document at `http://localhost:8080/api/docs.json`. Every route is namespaced under `/api/v1`, grouped by tag: Auth, OAuth, Email Verification, Password, Organizations, Projects, Tasks, Channels, Notifications, Personal Events, and Admin.

## Database migrations

Schema changes are Sequelize migrations under `backend/src/sequelize/migrations`, run through the Sequelize CLI:

```bash
cd backend
npx sequelize-cli db:migrate         # apply pending migrations
npx sequelize-cli db:migrate:undo    # roll back the last migration
```

## Scripts

**Backend** (`backend/`)
- `npm run dev` — start the API with hot reload

**Frontend** (`frontend/`)
- `npm run dev` — start the Next.js dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint
