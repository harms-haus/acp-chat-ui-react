# Hook Testing Patterns

This guide covers testing patterns for React hooks in the ACP Chat React package. It includes patterns for testing data hooks, event hooks, and session state hooks using `renderHook`, mock stores, and mock controllers.

## Table of Contents

- [Setup](#setup)
- [Testing Data Hooks](#testing-data-hooks)
- [Testing Event Hooks](#testing-event-hooks)
- [Testing Session State Hooks](#testing-session-state-hooks)
- [Mock Utilities](#mock-utilities)
- [Common Patterns](#common-patterns)

---

## Setup

### Required Imports

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { AcpStore, createAcpStore } from "../store/index.js";
import { SessionController } from "@harms-haus/acp-chat-core";
```

### Test Utilities

Import test utilities from the package:

```tsx
import { mockStore, mockChatCore, createMockAcpStore } from "@/test-utils";
import { createMockMessage, createMockThought, createMockToolCall } from "@/test-utils";
```

### Cleanup Between Tests

Always clean up after hook tests to prevent state leakage:

```tsx
describe("useMessages", () => {
  let store: AcpStore;
  let controller: SessionController;

  beforeEach(() => {
    const { store: mockStoreInstance, controller: mockController } = mockStore();
    store = mockStoreInstance;
    controller = mockController;
    cleanup();
  });

  // Your tests...
});
```

---

## Testing Data Hooks

Data hooks read from the ACP store using `useSyncExternalStore`. They return normalized data like messages, thoughts, and tool calls.

### Available Data Hooks

- `useMessages(store)` - Returns all messages
- `useMessage(store, id)` - Returns a single message by ID
- `useMessageByTurnId(store, turnId)` - Returns a message by turn ID
- `useThoughts(store)` - Returns all thoughts
- `useToolCalls(store)` - Returns all tool calls
- `useToolCall(store, toolCallId)` - Returns a single tool call
- `useTimeline(store)` - Returns timeline order
- `useTimelineItems(store)` - Returns unified timeline items
- `usePermissionRequests(store)` - Returns all permission requests

### Pattern: Testing Initial State

Test that hooks return empty or initial state before any data is loaded:

```tsx
import { useMessages } from "../hooks/use-acp-store.js";

describe("useMessages", () => {
  it("should return empty array initially", () => {
    const { store } = mockStore();
    const { result } = renderHook(() => useMessages(store));

    expect(result.current).toEqual([]);
  });
});
```

### Pattern: Testing with Pre-populated Data

Create a store with pre-populated data by emitting session updates before rendering the hook:

```tsx
import { useMessages } from "../hooks/use-acp-store.js";
import { createMockMessage } from "@/test-utils";

describe("useMessages", () => {
  it("should return messages after session update", () => {
    const { store, controller } = mockStore();

    // Emit a session update to add a message
    act(() => {
      controller.emitSessionUpdate({
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
          status: "in_progress",
        },
      });
    });

    const { result } = renderHook(() => useMessages(store));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.content).toBe("Hello");
  });
});
```

### Pattern: Testing Single Item Selection

Test hooks that return single items by ID:

```tsx
import { useMessage } from "../hooks/use-acp-store.js";

describe("useMessage", () => {
  it("should return undefined for non-existent message", () => {
    const { store } = mockStore();
    const { result } = renderHook(() => useMessage(store, "non-existent"));

    expect(result.current).toBeUndefined();
  });

  it("should return message by ID", () => {
    const { store, controller } = mockStore();

    act(() => {
      controller.emitSessionUpdate({
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          content: [{ type: "text", text: "Test" }],
          status: "completed",
        },
      });
    });

    const snapshot = store.getSnapshot();
    const messageId = Array.from(snapshot.messages.keys())[0];

    const { result } = renderHook(() => useMessage(store, messageId!));

    expect(result.current).toBeDefined();
    expect(result.current?.content).toBe("Test");
  });
});
```

### Pattern: Testing Derived Data

Test hooks that compute derived state like counts or filtered lists:

```tsx
import { useMessagesCount, usePendingPermissionRequests } from "../hooks/use-acp-store.js";
import { createMockPermissionRequest } from "@/test-utils";

describe("useMessagesCount", () => {
  it("should return 0 initially", () => {
    const { store } = mockStore();
    const { result } = renderHook(() => useMessagesCount(store));

    expect(result.current).toBe(0);
  });

  it("should return count after messages are added", () => {
    const { store, controller } = mockStore();

    act(() => {
      controller.emitSessionUpdate({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });
      controller.emitSessionUpdate({
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          content: [{ type: "text", text: "Hello" }],
          status: "completed",
        },
      });
    });

    const { result } = renderHook(() => useMessagesCount(store));

    expect(result.current).toBe(2);
  });
});

describe("usePendingPermissionRequests", () => {
  it("should only return pending requests", () => {
    const { store, controller } = mockStore();

    // Add permission requests via emitSessionUpdate
    act(() => {
      controller.emitSessionUpdate({
        update: {
          type: "permission_request",
          requestId: 1,
          sessionId: "session-1",
          toolCallId: "tool-1",
          options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
          status: "pending",
        },
      });
      controller.emitSessionUpdate({
        update: {
          type: "permission_request",
          requestId: 2,
          sessionId: "session-1",
          toolCallId: "tool-2",
          options: [{ optionId: "deny", name: "Deny", kind: "deny" }],
          status: "denied",
        },
      });
    });

    const { result } = renderHook(() => usePendingPermissionRequests(store));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.requestId).toBe(1);
    expect(result.current[0]?.status).toBe("pending");
  });
});
```

---

## Testing Event Hooks

Event hooks subscribe to SessionController events and return arrays of emitted events. They use `useSyncExternalStore` with custom subscription managers.

### Available Event Hooks

- `useChatEvent(controller, eventType)` - Subscribe to any event type
- `useThoughtEvents(controller, thoughtId)` - Subscribe to thought-specific events
- `useToolCallEvents(controller, toolCallId)` - Subscribe to tool call-specific events

### Pattern: Testing Event Subscription

Verify that hooks subscribe to the correct event types:

```tsx
import { useChatEvent } from "../events/hooks.js";

describe("useChatEvent", () => {
  it("should return empty array initially", () => {
    const controller = mockChatCore();
    const { result } = renderHook(() => useChatEvent(controller, "statusChange"));

    expect(result.current).toEqual([]);
  });

  it("should subscribe to statusChange events and receive updates", () => {
    const controller = mockChatCore();
    const { result } = renderHook(() => useChatEvent(controller, "statusChange"));

    act(() => {
      (controller as any).emit("statusChange", {
        connectionStatus: "connected",
        bridgeStatus: "connected",
        sessionId: "test-session",
        initialized: true,
        capabilities: { test: true },
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].type).toBe("statusChange");
    expect(result.current[0].params).toMatchObject({
      connectionStatus: "connected",
      sessionId: "test-session",
    });
  });
});
```

### Pattern: Testing Event Filtering

Test that event hooks correctly filter events by ID:

```tsx
import { useToolCallEvents } from "../events/hooks.js";

describe("useToolCallEvents", () => {
  it("should filter events by tool call ID", () => {
    const controller = mockChatCore();
    const { result } = renderHook(() => useToolCallEvents(controller, "tool-1"));

    act(() => {
      (controller as any).emit("sessionUpdate", {
        update: { type: "tool_call", toolCallId: "tool-1" },
      });
      (controller as any).emit("sessionUpdate", {
        update: { type: "tool_call", toolCallId: "tool-2" },
      });
      (controller as any).emit("sessionUpdate", {
        update: { type: "tool_call", toolCallId: "tool-1" },
      });
    });

    // Should only have events for tool-1
    expect(result.current).toHaveLength(2);
    expect(result.current[0].params.update.toolCallId).toBe("tool-1");
    expect(result.current[1].params.update.toolCallId).toBe("tool-1");
  });

  it("should ignore non-tool call events", () => {
    const controller = mockChatCore();
    const { result } = renderHook(() => useToolCallEvents(controller, "tool-1"));

    act(() => {
      (controller as any).emit("sessionUpdate", {
        update: { type: "agent_thought_chunk", thoughtId: "thought-1" },
      });
      (controller as any).emit("sessionUpdate", {
        update: { type: "other_event" },
      });
    });

    expect(result.current).toEqual([]);
  });
});
```

### Pattern: Testing Thought Events

Test thought-specific event filtering:

```tsx
import { useThoughtEvents } from "../events/hooks.js";

describe("useThoughtEvents", () => {
  it("should track events for specific thought ID", () => {
    const controller = mockChatCore();
    const { result } = renderHook(() => useThoughtEvents(controller, "thought-1"));

    act(() => {
      (controller as any).emit("sessionUpdate", {
        update: { type: "agent_thought_chunk", thoughtId: "thought-1" },
      });
      (controller as any).emit("sessionUpdate", {
        update: { type: "agent_thought_chunk", thoughtId: "thought-2" },
      });
    });

    // Should only have events for thought-1
    expect(result.current).toHaveLength(1);
    expect(result.current[0].params.update.thoughtId).toBe("thought-1");
  });
});
```

### Pattern: Testing Unsubscribe on Unmount

Verify proper cleanup when hooks unmount:

```tsx
describe("useChatEvent", () => {
  it("should properly unsubscribe on unmount", () => {
    const controller = mockChatCore();
    const { unmount } = renderHook(() =>
      useChatEvent(controller, "sessionUpdate")
    );

    // Emit an event while mounted
    act(() => {
      (controller as any).emit("sessionUpdate", { update: { type: "mounted" } });
    });

    unmount();

    // This should not cause any errors
    expect(() => {
      act(() => {
        (controller as any).emit("sessionUpdate", { update: { type: "after-unmount" } });
      });
    }).not.toThrow();
  });
});
```

### Pattern: Testing Multiple Events

Test that hooks track multiple events of the same type:

```tsx
describe("useChatEvent", () => {
  it("should track multiple events of the same type", () => {
    const controller = mockChatCore();
    const { result } = renderHook(() =>
      useChatEvent(controller, "sessionUpdate")
    );

    act(() => {
      (controller as any).emit("sessionUpdate", { update: { type: "event1" } });
      (controller as any).emit("sessionUpdate", { update: { type: "event2" } });
      (controller as any).emit("sessionUpdate", { update: { type: "event3" } });
    });

    expect(result.current).toHaveLength(3);
    expect(result.current[0].params).toMatchObject({ update: { type: "event1" } });
    expect(result.current[1].params).toMatchObject({ update: { type: "event2" } });
    expect(result.current[2].params).toMatchObject({ update: { type: "event3" } });
  });

  it("should maintain event timestamps", () => {
    const controller = mockChatCore();
    const { result } = renderHook(() =>
      useChatEvent(controller, "sessionUpdate")
    );

    const beforeEmit = Date.now();

    act(() => {
      (controller as any).emit("sessionUpdate", { update: { type: "test" } });
    });

    const afterEmit = Date.now();

    expect(result.current[0].timestamp).toBeGreaterThanOrEqual(beforeEmit);
    expect(result.current[0].timestamp).toBeLessThanOrEqual(afterEmit);
  });
});
```

---

## Testing Session State Hooks

Session state hooks return information about the connection status, session ID, and initialization state.

### Available Session State Hooks

- `useSessionState(store)` - Returns full session state
- `useIsConnected(store)` - Returns connection status
- `useIsInitialized(store)` - Returns initialization status
- `useSessionId(store)` - Returns session ID
- `useStoreVersion(store)` - Returns store version number

### Pattern: Testing Connection Status

```tsx
import { useIsConnected, useSessionState } from "../hooks/use-acp-store.js";

describe("useIsConnected", () => {
  it("should return false when disconnected", () => {
    const { store } = mockStore({
      sessionState: { connectionStatus: "disconnected", bridgeStatus: "disconnected" },
    });
    const { result } = renderHook(() => useIsConnected(store));

    expect(result.current).toBe(false);
  });

  it("should return true when connected", () => {
    const { store, controller } = mockStore();

    act(() => {
      controller.connect();
    });

    const { result } = renderHook(() => useIsConnected(store));

    expect(result.current).toBe(true);
  });

  it("should update when connection status changes", () => {
    const { store, controller } = mockStore();

    const { result } = renderHook(() => useIsConnected(store));

    // Initially disconnected
    expect(result.current).toBe(false);

    // Connect
    act(() => {
      controller.connect();
    });

    expect(result.current).toBe(true);

    // Disconnect
    act(() => {
      controller.disconnect();
    });

    expect(result.current).toBe(false);
  });
});
```

### Pattern: Testing Initialization State

```tsx
import { useIsInitialized } from "../hooks/use-acp-store.js";

describe("useIsInitialized", () => {
  it("should return false when not initialized", () => {
    const { store } = mockStore();
    const { result } = renderHook(() => useIsInitialized(store));

    expect(result.current).toBe(false);
  });

  it("should return true when initialized", () => {
    const { store } = mockStore({
      sessionState: { initialized: true, sessionId: "test-123" },
    });
    const { result } = renderHook(() => useIsInitialized(store));

    expect(result.current).toBe(true);
  });
});
```

### Pattern: Testing Session ID

```tsx
import { useSessionId } from "../hooks/use-acp-store.js";

describe("useSessionId", () => {
  it("should return null when no session", () => {
    const { store } = mockStore();
    const { result } = renderHook(() => useSessionId(store));

    expect(result.current).toBeNull();
  });

  it("should return session ID when connected", () => {
    const { store } = mockStore({
      sessionState: { sessionId: "session-abc-123" },
    });
    const { result } = renderHook(() => useSessionId(store));

    expect(result.current).toBe("session-abc-123");
  });
});
```

### Pattern: Testing Store Version

```tsx
import { useStoreVersion } from "../hooks/use-acp-store.js";

describe("useStoreVersion", () => {
  it("should return 0 initially", () => {
    const { store } = mockStore();
    const { result } = renderHook(() => useStoreVersion(store));

    expect(result.current).toBe(0);
  });

  it("should increment on each update", () => {
    const { store, controller } = mockStore();
    const { result } = renderHook(() => useStoreVersion(store));

    expect(result.current).toBe(0);

    act(() => {
      controller.emitSessionUpdate({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });
    });

    expect(result.current).toBe(1);

    act(() => {
      controller.emitSessionUpdate({
        update: { type: "agent_message_chunk", turnId: "turn-1", content: [{ type: "text", text: "Hello" }] },
      });
    });

    expect(result.current).toBe(2);
  });
});
```

---

## Mock Utilities

### MockStore

The `mockStore` utility creates a store with a mock controller:

```tsx
import { mockStore } from "@/test-utils";

// Basic usage
const { store, controller } = mockStore();

// With initial session state
const { store, controller } = mockStore({
  sessionState: {
    connectionStatus: "connected",
    bridgeStatus: "ready",
    sessionId: "test-session",
    initialized: true,
  },
});

// With store configuration
const { store, controller } = mockStore({
  storeConfig: {
    notificationCadenceMs: 0, // Disable batching for tests
    enableBatching: false,
  },
});
```

### MockChatCore

The `mockChatCore` utility creates only a mock controller:

```tsx
import { mockChatCore } from "@/test-utils";

// Basic usage
const controller = mockChatCore();

// With initial state
const controller = mockChatCore({
  connectionStatus: "connected",
  initialized: true,
  sessionId: "test-123",
});
```

### CreateMockAcpStore

Alias for `mockStore` with clearer intent:

```tsx
import { createMockAcpStore } from "@/test-utils";

const { store, controller } = createMockAcpStore({
  sessionState: { initialized: true },
});
```

### Mock Controller Methods

The mock controller provides methods to emit events:

```tsx
import { mockChatCore } from "@/test-utils";

const controller = mockChatCore();

// Emit status changes
controller.connect(); // Sets status to connected
controller.disconnect(); // Sets status to disconnected
controller.emitStatus(); // Manually trigger status event

// Emit session updates
controller.emitSessionUpdate({
  update: {
    type: "agent_message_chunk",
    turnId: "turn-1",
    content: [{ type: "text", text: "Hello" }],
  },
});

// Emit errors
controller.emitError(new Error("Test error"));

// Emit session clearing
controller.emitSessionClearing();

// Emit permission requests
controller.emitPermissionRequest({
  sessionId: "session-1",
  toolCall: { toolCallId: "tool-1" },
  options: [
    { optionId: "allow", name: "Allow", kind: "allow_once" },
    { optionId: "deny", name: "Deny", kind: "deny" },
  ],
});
```

### Data Factories

Use factory functions to create realistic test data:

```tsx
import {
  createMockMessage,
  createMockThought,
  createMockToolCall,
  createMockPermissionRequest,
} from "@/test-utils";

// Create a mock message
const message = createMockMessage({
  role: "user",
  content: "Hello, world!",
  status: "completed",
});

// Create a mock thought
const thought = createMockThought({
  content: "Thinking about the solution...",
  status: "completed",
});

// Create a mock tool call
const toolCall = createMockToolCall({
  kind: "search",
  title: "Search test",
  status: "completed",
  rawInput: { query: "test" },
});

// Create a mock permission request
const permissionRequest = createMockPermissionRequest({
  sessionId: "session-123",
  toolCallId: "tool-123",
  status: "pending",
  options: [
    { optionId: "approve", name: "Approve", kind: "allow_once" },
    { optionId: "deny", name: "Deny", kind: "deny" },
  ],
});
```

---

## Common Patterns

### Pattern: Testing with act()

Wrap state-changing operations in `act()` to ensure React processes updates:

```tsx
import { act } from "@testing-library/react";

it("should update after state change", () => {
  const { store, controller } = mockStore();
  const { result } = renderHook(() => useMessages(store));

  act(() => {
    controller.emitSessionUpdate({
      update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
    });
  });

  expect(result.current).toHaveLength(1);
});
```

### Pattern: Testing Custom Hooks with Dependencies

Test hooks that depend on multiple stores or controllers:

```tsx
import { usePermissionResponse } from "../hooks/use-permission-response.js";

describe("usePermissionResponse", () => {
  it("should provide respond and cancel callbacks", () => {
    const { store } = mockStore();
    const controller = mockChatCore();
    const { result } = renderHook(() => usePermissionResponse(store, controller));

    expect(result.current.respond).toBeDefined();
    expect(result.current.cancel).toBeDefined();
    expect(typeof result.current.respond).toBe("function");
    expect(typeof result.current.cancel).toBe("function");
  });

  it("should respond to permission request", () => {
    const { store } = mockStore();
    const controller = mockChatCore();
    const { result } = renderHook(() => usePermissionResponse(store, controller));

    act(() => {
      result.current.respond(123, "allow_once");
    });

    // Verify store and controller were called
    // (This would require spying on the methods)
  });

  it("should cancel permission request", () => {
    const { store } = mockStore();
    const controller = mockChatCore();
    const { result } = renderHook(() => usePermissionResponse(store, controller));

    act(() => {
      result.current.cancel(123);
    });

    // Verify controller.cancelPermission was called
  });
});
```

### Pattern: Testing Selector Hooks

Test hooks that use custom selectors:

```tsx
import { useSnapshotSelector } from "../hooks/use-acp-store.js";

describe("useSnapshotSelector", () => {
  it("should return selected data from snapshot", () => {
    const { store, controller } = mockStore();

    // Add some messages
    act(() => {
      controller.emitSessionUpdate({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "Hi" }] },
      });
      controller.emitSessionUpdate({
        update: { type: "user_message", turnId: "turn-1", content: [{ type: "text", text: "Hello" }] },
      });
    });

    // Selector to get message count
    const { result } = renderHook(() =>
      useSnapshotSelector(store, (snapshot) => snapshot.messages.size)
    );

    expect(result.current).toBe(2);
  });

  it("should return selected computed value", () => {
    const { store, controller } = mockStore();

    act(() => {
      controller.emitSessionUpdate({
        update: { type: "user_message", turnId: "turn-0", content: [{ type: "text", text: "First" }] },
      });
    });

    // Selector to get first message content
    const { result } = renderHook(() =>
      useSnapshotSelector(store, (snapshot) => {
        const messages = Array.from(snapshot.messages.values());
        return messages[0]?.content ?? null;
      })
    );

    expect(result.current).toBe("First");
  });
});
```

### Pattern: Testing SSR Safety

Verify hooks handle server-side rendering correctly:

```tsx
describe("useChatEvent", () => {
  it("should return empty array for server snapshot", () => {
    const controller = mockChatCore();

    // The hook uses getServerSnapshot which returns empty array
    const { result } = renderHook(() => useChatEvent(controller, "sessionUpdate"));

    // Server snapshot returns empty array for SSR safety
    expect(result.current).toEqual([]);
  });
});
```

### Pattern: Testing Hook Re-renders

Verify hooks only re-render when data changes:

```tsx
it("should maintain stable reference when no changes", () => {
  const { store } = mockStore();
  const { result, rerender } = renderHook(() => useMessages(store));

  const firstRender = result.current;

  rerender();

  // Should return same array reference if no changes
  expect(result.current).toBe(firstRender);
});
```

---

## See Also

- [Component Testing Patterns](./component-testing.md) - Testing React components with ACP hooks
- [ACP Store Documentation](../../docs/wiki/acp-chat-react-Home.md) - Store architecture and API
- [Testing Utilities](../src/test-utils/index.ts) - Complete test utilities reference
