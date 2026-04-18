import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  turbopack: {
    // Pin workspace root to web/ to avoid lockfile root inference warnings.
    root: path.resolve(__dirname),
  },
  typescript: {
     // Dangerously allow production builds to successfully complete even if
     // your project has type errors.
     ignoreBuildErrors: true,
  },
};

export default nextConfig;
