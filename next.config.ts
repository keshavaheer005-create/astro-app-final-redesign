import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Native epemeris module must stay external — Turbopack cannot bundle .node bindings.
  serverExternalPackages: ["sweph"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
