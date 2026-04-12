import { describe, it, expect } from "vitest";

describe("SSR-safe entry points", () => {
  it("imports main index without browser APIs", async () => {
    const mod = await import("./index.js");
    
    expect(mod.AcpStore).toBeDefined();
    expect(mod.createAcpStore).toBeDefined();
    expect(mod.useMessages).toBeDefined();
    expect(mod.useSessionState).toBeDefined();
    expect(mod.PACKAGE_VERSION).toBeDefined();
  });

  it("AcpStore.getServerSnapshot returns empty state without window", async () => {
    const { AcpStore } = await import("./index.js");
    
    const mockController = {
      getState: () => ({
        connectionStatus: "disconnected",
        bridgeStatus: "disconnected",
        sessionId: null,
        initialized: false,
        capabilities: null,
      }),
      on: () => () => {},
    } as unknown as ConstructorParameters<typeof AcpStore>[0];
    
    const store = new AcpStore(mockController);
    
    const snapshot = store.getServerSnapshot();
    
    expect(snapshot).toBeDefined();
    expect(snapshot.messages).toBeInstanceOf(Map);
    expect(snapshot.messages.size).toBe(0);
    expect(snapshot.session.connectionStatus).toBe("disconnected");
    expect(snapshot.version).toBe(0);
    
    store.destroy();
  });

  it("exports all expected hooks for SSR hydration", async () => {
    const mod = await import("./index.js");
    
    const expectedHooks = [
      "useMessages",
      "useMessage",
      "useMessageByTurnId",
      "useThoughts",
      "useToolCalls",
      "useToolCall",
      "useTimeline",
      "useSessionState",
      "useIsConnected",
      "useIsInitialized",
      "useSessionId",
      "useStoreVersion",
      "useSnapshotSelector",
      "useTimelineItems",
      "useMessagesCount",
      "useThoughtsCount",
      "useToolCallsCount",
      "useActiveStreamingMessage",
    ];
    
    for (const hook of expectedHooks) {
      expect(mod[hook as keyof typeof mod]).toBeDefined();
      expect(typeof mod[hook as keyof typeof mod]).toBe("function");
    }
  });

  it("store types are exported correctly", async () => {
    const mod = await import("./index.js");
    
    expect(mod.AcpStore).toBeDefined();
    expect(mod.createAcpStore).toBeDefined();
  });
});

describe("Browser-only entry point guards", () => {
  it("browser entry point exists and exports connection utilities", async () => {
    const mod = await import("./index.browser.js");
    
    expect(mod.createBrowserAcpStore).toBeDefined();
    expect(mod.useAcpConnection).toBeDefined();
    expect(mod.isBrowserEnvironment).toBeDefined();
    expect(mod.isServerEnvironment).toBeDefined();
  });

  it("isBrowserEnvironment detects jsdom test environment", async () => {
    const { isBrowserEnvironment, isServerEnvironment } = await import("./index.browser.js");
    
    // In jsdom test environment, browser detection returns true
    // This is expected - we're testing in a simulated browser
    expect(isBrowserEnvironment()).toBe(true);
    expect(isServerEnvironment()).toBe(false);
  });

  it("SessionController is re-exported from browser entry", async () => {
    const mod = await import("./index.browser.js");
    
    expect(mod.SessionController).toBeDefined();
  });
});