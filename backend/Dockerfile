# ---------- Build Stage ----------
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files
COPY . .

# If you have a build script in package.json (e.g. tsc), run it here
# For example: RUN npm run build
# Since this boilerplate appears to use tsx for dev, we assume we might just want to 
# copy it as is, or if you eventually compile to JS, this is where you'd run it.

# ---------- Production Stage ----------
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json

# (Optional) If you have built JS files, you would copy them instead of /src
# COPY --from=build /app/dist ./dist

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

# Expose the API port
EXPOSE 8080

# Command to start the application
# Note: since dev uses "tsx watch", for production you likely want "tsx" without watching,
# or better yet, pre-compile to JS and run "node dist/index.js".
# For boilerplate simplicity, we will run tsx as the start command if no build script exists.
CMD ["npx", "tsx", "src/index.ts"]
