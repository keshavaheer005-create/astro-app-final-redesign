import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // `next build` normally writes to .next (shared with the dev server).
  // CI/verification builds set NEXT_DIST_DIR to an isolated folder so a
  // production build can run while dev is live.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["sweph"],
  // Type errors must fail the build: `bun run typecheck` is clean and CI runs
  // it explicitly, so there is no reason to ship a build that does not compile.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
