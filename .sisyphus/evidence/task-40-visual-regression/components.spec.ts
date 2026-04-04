import { test, expect } from "@playwright/test";

test.describe("Composer Visual Regression", () => {
  test("Composer - idle state (disabled, not connected)", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-acp-composer]');
    
    const composer = page.locator('[data-acp-composer-panel]');
    await expect(composer).toHaveScreenshot("composer-idle.png", {
      maxDiffPixels: 100,
    });
  });

  test("Composer - connected demo state", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    const composer = page.locator('[data-acp-composer-panel]');
    await expect(composer).toHaveScreenshot("composer-connected.png", {
      maxDiffPixels: 100,
    });
  });

  test("Composer - with text input", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    const textarea = page.locator('[data-acp-composer-input]');
    await textarea.fill("Hello, this is a test message for visual regression");
    
    const composer = page.locator('[data-acp-composer-panel]');
    await expect(composer).toHaveScreenshot("composer-with-text.png", {
      maxDiffPixels: 100,
    });
  });
});

test.describe("Thread Visual Regression", () => {
  test("Thread - empty state", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-acp-thread-empty]');
    
    const thread = page.locator('[data-acp-thread-panel]');
    await expect(thread).toHaveScreenshot("thread-empty.png", {
      maxDiffPixels: 100,
    });
  });

  test("Thread - populated with messages", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    const textarea = page.locator('[data-acp-composer-input]');
    await textarea.fill("Test message for thread");
    await textarea.press("Enter");
    
    await page.waitForSelector('[data-acp-message-role="agent"]', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const thread = page.locator('[data-acp-thread-panel]');
    await expect(thread).toHaveScreenshot("thread-populated.png", {
      maxDiffPixels: 200,
    });
  });
});

test.describe("MessageCard Visual Regression", () => {
  test("MessageCard - user message", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    const textarea = page.locator('[data-acp-composer-input]');
    await textarea.fill("User test message");
    await textarea.press("Enter");
    
    await page.waitForSelector('[data-acp-message-role="user"]');
    
    const messageCard = page.locator('[data-acp-message-role="user"]').first();
    await expect(messageCard).toHaveScreenshot("messagecard-user.png", {
      maxDiffPixels: 100,
    });
  });

  test("MessageCard - agent message", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    const textarea = page.locator('[data-acp-composer-input]');
    await textarea.fill("Test");
    await textarea.press("Enter");
    
    await page.waitForSelector('[data-acp-message-role="agent"]', { timeout: 5000 });
    await page.waitForTimeout(1500);
    
    const messageCard = page.locator('[data-acp-message-role="agent"]').first();
    await expect(messageCard).toHaveScreenshot("messagecard-agent.png", {
      maxDiffPixels: 100,
    });
  });
});

test.describe("SettingsPanel Visual Regression", () => {
  test("SettingsPanel - disconnected state", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "SettingsPanel Demo" }).click();
    await page.waitForSelector('[data-acp-settings-panel-demo]');
    
    const panel = page.locator('[data-acp-settings-panel-demo]');
    await expect(panel).toHaveScreenshot("settingspanel-disconnected.png", {
      maxDiffPixels: 100,
    });
  });

  test("SettingsPanel - connected state", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    await page.getByRole("tab", { name: "SettingsPanel Demo" }).click();
    await page.waitForSelector('[data-acp-settings-panel]');
    
    const panel = page.locator('[data-acp-settings-panel]');
    await expect(panel).toHaveScreenshot("settingspanel-connected.png", {
      maxDiffPixels: 100,
    });
  });
});

test.describe("SlashSuggestions Visual Regression", () => {
  test("SlashSuggestions - open popover", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    await page.getByRole("tab", { name: "Slash/Actions Demo" }).click();
    
    const textarea = page.locator('[data-acp-slash-actions-demo] [data-acp-composer-input]');
    await textarea.fill("/");
    await page.waitForSelector('[data-acp-slash-popover]', { timeout: 3000 });
    
    const popover = page.locator('[data-acp-slash-popover]');
    await expect(popover).toHaveScreenshot("slashsuggestions-open.png", {
      maxDiffPixels: 100,
    });
  });

  test("SlashSuggestions - selected item", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    await page.getByRole("tab", { name: "Slash/Actions Demo" }).click();
    
    const textarea = page.locator('[data-acp-slash-actions-demo] [data-acp-composer-input]');
    await textarea.fill("/");
    await page.waitForSelector('[data-acp-slash-popover]', { timeout: 3000 });
    
    await textarea.press("ArrowDown");
    
    const popover = page.locator('[data-acp-slash-popover]');
    await expect(popover).toHaveScreenshot("slashsuggestions-selected.png", {
      maxDiffPixels: 100,
    });
  });
});

test.describe("ThoughtStack Visual Regression", () => {
  test("ThoughtStack - collapsed state", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Thought/Tool" }).click();
    await page.getByRole("button", { name: "Start Thought/Tool Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    const textarea = page.locator('[data-acp-composer-input]');
    await textarea.fill("test");
    await textarea.press("Enter");
    
    await page.waitForSelector('[data-acp-thought-root]', { timeout: 5000 });
    await page.waitForTimeout(500);
    
    const thoughtStack = page.locator('[data-acp-thought-root]');
    await expect(thoughtStack).toHaveScreenshot("thoughtstack-collapsed.png", {
      maxDiffPixels: 100,
    });
  });

  test("ThoughtStack - expanded state", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Thought/Tool" }).click();
    await page.getByRole("button", { name: "Start Thought/Tool Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    const textarea = page.locator('[data-acp-composer-input]');
    await textarea.fill("test");
    await textarea.press("Enter");
    
    await page.waitForSelector('[data-acp-thought-trigger]', { timeout: 5000 });
    await page.waitForTimeout(500);
    
    await page.locator('[data-acp-thought-trigger]').first().click();
    await page.waitForTimeout(200);
    
    const thoughtStack = page.locator('[data-acp-thought-root]');
    await expect(thoughtStack).toHaveScreenshot("thoughtstack-expanded.png", {
      maxDiffPixels: 150,
    });
  });
});

test.describe("ToolCall Visual Regression", () => {
  test("ToolCall - in expanded ThoughtStack", async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole("tab", { name: "Thought/Tool" }).click();
    await page.getByRole("button", { name: "Start Thought/Tool Demo" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]');
    
    const textarea = page.locator('[data-acp-composer-input]');
    await textarea.fill("test");
    await textarea.press("Enter");
    
    await page.waitForSelector('[data-acp-thought-trigger]', { timeout: 5000 });
    await page.waitForTimeout(1500);
    
    await page.locator('[data-acp-thought-trigger]').first().click();
    await page.waitForTimeout(500);
    
    const thoughtStack = page.locator('[data-acp-thought-root]');
    await expect(thoughtStack).toHaveScreenshot("toolcall-in-thoughtstack.png", {
      maxDiffPixels: 200,
    });
  });
});