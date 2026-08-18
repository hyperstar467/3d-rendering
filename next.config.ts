import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const distDir = process.env.NEXT_DIST_DIR;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(distDir ? { distDir } : {}),
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: "/3d-rendering",
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
