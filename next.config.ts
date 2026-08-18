import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: "/3d-rendering",
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
