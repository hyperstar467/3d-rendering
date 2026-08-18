import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["textureTransform.spec.ts", "measurementAndPlacement.spec.ts"],
  workers: 1,
  reporter: "line",
});
