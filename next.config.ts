import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // `next build` normally writes to .next (shared with the dev server).
  // CI/verification builds set NEXT_DIST_DIR to an isolated folder so a
  // production build can run while dev is live.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["sweph"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
