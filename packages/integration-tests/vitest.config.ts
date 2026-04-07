import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
    ],
    globals: true,
    environment: "node",
    testTimeout: 120000, // 120 seconds for long replay tests
    poolOptions: {
      forks: {
        singleFork: true, // Prevent port conflicts between tests
      },
    },
  },
});
