import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  // @ts-expect-error - eslint config exists but type definition may be incomplete
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
     // Dangerously allow production builds to successfully complete even if
     // your project has type errors.
     ignoreBuildErrors: true,
  },
};

export default nextConfig;
