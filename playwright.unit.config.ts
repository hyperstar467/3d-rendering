import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["textureTransform.spec.ts", "geometry.spec.ts", "hierarchy.spec.ts"],
  workers: 1,
  reporter: "line",
});
