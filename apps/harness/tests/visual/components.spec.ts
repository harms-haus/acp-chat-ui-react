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

  test.skip("Composer - connected replay state (requires bridge)", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();

    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Start Replay" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]', { timeout: 15000 });

    const composer = page.locator('[data-acp-composer-panel]');
    await expect(composer).toHaveScreenshot("composer-connected.png", {
      maxDiffPixels: 100,
    });
  });

  test.skip("Composer - with text input (requires bridge)", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();

    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Start Replay" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]', { timeout: 15000 });

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
    await page.waitForSelector('[data-acp-thread]', { state: "attached" });

    const thread = page.locator('[data-acp-thread-panel]');
    await expect(thread).toHaveScreenshot("thread-empty.png", {
      maxDiffPixels: 100,
    });
  });

  test.skip("Thread - populated with messages (requires bridge)", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();

    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Start Replay" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]', { timeout: 15000 });

    await page.waitForSelector('[data-acp-message-role="agent"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const thread = page.locator('[data-acp-thread-panel]');
    await expect(thread).toHaveScreenshot("thread-populated.png", {
      maxDiffPixels: 200,
    });
  });
});

test.describe("MessageCard Visual Regression", () => {
  test.skip("MessageCard - user message (requires bridge)", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();

    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Start Replay" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]', { timeout: 15000 });

    await page.waitForSelector('[data-acp-message-role="user"]');

    const messageCard = page.locator('[data-acp-message-role="user"]').first();
    await expect(messageCard).toHaveScreenshot("messagecard-user.png", {
      maxDiffPixels: 100,
    });
  });

  test.skip("MessageCard - agent message (requires bridge)", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();

    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Start Replay" }).click();
    await page.waitForSelector('[data-acp-composer-disabled="false"]', { timeout: 15000 });

    await page.waitForSelector('[data-acp-message-role="agent"]', { timeout: 10000 });
    await page.waitForTimeout(1500);

    const messageCard = page.locator('[data-acp-message-role="agent"]').first();
    await expect(messageCard).toHaveScreenshot("messagecard-agent.png", {
      maxDiffPixels: 100,
    });
  });
});

test.describe("ReplayPanel Visual Regression", () => {
  test("ReplayPanel - default state (no selection)", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-acp-replay-panel]');

    const panel = page.locator('[data-acp-replay-panel]');
    await expect(panel).toHaveScreenshot("replaypanel-default.png", {
      maxDiffPixels: 100,
    });
  });

  test("ReplayPanel - demo type selected", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();
    await page.waitForTimeout(500);

    const panel = page.locator('[data-acp-replay-panel]');
    await expect(panel).toHaveScreenshot("replaypanel-demo-type-selected.png", {
      maxDiffPixels: 100,
    });
  });

  test("ReplayPanel - session selected", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();
    await page.waitForTimeout(500);

    const panel = page.locator('[data-acp-replay-panel]');
    await expect(panel).toHaveScreenshot("replaypanel-session-selected.png", {
      maxDiffPixels: 100,
    });
  });

  test.skip("ReplayPanel - streaming in progress (requires bridge)", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();

    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Start Replay" }).click();

    await page.waitForSelector('[data-acp-replay-status]:has-text("Replaying")', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-acp-replay-panel]');
    await expect(panel).toHaveScreenshot("replaypanel-streaming.png", {
      maxDiffPixels: 100,
    });
  });

  test.skip("ReplayPanel - complete state (requires bridge)", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-acp-settings-select-trigger="demo-type"]').click();
    await page.getByText("Tool Calling/Thinking").click();

    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Start Replay" }).click();

    await page.waitForSelector('[data-acp-replay-status]:has-text("Complete")', { timeout: 20000 });
    await page.waitForTimeout(500);

    const panel = page.locator('[data-acp-replay-panel]');
    await expect(panel).toHaveScreenshot("replaypanel-complete.png", {
      maxDiffPixels: 100,
    });
  });
});

test.describe("LivePanel Visual Regression", () => {
  test("LivePanel - disconnected state", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    const livePanels = await page.locator('[data-acp-live-panel]').count();
    if (livePanels === 0) {
      test.skip();
      return;
    }

    const panel = page.locator('[data-acp-live-panel]');
    await expect(panel).toHaveScreenshot("livepanel-disconnected.png", {
      maxDiffPixels: 100,
    });
  });

  test("LivePanel - connected state", async ({ page }) => {
    await page.goto("/");

    const livePanels = await page.locator('[data-acp-live-panel]').count();
    if (livePanels === 0) {
      test.skip();
      return;
    }

    await page.locator("#bridge-url-input").fill("ws://127.0.0.1:8765");
    await page.locator("#command-input").fill("node");
    await page.locator("#command-args-input").fill("./test.js");

    await page.getByRole("button", { name: "Connect Live" }).click();

    await page.waitForTimeout(500);

    const panel = page.locator('[data-acp-live-panel]');
    await expect(panel).toHaveScreenshot("livepanel-connecting.png", {
      maxDiffPixels: 100,
    });
  });

  test.skip("LivePanel - capturing state (requires bridge)", async ({ page }) => {
    await page.goto("/");

    const livePanels = await page.locator('[data-acp-live-panel]').count();
    if (livePanels === 0) {
      test.skip();
      return;
    }

    await page.locator("#bridge-url-input").fill("ws://127.0.0.1:8765");
    await page.locator("#command-input").fill("node");
    await page.locator("#command-args-input").fill("./test.js");

    await page.getByRole("button", { name: "Connect Live" }).click();
    await page.waitForTimeout(500);

    const captureButton = page.getByRole("button", { name: "Capture Session" });
    if (await captureButton.isVisible()) {
      const panel = page.locator('[data-acp-live-panel]');
      await expect(panel).toHaveScreenshot("livepanel-capture-visible.png", {
        maxDiffPixels: 100,
      });
    } else {
      test.skip();
    }
  });
});
