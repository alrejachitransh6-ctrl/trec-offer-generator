import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the blank TREC PDF is bundled with the serverless function that
  // fills it (it's read from the filesystem, not served statically).
  outputFileTracingIncludes: {
    "/api/deals/**": ["./public/templates/**"],
  },
};

export default nextConfig;
