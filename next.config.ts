import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Removed output: "standalone" — causes ENOENT error on Vercel with Next.js 16 Turbopack */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
