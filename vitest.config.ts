import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.test.tsx",
      "packages/*/src/**/*.spec.ts",
      "packages/*/src/**/*.spec.tsx",
    ],
    globals: true,
    environment: "node",
    setupFiles: ["vitest.setup.ts"],
    environmentMatchGlobs: [
      ["**/virtualized-thread.test.tsx", "jsdom"],
      ["**/message-rendering.test.tsx", "jsdom"],
      ["**/composer-flow.test.tsx", "jsdom"],
      ["**/settings-session-list.test.tsx", "jsdom"],
      ["**/thought-tool-surfaces.test.tsx", "jsdom"],
      ["**/settings.test.tsx", "jsdom"],
      ["**/slash-and-actions.test.tsx", "jsdom"],
      ["**/message-actions.test.tsx", "jsdom"],
    ],
  },
});