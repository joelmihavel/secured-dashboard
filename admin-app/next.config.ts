import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Avoids a Next.js 15 + Vercel trace bug where the build looks for a
  // page_client-reference-manifest.js for the (dashboard) route group
  // even though route groups have no page. Standalone output bundles
  // server files differently and skips that trace step.
  output: "standalone",
};

export default nextConfig;
