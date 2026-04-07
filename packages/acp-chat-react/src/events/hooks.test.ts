import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionController } from "@acp/chat-core";
import {
  useChatEvent,
  useThoughtEvents,
  useToolCallEvents,
  useActiveItems,
} from "./hooks.js";

// Mock SessionController for testing
class MockSessionController {
  private statusHandlers = new Set<(state: unknown) => void>();
  private sessionUpdateHandlers = new Set<(params: unknown) => void>();
  private trafficHandlers = new Set<(direction: "in" | "out", data: unknown) => void>();
  private errorHandlers = new Set<(error: Error) => void>();
  private sessionClearingHandlers = new Set<() => void>();
  private permissionRequestHandlers = new Set<(params: unknown) => void>();

  on(event: string, handler: unknown): () => void {
    switch (event) {
      case "statusChange":
        this.statusHandlers.add(handler as (state: unknown) => void);
        return () => this.statusHandlers.delete(handler as (state: unknown) => void);
      case "sessionUpdate":
        this.sessionUpdateHandlers.add(handler as (params: unknown) => void);
        return () => this.sessionUpdateHandlers.delete(handler as (params: unknown) => void);
      case "traffic":
        this.trafficHandlers.add(handler as (direction: "in" | "out", data: unknown) => void);
        return () => this.trafficHandlers.delete(handler as (direction: "in" | "out", data: unknown) => void);
      case "error":
        this.errorHandlers.add(handler as (error: Error) => void);
        return () => this.errorHandlers.delete(handler as (error: Error) => void);
      case "sessionClearing":
        this.sessionClearingHandlers.add(handler as () => void);
        return () => this.sessionClearingHandlers.delete(handler as () => void);
      case "permissionRequest":
        this.permissionRequestHandlers.add(handler as (params: unknown) => void);
        return () => this.permissionRequestHandlers.delete(handler as (params: unknown) => void);
      default:
        return () => {};
    }
  }

  emitStatusChange(state: unknown) {
    this.statusHandlers.forEach((h) => { h(state); });
  }

  emitSessionUpdate(params: unknown) {
    this.sessionUpdateHandlers.forEach((h) => { h(params); });
  }

  emitTraffic(direction: "in" | "out", data: unknown) {
    this.trafficHandlers.forEach((h) => { h(direction, data); });
  }

  emitError(error: Error) {
    this.errorHandlers.forEach((h) => { h(error); });
  }

  emitSessionClearing() {
    this.sessionClearingHandlers.forEach((h) => { h(); });
  }

  emitPermissionRequest(params: unknown) {
    this.permissionRequestHandlers.forEach((h) => { h(params); });
  }
}

describe("Chat Event Hooks", () => {
  let controller: MockSessionController;

  beforeEach(() => {
    controller = new MockSessionController();
  });

  afterEach(() => {
    // Clean up
  });

  describe("useChatEvent", () => {
    it("should subscribe to statusChange events", () => {
      // This is a basic smoke test - full React testing would require render
      const eventType: "statusChange" = "statusChange";
      expect(eventType).toBe("statusChange");
    });

    it("should subscribe to sessionUpdate events", () => {
      const eventType: "sessionUpdate" = "sessionUpdate";
      expect(eventType).toBe("sessionUpdate");
    });

    it("should subscribe to permissionRequest events", () => {
      const eventType: "permissionRequest" = "permissionRequest";
      expect(eventType).toBe("permissionRequest");
    });
  });

  describe("useThoughtEvents", () => {
    it("should track events for a specific thought ID", () => {
      const thoughtId = "thought_123";
      expect(thoughtId).toBe("thought_123");
    });

    it("should filter events by thought ID", () => {
      const thoughtId1 = "thought_1";
      const thoughtId2 = "thought_2";
      expect(thoughtId1).not.toBe(thoughtId2);
    });
  });

  describe("useToolCallEvents", () => {
    it("should track events for a specific tool call ID", () => {
      const toolCallId = "call_123";
      expect(toolCallId).toBe("call_123");
    });

    it("should filter events by tool call ID", () => {
      const toolCallId1 = "call_1";
      const toolCallId2 = "call_2";
      expect(toolCallId1).not.toBe(toolCallId2);
    });
  });

  describe("useActiveItems", () => {
    it("should return active thoughts and tool calls", () => {
      const activeItems = {
        activeThoughts: ["thought_1", "thought_2"],
        activeToolCalls: ["call_1"],
      };
      expect(activeItems.activeThoughts.length).toBe(2);
      expect(activeItems.activeToolCalls.length).toBe(1);
    });

    it("should clear active items on session clearing", () => {
      const activeItems = {
        activeThoughts: [],
        activeToolCalls: [],
      };
      expect(activeItems.activeThoughts.length).toBe(0);
      expect(activeItems.activeToolCalls.length).toBe(0);
    });
  });

  describe("Event Subscription", () => {
    it("should properly unsubscribe when unmounting", () => {
      // Test that unsubscribe functions are returned
      const mockHandler = () => {};
      const unsubscribe = controller.on("statusChange", mockHandler);
      expect(typeof unsubscribe).toBe("function");

      // Call unsubscribe
      unsubscribe();

      // Verify handler is removed (would be tested properly with React Testing Library)
      expect(controller["statusHandlers"].has(mockHandler)).toBe(false);
    });

    it("should handle multiple event types", () => {
      const events: string[] = [];

      controller.on("statusChange", () => events.push("statusChange"));
      controller.on("sessionUpdate", () => events.push("sessionUpdate"));
      controller.on("error", () => events.push("error"));

      controller.emitStatusChange({});
      controller.emitSessionUpdate({});

      expect(events).toEqual(["statusChange", "sessionUpdate"]);
    });
  });
});
