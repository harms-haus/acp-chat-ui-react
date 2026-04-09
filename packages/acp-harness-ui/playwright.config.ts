import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: "html",
  
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "on",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "visual",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ["--font-render-hinting=none", "--disable-lcd-text"],
        },
      },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
});