import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Standalone output — only for the Docker build (see frontend/Dockerfile,
  // which sets DOCKER_BUILD=true before `next build`). Vercel manages its
  // own build output and standalone mode can conflict with that, so this
  // must not apply when deploying there.
  ...(process.env.DOCKER_BUILD ? { output: 'standalone' as const } : {}),
};

export default nextConfig;
