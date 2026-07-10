# ---------- Dependencies Stage ----------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ---------- Build Stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# this has to be a build arg, not a runtime environment variable.
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV DOCKER_BUILD=true

RUN npm run build

# ---------- Production Stage ----------
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Docker sets HOSTNAME to the container's own ID by default. Next's
# standalone server.js binds to $HOSTNAME literally and Node's net.Server
# does a real DNS lookup on it — the container ID isn't a resolvable
# hostname, so the server crash-loops on "getaddrinfo EAI_AGAIN <id>"
# unless this is pinned to a real bind address.
ENV HOSTNAME=0.0.0.0

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# `output: 'standalone'` (next.config.ts) traces only the files the server
# actually needs, so the production image doesn't carry the full
# node_modules tree or the pre-build source.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
