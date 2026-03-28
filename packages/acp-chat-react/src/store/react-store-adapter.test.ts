import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AcpStore, createAcpStore } from "./acp-store.js";
import { SessionController } from "@acp/chat-core";
import type { SessionControllerState } from "@acp/chat-core";

describe("AcpStore", () => {
  describe("constructor and basic functionality", () => {
    it("creates a store with default config", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);

      expect(store).toBeDefined();
      expect(store.getVersion()).toBe(0);
      store.destroy();
    });

    it("creates a store with custom notification cadence", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = new AcpStore(mockController, { notificationCadenceMs: 32 });
      expect(store).toBeDefined();
      store.destroy();
    });

    it("subscribes to session controller events", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);

      expect(mockController.on).toHaveBeenCalledWith("statusChange", expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith("sessionUpdate", expect.any(Function));
      expect(mockController.on).toHaveBeenCalledWith("error", expect.any(Function));
      store.destroy();
    });
  });

  describe("subscribe and snapshot", () => {
    it("provides subscribe callback for useSyncExternalStore", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);
      const callback = vi.fn();

      const unsubscribe = store.subscribe(callback);
      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
      store.destroy();
    });

    it("provides getSnapshot callback for useSyncExternalStore", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: {},
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);
      const snapshot = store.getSnapshot();

      expect(snapshot.session.connectionStatus).toBe("connected");
      expect(snapshot.session.sessionId).toBe("test-session");
      expect(snapshot.version).toBe(0);
      expect(snapshot.messages).toBeInstanceOf(Map);
      expect(snapshot.thoughts).toBeInstanceOf(Map);
      expect(snapshot.toolCalls).toBeInstanceOf(Map);
      store.destroy();
    });

    it("returns the same snapshot reference if version has not changed (for useSyncExternalStore stability)", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);
      const snapshot1 = store.getSnapshot();
      const snapshot2 = store.getSnapshot();
      const snapshot3 = store.getSnapshot();

      expect(snapshot1).toBe(snapshot2);
      expect(snapshot2).toBe(snapshot3);
      expect(snapshot1).toBe(snapshot3);
      store.destroy();
    });
  });

  describe("SSR server snapshot", () => {
    it("provides SSR-safe server snapshot without window/document access", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);
      const serverSnapshot = store.getServerSnapshot();

      expect(serverSnapshot.session.connectionStatus).toBe("disconnected");
      expect(serverSnapshot.session.sessionId).toBeNull();
      expect(serverSnapshot.messages.size).toBe(0);
      expect(serverSnapshot.thoughts.size).toBe(0);
      expect(serverSnapshot.toolCalls.size).toBe(0);
      expect(serverSnapshot.version).toBe(0);
      store.destroy();
    });

    it("server snapshot is safe to call in Node.js environment", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = createAcpStore(mockController);

      expect(() => store.getServerSnapshot()).not.toThrow();
      store.destroy();
    });
  });

  describe("ACP update processing", () => {
    it("processes sessionUpdate events immediately", () => {
      let statusHandler: ((state: SessionControllerState) => void) | null = null;
      let updateHandler: ((params: unknown) => void) | null = null;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: null,
        })),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "statusChange") statusHandler = handler as typeof statusHandler;
          if (event === "sessionUpdate") updateHandler = handler as typeof updateHandler;
          return () => {};
        }),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);

      expect(updateHandler).not.toBeNull();
      updateHandler!({
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
          status: "in_progress",
        },
      });

      const snapshot = store.getSnapshot();
      expect(snapshot.messages.size).toBe(1);
      expect(snapshot.version).toBe(1);
      store.destroy();
    });

    it("increments version on each ACP update", () => {
      let updateHandler: ((params: unknown) => void) | null = null;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: null,
        })),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "sessionUpdate") updateHandler = handler as typeof updateHandler;
          return () => {};
        }),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);

      expect(store.getVersion()).toBe(0);

      updateHandler!({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });
      expect(store.getVersion()).toBe(1);

      updateHandler!({
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          content: [{ type: "text", text: "Hello" }],
          status: "in_progress",
        },
      });
      expect(store.getVersion()).toBe(2);
      store.destroy();
    });
  });

  describe("notification batching", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("batches multiple updates within cadence window", async () => {
      let updateHandler: ((params: unknown) => void) | null = null;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: null,
        })),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "sessionUpdate") updateHandler = handler as typeof updateHandler;
          return () => {};
        }),
      } as unknown as SessionController;

      const store = new AcpStore(mockController, { notificationCadenceMs: 16 });
      const callback = vi.fn();
      store.subscribe(callback);

      updateHandler!({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });
      updateHandler!({
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          content: [{ type: "text", text: "Hello" }],
          status: "in_progress",
        },
      });

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(16);

      expect(callback).toHaveBeenCalledTimes(1);
      store.destroy();
    });

    it("notifies immediately when batching is disabled", () => {
      let updateHandler: ((params: unknown) => void) | null = null;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: null,
        })),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "sessionUpdate") updateHandler = handler as typeof updateHandler;
          return () => {};
        }),
      } as unknown as SessionController;

      const store = new AcpStore(mockController, { enableBatching: false });
      const callback = vi.fn();
      store.subscribe(callback);

      updateHandler!({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });

      expect(callback).toHaveBeenCalledTimes(1);
      store.destroy();
    });

    it("tracks pending notification state", () => {
      let updateHandler: ((params: unknown) => void) | null = null;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: null,
        })),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "sessionUpdate") updateHandler = handler as typeof updateHandler;
          return () => {};
        }),
      } as unknown as SessionController;

      const store = new AcpStore(mockController, { notificationCadenceMs: 16 });

      expect(store.hasPendingNotification()).toBe(false);

      updateHandler!({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });

      expect(store.hasPendingNotification()).toBe(true);

      vi.advanceTimersByTime(16);

      expect(store.hasPendingNotification()).toBe(false);
      store.destroy();
    });
  });

  describe("convenience methods", () => {
    it("provides getMessages method", () => {
      let updateHandler: ((params: unknown) => void) | null = null;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: null,
        })),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "sessionUpdate") updateHandler = handler as typeof updateHandler;
          return () => {};
        }),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);

      updateHandler!({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });

      const messages = store.getMessages();
      expect(messages.length).toBe(1);
      expect(messages[0]?.content).toBe("Hi");
      store.destroy();
    });

    it("provides getMessageByTurnId method", () => {
      let updateHandler: ((params: unknown) => void) | null = null;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: null,
        })),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "sessionUpdate") updateHandler = handler as typeof updateHandler;
          return () => {};
        }),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);

      updateHandler!({
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          content: [{ type: "text", text: "Hello" }],
          status: "in_progress",
        },
      });

      const message = store.getMessageByTurnId("turn-1");
      expect(message?.content).toBe("Hello");
      store.destroy();
    });

    it("provides getTimeline method", () => {
      let updateHandler: ((params: unknown) => void) | null = null;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "connected",
          bridgeStatus: "ready",
          sessionId: "test-session",
          initialized: true,
          capabilities: null,
        })),
        on: vi.fn((event: string, handler: unknown) => {
          if (event === "sessionUpdate") updateHandler = handler as typeof updateHandler;
          return () => {};
        }),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);

      updateHandler!({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });

      const timeline = store.getTimeline();
      expect(timeline.length).toBe(1);
      expect(timeline[0]?.type).toBe("message");
      store.destroy();
    });
  });

  describe("cleanup", () => {
    it("unsubscribes from controller on destroy", () => {
      const unsubscribers = [vi.fn(), vi.fn(), vi.fn()];
      let unsubIndex = 0;

      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => unsubscribers[unsubIndex++]),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);
      store.destroy();

      for (const unsub of unsubscribers) {
        expect(unsub).toHaveBeenCalled();
      }
    });

    it("clears subscribers on destroy", () => {
      const mockController = {
        getState: vi.fn(() => ({
          connectionStatus: "disconnected",
          bridgeStatus: "disconnected",
          sessionId: null,
          initialized: false,
          capabilities: null,
        })),
        on: vi.fn(() => () => {}),
      } as unknown as SessionController;

      const store = new AcpStore(mockController);
      const callback = vi.fn();
      store.subscribe(callback);
      store.destroy();

      store.destroy();
    });
  });
});

describe("createAcpStore factory", () => {
  it("creates AcpStore instance", () => {
    const mockController = {
      getState: vi.fn(() => ({
        connectionStatus: "disconnected",
        bridgeStatus: "disconnected",
        sessionId: null,
        initialized: false,
        capabilities: null,
      })),
      on: vi.fn(() => () => {}),
    } as unknown as SessionController;

    const store = createAcpStore(mockController);
    expect(store).toBeInstanceOf(AcpStore);
    store.destroy();
  });
});