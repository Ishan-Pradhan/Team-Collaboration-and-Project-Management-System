import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Standalone output — Docker's production stage only needs this trimmed
  // server bundle, not the full node_modules tree.
  output: 'standalone',
};

export default nextConfig;
