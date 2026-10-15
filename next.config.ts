import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
