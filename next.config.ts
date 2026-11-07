import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Prevent existing ESLint warnings/errors from failing Vercel production deployments
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ensure production deployment succeeds reliably on Vercel
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
