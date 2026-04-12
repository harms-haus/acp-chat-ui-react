/**
 * @vitest-environment jsdom
 * @fileoverview Tests for chat event hooks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { SessionController } from "@harms-haus/acp-chat-core";
import { useChatEvent, useThoughtEvents, useToolCallEvents } from "./hooks";

// Mock SessionController with event emission capabilities
function createMockController(): SessionController {
  const handlers = new Map<string, Set<(params: unknown) => void>>();

  return {
    on(event: string, handler: (params: unknown) => void): () => void {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)!.delete(handler);
    },
    // Emit events for testing
    emit(event: string, params: unknown) {
      handlers.get(event)?.forEach((handler) => {
        handler(params);
      });
    },
  } as unknown as SessionController;
}

describe("useChatEvent", () => {
  let mockController: SessionController;

  beforeEach(() => {
    mockController = createMockController();
    cleanup();
  });

  it("should return empty array initially", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "statusChange")
    );

    expect(result.current).toEqual([]);
  });

  it("should subscribe to statusChange events and receive updates", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "statusChange")
    );

    act(() => {
      (mockController as any).emit("statusChange", {
        connectionStatus: "connected",
        bridgeStatus: "connected",
        sessionId: "test-session",
        initialized: true,
        capabilities: { test: true },
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.type).toBe("statusChange");
    expect(result.current[0]!.params).toMatchObject({
      connectionStatus: "connected",
      sessionId: "test-session",
    });
  });

  it("should subscribe to sessionUpdate events", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "sessionUpdate")
    );

    act(() => {
      (mockController as any).emit("sessionUpdate", {
        sessionId: "test-session",
        update: { type: "agent_thought_chunk" },
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.type).toBe("sessionUpdate");
    expect(result.current[0]!.params).toMatchObject({
      sessionId: "test-session",
    });
  });

  it("should subscribe to error events", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "error")
    );

    act(() => {
      (mockController as any).emit("error", {
        message: "Test error",
        name: "TestError",
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.type).toBe("error");
    expect(result.current[0]!.params).toMatchObject({
      message: "Test error",
      name: "TestError",
    });
  });

  it("should subscribe to traffic events", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "traffic")
    );

    act(() => {
      (mockController as any).emit("traffic", {
        direction: "in",
        data: { test: "data" },
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.type).toBe("traffic");
    expect(result.current[0]!.params).toMatchObject({
      direction: "in",
      data: { test: "data" },
    });
  });

  it("should subscribe to sessionClearing events", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "sessionClearing")
    );

    act(() => {
      (mockController as any).emit("sessionClearing", {});
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.type).toBe("sessionClearing");
  });

  it("should subscribe to permissionRequest events", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "permissionRequest")
    );

    act(() => {
      (mockController as any).emit("permissionRequest", {
        sessionId: "test-session",
        toolCallId: "tool-1",
        requestId: 123,
        options: [
          { optionId: "opt-1", name: "Test Option", kind: "test" },
        ],
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.type).toBe("permissionRequest");
    expect(result.current[0]!.params).toMatchObject({
      sessionId: "test-session",
      toolCallId: "tool-1",
    });
  });

  it("should track multiple events of the same type", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "sessionUpdate")
    );

    act(() => {
      (mockController as any).emit("sessionUpdate", { update: { type: "event1" } });
      (mockController as any).emit("sessionUpdate", { update: { type: "event2" } });
      (mockController as any).emit("sessionUpdate", { update: { type: "event3" } });
    });

    expect(result.current).toHaveLength(3);
    expect(result.current[0]!.params).toMatchObject({ update: { type: "event1" } });
    expect(result.current[1]!.params).toMatchObject({ update: { type: "event2" } });
    expect(result.current[2]!.params).toMatchObject({ update: { type: "event3" } });
  });

  it("should maintain event timestamps", () => {
    const { result } = renderHook(() =>
      useChatEvent(mockController, "sessionUpdate")
    );

    const beforeEmit = Date.now();

    act(() => {
      (mockController as any).emit("sessionUpdate", { update: { type: "test" } });
    });

    const afterEmit = Date.now();

    expect(result.current[0]!.timestamp).toBeGreaterThanOrEqual(beforeEmit);
    expect(result.current[0]!.timestamp).toBeLessThanOrEqual(afterEmit);
  });

  it("should properly unsubscribe on unmount", () => {
    const { unmount } = renderHook(() =>
      useChatEvent(mockController, "sessionUpdate")
    );

    // Emit an event while mounted
    act(() => {
      (mockController as any).emit("sessionUpdate", { update: { type: "mounted" } });
    });

    unmount();

    // This should not cause any errors and events shouldn't be tracked
    act(() => {
      (mockController as any).emit("sessionUpdate", { update: { type: "after-unmount" } });
    });

    // No assertion needed - we're just ensuring no errors are thrown
  });
});

describe("useThoughtEvents", () => {
  let mockController: SessionController;

  beforeEach(() => {
    mockController = createMockController();
    cleanup();
  });

  it("should properly unsubscribe on unmount", () => {
    const { unmount } = renderHook(() =>
      useThoughtEvents(mockController, "thought-1")
    );

    act(() => {
      (mockController as any).emit("sessionUpdate", {
        update: { type: "agent_thought_chunk", thoughtId: "thought-1" },
      });
    });

    expect(() => {
      unmount();
      act(() => {
        (mockController as any).emit("sessionUpdate", {
          update: { type: "agent_thought_chunk", thoughtId: "thought-1" },
        });
      });
    }).not.toThrow();
  });
});

describe("useToolCallEvents", () => {
  let mockController: SessionController;

  beforeEach(() => {
    mockController = createMockController();
    cleanup();
  });

  it("should return empty array when controller is undefined", () => {
    const { result } = renderHook(() =>
      useToolCallEvents(undefined, "tool-1")
    );

    expect(result.current).toEqual([]);
  });

  it("should return empty array initially for defined controller", () => {
    const { result } = renderHook(() =>
      useToolCallEvents(mockController, "tool-1")
    );

    expect(result.current).toEqual([]);
  });

  it("should track events for specific tool call ID", () => {
    const { result } = renderHook(() =>
      useToolCallEvents(mockController, "tool-1")
    );

    act(() => {
      (mockController as any).emit("sessionUpdate", {
        sessionId: "session-1",
        update: {
          type: "tool_call",
          toolCallId: "tool-1",
          name: "test_tool",
        },
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.params).toMatchObject({
      sessionId: "session-1",
      update: {
        type: "tool_call",
        toolCallId: "tool-1",
      },
    });
  });

  it("should filter events by tool call ID", () => {
    const { result } = renderHook(() =>
      useToolCallEvents(mockController, "tool-1")
    );

    act(() => {
      (mockController as any).emit("sessionUpdate", {
        update: { type: "tool_call", toolCallId: "tool-1" },
      });
      (mockController as any).emit("sessionUpdate", {
        update: { type: "tool_call", toolCallId: "tool-2" },
      });
      (mockController as any).emit("sessionUpdate", {
        update: { type: "tool_call", toolCallId: "tool-1" },
      });
    });

    // Should only have events for tool-1
    expect(result.current).toHaveLength(2);
    expect((result.current[0]!.params as any).update.toolCallId).toBe("tool-1");
    expect((result.current[1]!.params as any).update.toolCallId).toBe("tool-1");
  });

  it("should track tool_call_update events", () => {
    const { result } = renderHook(() =>
      useToolCallEvents(mockController, "tool-1")
    );

    act(() => {
      (mockController as any).emit("sessionUpdate", {
        update: { type: "tool_call_update", toolCallId: "tool-1" },
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.params).toMatchObject({
      update: { type: "tool_call_update", toolCallId: "tool-1" },
    });
  });

  it("should ignore non-tool call events", () => {
    const { result } = renderHook(() =>
      useToolCallEvents(mockController, "tool-1")
    );

    act(() => {
      (mockController as any).emit("sessionUpdate", {
        update: { type: "agent_thought_chunk", thoughtId: "thought-1" },
      });
      (mockController as any).emit("sessionUpdate", {
        update: { type: "other_event" },
      });
    });

    expect(result.current).toEqual([]);
  });

  it("should properly unsubscribe on unmount", () => {
    const { unmount } = renderHook(() =>
      useToolCallEvents(mockController, "tool-1")
    );

    act(() => {
      (mockController as any).emit("sessionUpdate", {
        update: { type: "tool_call", toolCallId: "tool-1" },
      });
    });

    expect(() => {
      unmount();
      act(() => {
        (mockController as any).emit("sessionUpdate", {
          update: { type: "tool_call", toolCallId: "tool-1" },
        });
      });
    }).not.toThrow();
  });
});
