# Unit Testing Patterns for ACP Chat Core

This guide documents practical patterns for writing unit tests in the ACP Chat Core library. All examples are based on actual tests from the codebase.

## Table of Contents

- [Test Organization](#test-organization)
- [Mocking Patterns](#mocking-patterns)
- [Test Data Factories](#test-data-factories)
- [Testing Controllers](#testing-controllers)
- [Testing Pure Functions](#testing-pure-functions)
- [Testing Event Systems](#testing-event-systems)
- [Async Testing Patterns](#async-testing-patterns)
- [Error Handling Tests](#error-handling-tests)
- [Test Templates](#test-templates)

---

## Test Organization

### File Structure

Tests live alongside source files with `.test.ts` extension:

```
src/
├── session/
│   ├── controller.ts
│   └── controller.test.ts
├── transport/
│   ├── client.ts
│   └── client.test.ts
├── helpers/
│   ├── composer-logic.ts
│   └── composer-logic.test.ts
└── test-utils/
    ├── mocks.ts
    ├── factories.ts
    └── fixtures.ts
```

### Test File Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModuleUnderTest } from "./module.js";

describe("ModuleUnderTest", () => {
  let instance: ModuleUnderTest;

  beforeEach(() => {
    vi.clearAllMocks();
    instance = new ModuleUnderTest();
  });

  describe("methodName()", () => {
    it("does something specific", () => {
      // Arrange
      // Act
      // Expect
    });
  });
});
```

---

## Mocking Patterns

### Pattern 1: Inline Mock Classes (vi.mock)

Use for mocking dependencies that are imported by the module under test.

**Example from `controller.test.ts`:**

```typescript
// Mock TransportClient
vi.mock("../transport/client.js", () => {
  class MockTransportClient {
    public status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error" = "disconnected";
    private handlers = {
      statusChange: new Set(),
      envelope: new Set(),
      error: new Set(),
    };

    constructor(private config: { url: string; reconnect: boolean }) {}

    on(event: string, handler: unknown): () => void {
      switch (event) {
        case "statusChange":
          this.handlers.statusChange.add(handler as any);
          break;
        case "envelope":
          this.handlers.envelope.add(handler as any);
          break;
      }
      return () => {
        // Cleanup handler
      };
    }

    connect() {
      this.setStatus("connected");
    }

    disconnect() {
      this.setStatus("disconnected");
    }

    send(data: string) {
      this.lastSent = data;
    }

    getStatus() {
      return this.status;
    }

    setStatus(status: any) {
      this.status = status;
      this.handlers.statusChange.forEach((h) => h(status));
    }

    emitEnvelope(envelope: any) {
      this.handlers.envelope.forEach((h) => h(envelope));
    }
  }

  return { TransportClient: MockTransportClient };
});
```

**Key Points:**
- Mock all public methods and properties
- Implement event emission for handlers
- Track method calls for assertions
- Return realistic values

### Pattern 2: MockTransportClient from test-utils

Reusable mock for transport layer testing.

**Usage:**

```typescript
import { createMockTransport, MockTransportClient } from "../test-utils/index.js";

describe("TransportClient tests", () => {
  let transport: MockTransportClient;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("emits statusChange on connect", () => {
    const handler = vi.fn();
    transport.on("statusChange", handler);

    transport.connect();

    expect(handler).toHaveBeenCalledWith("connected");
  });
});
```

**From `mocks.ts`:**

```typescript
export class MockTransportClient {
  public status: ConnectionStatus = 'disconnected';
  
  on(event: 'statusChange', handler: (status: ConnectionStatus) => void): () => void;
  on(event: 'envelope', handler: (envelope: BridgeEnvelope) => void): () => void;
  on(event: 'error', handler: (error: Error) => void): () => void;
  
  connect() {
    this.setStatus('connected');
  }
  
  emitEnvelope(envelope: BridgeEnvelope) {
    this.handlers.envelope.forEach((h) => h(envelope));
  }
}

export function createMockTransport(
  config?: Partial<TransportConfig>
): MockTransportClient {
  return new MockTransportClient({
    url: config?.url ?? 'ws://localhost:8080/mock',
    ...config,
  });
}
```

### Pattern 3: Mock WebSocket with vi.stubGlobal

For testing WebSocket-dependent code without real connections.

**Example from `client.test.ts`:**

```typescript
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  readyState: WebSocket.OPEN,
  onopen: null as (() => void) | null,
  onmessage: null as ((event: MessageEvent) => void) | null,
  onerror: null as (() => void) | null,
  onclose: null as (() => void) | null,
};

vi.stubGlobal("WebSocket", {
  prototype: {
    send: mockWebSocket.send,
    close: mockWebSocket.close,
    readyState: mockWebSocket.readyState,
  },
  OPEN: 1,
  CONNECTING: 0,
  CLOSING: 2,
  CLOSED: 3,
});
```

**Simulating events:**

```typescript
it("onopen handler sets status to connected", () => {
  transport.connect();
  
  // Simulate WebSocket open
  mockWebSocket.onopen?.();
  
  expect(transport.getStatus()).toBe("connected");
});
```

### Pattern 4: Mock Controller for Middleware Tests

For testing interceptors and middleware that depend on SessionController.

**Example from `capture-interceptor.test.ts`:**

```typescript
type MockController = {
  connect(): void;
  disconnect(): void;
  getState(): any;
  on(event: string, handler: any): () => void;
  emitTraffic(direction: "in" | "out", data: unknown): void;
  emitSessionUpdate(params: unknown): void;
};

class MockSessionController implements MockController {
  private handlers: any = {
    statusChange: new Set(),
    sessionUpdate: new Set(),
    traffic: new Set(),
  };

  on(event: string, handler: any): () => void {
    this.handlers[event].add(handler);
    return () => this.handlers[event].delete(handler);
  }

  emitTraffic(direction: "in" | "out", data: unknown) {
    this.handlers.traffic.forEach((h: any) => h(direction, data));
  }
}
```

---

## Test Data Factories

### Factory Functions from `factories.ts`

Create consistent test data with minimal boilerplate.

#### JSON-RPC Payloads

```typescript
import {
  createACPPayload,
  createACPPayloadResult,
  createACPPayloadError,
  createACPPayloadNotification,
} from "../test-utils/index.js";

// Request
const request = createACPPayload({
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05" },
});

// Response
const response = createACPPayloadResult({
  id: 1,
  result: { capabilities: { maxTokens: 4096 } },
});

// Error
const error = createACPPayloadError({
  id: 1,
  code: -32600,
  message: "Invalid Request",
});

// Notification
const notification = createACPPayloadNotification({
  method: "session/update",
  params: { sessionId: "test", update: { type: "message" } },
});
```

#### Bridge Envelopes

```typescript
import {
  createBridgeEnvelope,
  createBridgeStatusEnvelope,
  createSessionUpdateEnvelope,
} from "../test-utils/index.js";

// ACP payload envelope
const envelope = createBridgeEnvelope({
  seq: 5,
  timestamp_ms: 1234567890,
  payload: createACPPayload({ id: 1, method: "test" }),
});

// Bridge status envelope
const statusEnvelope = createBridgeStatusEnvelope({
  status: "connected",
  seq: 1,
});

// Session update envelope
const updateEnvelope = createSessionUpdateEnvelope({
  sessionId: "session-123",
  update: { type: "message", id: "msg-1", content: "Hello" },
});
```

#### Result Objects

```typescript
import {
  createInitializeResult,
  createCreateSessionResult,
  createListSessionsResult,
} from "../test-utils/index.js";

const initResult = createInitializeResult({
  capabilities: { maxTokens: 8192 },
  sessionId: "init-session",
});

const sessionResult = createCreateSessionResult({
  sessionId: "new-session-123",
});

const listResult = createListSessionsResult({
  sessions: [
    { sessionId: "s1", cwd: "/path1", title: "Session 1", updatedAt: "2024-01-01" },
  ],
  nextCursor: "cursor-123",
});
```

### Custom Factory Pattern

Create domain-specific factories for your tests:

```typescript
// In your test file
function createThought(id: string, content: string, createdAt?: number): NormalizedThought {
  return {
    id,
    content,
    createdAt: createdAt ?? Date.now(),
    updatedAt: createdAt ?? Date.now(),
  };
}

function createToolCall(id: string, title: string, createdAt?: number): NormalizedToolCall {
  return {
    toolCallId: id,
    kind: "read",
    title,
    createdAt: createdAt ?? Date.now(),
    updatedAt: createdAt ?? Date.now(),
  };
}

function createTimelineItem(
  type: "thought" | "tool_call" | "message",
  id: string,
  data: any
): TimelineItem {
  return { type, id, data } as TimelineItem;
}
```

**Usage in tests:**

```typescript
const timeline: TimelineItem[] = [
  createTimelineItem("thought", "t1", createThought("t1", "thinking", Date.now())),
  createTimelineItem("tool_call", "call1", createToolCall("call1", "Read file")),
];
```

---

## Testing Controllers

### Testing State Management

**Example: SessionController state tests**

```typescript
describe("initialization", () => {
  it("initializes with disconnected state", () => {
    const state = controller.getState();
    expect(state.connectionStatus).toBe("disconnected");
    expect(state.bridgeStatus).toBe("disconnected");
    expect(state.sessionId).toBeNull();
    expect(state.initialized).toBe(false);
    expect(state.capabilities).toBeNull();
  });

  it("exposes state through getState with copy semantics", () => {
    const state1 = controller.getState();
    const state2 = controller.getState();
    
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
    
    // Mutating returned state doesn't affect controller
    (state1 as any).sessionId = "mutated";
    expect(controller.getState().sessionId).toBeNull();
  });
});
```

### Testing Method Calls with Mock Responses

**Pattern:**

```typescript
async function simulateResponse(requestId: number, result: unknown) {
  const mockTransport = getMockTransport();
  const envelope: BridgeEnvelope = {
    version: 1,
    seq: requestId,
    timestamp_ms: Date.now(),
    type: "acp_payload",
    payload: {
      jsonrpc: "2.0",
      id: requestId,
      result,
    },
  };
  mockTransport.emitEnvelope(envelope);
}

it("createSession creates new session and sets sessionId", async () => {
  const mockTransport = getMockTransport();
  
  const createPromise = controller.createSession("/test/workspace", []);
  const requestId = getLastRequestId();
  simulateResponse(requestId, { sessionId: "new-session-123" });

  const result = await createPromise;

  expect(controller.getState().sessionId).toBe("new-session-123");
  expect(result).toEqual({ sessionId: "new-session-123" });
});
```

### Testing Event Emission

```typescript
it("emits statusChange on connection state changes", () => {
  const statusHandler = vi.fn();
  controller.on("statusChange", statusHandler);
  
  controller.connect();
  controller.disconnect();
  
  expect(statusHandler).toHaveBeenCalledTimes(2);
  expect(statusHandler).toHaveBeenNthCalledWith(1, expect.objectContaining({
    connectionStatus: "connected",
  }));
  expect(statusHandler).toHaveBeenNthCalledWith(2, expect.objectContaining({
    connectionStatus: "disconnected",
  }));
});
```

### Testing Unsubscribe

```typescript
it("accepts statusChange event handlers", () => {
  const handler = vi.fn();
  const unsubscribe = controller.on("statusChange", handler);
  
  expect(typeof unsubscribe).toBe("function");
  
  controller.connect();
  expect(handler).toHaveBeenCalled();
  
  // Unsubscribe works
  unsubscribe();
  handler.mockClear();
  controller.disconnect();
  expect(handler).not.toHaveBeenCalled();
});
```

---

## Testing Pure Functions

### Simple Boolean Functions

**Example from `composer-logic.test.ts`:**

```typescript
describe("shouldSendOnKeydown()", () => {
  it("returns true for Enter key without shift", () => {
    expect(shouldSendOnKeydown("Enter", false, false)).toBe(true);
  });

  it("returns false for Enter key with shift", () => {
    expect(shouldSendOnKeydown("Enter", true, false)).toBe(false);
  });

  it("returns false for non-Enter keys", () => {
    expect(shouldSendOnKeydown("a", false, false)).toBe(false);
    expect(shouldSendOnKeydown("Space", false, false)).toBe(false);
  });

  it("returns false when composing (IME input)", () => {
    expect(shouldSendOnKeydown("Enter", false, true)).toBe(false);
  });
});
```

### State Transformer Functions

```typescript
describe("startPrompt()", () => {
  it("creates active prompt state without turnId", () => {
    const state = startPrompt();
    expect(state.phase).toBe("active");
    expect(state.turnId).toBeUndefined();
  });

  it("creates active prompt state with turnId", () => {
    const state = startPrompt("turn-123");
    expect(state.phase).toBe("active");
    expect(state.turnId).toBe("turn-123");
  });
});
```

### Complex Algorithm Testing

**Example from `thought-stack-logic.test.ts`:**

```typescript
describe("groupThoughtItems()", () => {
  describe("empty input", () => {
    it("returns empty array for empty timeline", () => {
      const result = groupThoughtItems([]);
      expect(result).toEqual([]);
    });
  });

  describe("single thought", () => {
    it("groups a single thought", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking...", now)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("thought-group-0");
      expect(result[0].items).toHaveLength(1);
    });
  });

  describe("multiple groups separated by messages", () => {
    it("creates separate groups for thoughts separated by messages", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking 1", now)),
        createTimelineItem("thought", "t2", createThought("t2", "thinking 2", now + 100)),
        createTimelineItem("message", "m1", createMessage("m1", "user message")),
        createTimelineItem("thought", "t3", createThought("t3", "thinking 3", now + 200)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(2);
      expect(result[0].items).toHaveLength(2);
      expect(result[1].items).toHaveLength(1);
    });
  });
});
```

---

## Testing Event Systems

### Testing Event Registration

```typescript
describe("event handlers", () => {
  it("accepts sessionUpdate event handlers", () => {
    const handler = vi.fn();
    const unsubscribe = controller.on("sessionUpdate", handler);
    
    expect(typeof unsubscribe).toBe("function");
    
    const mockTransport = getMockTransport();
    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: Date.now(),
      type: "acp_payload",
      payload: {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: "test-session",
          update: { type: "message", content: "test" },
        },
      },
    };
    mockTransport.emitEnvelope(envelope);
    
    expect(handler).toHaveBeenCalledWith({
      sessionId: "test-session",
      update: { type: "message", content: "test" },
    });
  });
});
```

### Testing Multiple Event Types

```typescript
it("emits different events for different envelope types", () => {
  const trafficHandler = vi.fn();
  const sessionUpdateHandler = vi.fn();
  
  controller.on("traffic", trafficHandler);
  controller.on("sessionUpdate", sessionUpdateHandler);
  
  // Emit bridge status
  const statusEnvelope = createBridgeStatusEnvelope({ status: "connected" });
  mockTransport.emitEnvelope(statusEnvelope);
  
  expect(trafficHandler).toHaveBeenCalledWith("in", expect.anything());
  
  // Emit session update
  const updateEnvelope = createSessionUpdateEnvelope({
    sessionId: "session-123",
    update: { type: "message" },
  });
  mockTransport.emitEnvelope(updateEnvelope);
  
  expect(sessionUpdateHandler).toHaveBeenCalledWith({
    sessionId: "session-123",
    update: { type: "message" },
  });
});
```

### Testing Batched Events

```typescript
it("handles batched session updates", () => {
  const sessionUpdateHandler = vi.fn();
  controller.on("sessionUpdate", sessionUpdateHandler);

  const mockTransport = getMockTransport();
  const envelope: BridgeEnvelope = {
    version: 1,
    seq: 0,
    timestamp_ms: Date.now(),
    type: "acp_payload",
    payload: {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        batched: true,
        updates: [
          { sessionId: "session-123", update: { type: "message" } },
          { sessionId: "session-123", update: { type: "thought" } },
        ],
      },
    },
  };
  mockTransport.emitEnvelope(envelope);

  expect(sessionUpdateHandler).toHaveBeenCalledTimes(2);
  expect(sessionUpdateHandler).toHaveBeenNthCalledWith(1, {
    sessionId: "session-123",
    update: { type: "message" },
  });
  expect(sessionUpdateHandler).toHaveBeenNthCalledWith(2, {
    sessionId: "session-123",
    update: { type: "thought" },
  });
});
```

---

## Async Testing Patterns

### Testing Promise Resolution

```typescript
it("initialize sends initialize request and sets initialized flag", async () => {
  const mockTransport = getMockTransport();
  
  const initPromise = controller.initialize({
    name: "test-client",
    version: "1.0.0",
  });
  
  const requestId = getLastRequestId();
  simulateResponse(requestId, {
    capabilities: { maxTokens: 4096 },
    protocolVersion: 1,
  });

  const result = await initPromise;

  expect(controller.getState().initialized).toBe(true);
  expect(result).toEqual({
    capabilities: { maxTokens: 4096 },
    protocolVersion: 1,
  });
});
```

### Testing Promise Rejection

```typescript
it("initialize rejects on error response", async () => {
  const mockTransport = getMockTransport();
  
  const initPromise = controller.initialize();
  const requestId = getLastRequestId();
  simulateError(requestId, "Initialization failed");

  await expect(initPromise).rejects.toThrow("Initialization failed");
});
```

### Testing Async with vi.waitFor

```typescript
it("handleFileReadRequest calls subscribed handler and sends response", async () => {
  const fileReadHandler = vi.fn().mockResolvedValue({ content: "file content" });
  
  controller.subscribeToFileReads(fileReadHandler);

  const envelope: BridgeEnvelope = {
    version: 1,
    seq: 0,
    timestamp_ms: Date.now(),
    type: "acp_payload",
    payload: {
      jsonrpc: "2.0",
      method: "fs/read_text_file",
      id: 100,
      params: { path: "src/index.ts" },
    },
  };
  mockTransport.emitEnvelope(envelope);

  await vi.waitFor(() => {
    expect(fileReadHandler).toHaveBeenCalled();
  }, { timeout: 100 });

  expect(fileReadHandler).toHaveBeenCalledWith({
    path: "src/index.ts",
  });
});
```

### Testing with Fake Timers

```typescript
describe("auto-reconnect with exponential backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules reconnect on close when reconnect is enabled", () => {
    const client = new TransportClient({
      url: "ws://localhost:8080/test",
      reconnect: true,
      maxReconnectAttempts: 5,
      baseReconnectDelayMs: 100,
    });
    
    const statusHandler = vi.fn();
    client.on("statusChange", statusHandler);
    client.connect();
    
    // Close connection
    mockWebSocket.onclose?.();
    
    expect(statusHandler).toHaveBeenCalledWith("reconnecting");
    
    // Fast-forward to reconnect time
    vi.advanceTimersByTime(200);
    
    expect(statusHandler).toHaveBeenCalledWith("connecting");
  });
});
```

---

## Error Handling Tests

### Testing Validation Errors

**Example from `parser.test.ts`:**

```typescript
describe("malformed JSON handling", () => {
  it("throws SyntaxError for invalid JSON", () => {
    expect(() => parseEnvelope("not json at all")).toThrow(SyntaxError);
  });

  it("throws SyntaxError for truncated JSON", () => {
    expect(() => parseEnvelope('{"version": 1, "seq":')).toThrow(SyntaxError);
  });

  it("throws SyntaxError for empty string", () => {
    expect(() => parseEnvelope("")).toThrow(SyntaxError);
  });
});

describe("version validation edge cases", () => {
  it("rejects version 0", () => {
    const json = JSON.stringify({
      version: 0,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });

  it("rejects floating point version", () => {
    const json = JSON.stringify({
      version: 1.5,
      seq: 0,
      timestamp_ms: 0,
      type: "acp_payload",
      payload: {},
    });

    expect(() => parseEnvelope(json)).toThrow(BridgeVersionError);
  });
});
```

### Testing Security Validation

```typescript
it("handleFileReadRequest validates path and rejects paths with ..", async () => {
  const mockTransport = getMockTransport();
  const sendSpy = vi.spyOn(mockTransport, "send");

  controller.subscribeToFileReads(async () => ({ content: "test content" }));

  const envelope: BridgeEnvelope = {
    version: 1,
    seq: 0,
    timestamp_ms: Date.now(),
    type: "acp_payload",
    payload: {
      jsonrpc: "2.0",
      method: "fs/read_text_file",
      id: 100,
      params: { path: "../../../etc/passwd" },
    },
  };
  mockTransport.emitEnvelope(envelope);

  await new Promise(resolve => setTimeout(resolve, 50));
  expect(sendSpy).not.toHaveBeenCalled();
});
```

### Testing Timeout Errors

```typescript
it("request timeout rejects pending request", async () => {
  const controllerWithTimeout = new SessionController("ws://test", 50);
  controllerWithTimeout.connect();

  await expect(controllerWithTimeout.initialize())
    .rejects.toThrow(/timed out/);
});
```

---

## Test Templates

### Template 1: Controller Test

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Controller } from "./controller.js";

vi.mock("../dependency.js", () => ({
  Dependency: class MockDependency {
    // Mock implementation
  },
}));

describe("Controller", () => {
  let controller: Controller;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new Controller();
  });

  describe("methodName()", () => {
    it("should do something", async () => {
      // Arrange
      const input = "test";
      
      // Act
      const result = await controller.methodName(input);
      
      // Expect
      expect(result).toBe(expected);
    });

    it("should emit event", () => {
      const handler = vi.fn();
      controller.on("eventName", handler);
      
      controller.triggerEvent();
      
      expect(handler).toHaveBeenCalledWith(expected);
    });

    it("should reject on error", async () => {
      await expect(controller.methodName("invalid"))
        .rejects.toThrow(/error message/);
    });
  });
});
```

### Template 2: Pure Function Test

```typescript
import { describe, it, expect } from "vitest";
import { pureFunction } from "./module.js";

describe("pureFunction()", () => {
  describe("valid input", () => {
    it("returns expected output for case 1", () => {
      expect(pureFunction(input1)).toBe(output1);
    });

    it("returns expected output for case 2", () => {
      expect(pureFunction(input2)).toBe(output2);
    });
  });

  describe("edge cases", () => {
    it("handles empty input", () => {
      expect(pureFunction("")).toBe(expectedEmpty);
    });

    it("handles null input", () => {
      expect(pureFunction(null)).toBe(expectedNull);
    });
  });

  describe("invalid input", () => {
    it("throws for invalid input", () => {
      expect(() => pureFunction(invalid)).toThrow(/error/);
    });
  });
});
```

### Template 3: Parser/Validator Test

```typescript
import { describe, it, expect } from "vitest";
import { parse, validate } from "./parser.js";

describe("parser", () => {
  describe("valid input", () => {
    it("parses valid JSON", () => {
      const result = parse('{"valid": "json"}');
      expect(result).toEqual({ valid: "json" });
    });

    it("parses with all required fields", () => {
      const result = parse(JSON.stringify(validObject));
      expect(result.field).toBe(expected);
    });
  });

  describe("malformed input", () => {
    it("throws for invalid JSON", () => {
      expect(() => parse("not json")).toThrow(SyntaxError);
    });

    it("throws for missing required field", () => {
      expect(() => parse(JSON.stringify({ incomplete: true })))
        .toThrow(/required field/);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(() => parse("")).toThrow();
    });

    it("handles null", () => {
      expect(() => parse(JSON.stringify(null))).toThrow();
    });
  });
});
```

### Template 4: Event Emitter Test

```typescript
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "./emitter.js";

describe("EventEmitter", () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe("on()/off()", () => {
    it("registers event handler", () => {
      const handler = vi.fn();
      emitter.on("event", handler);
      
      emitter.emit("event", "data");
      
      expect(handler).toHaveBeenCalledWith("data");
    });

    it("unregisters event handler", () => {
      const handler = vi.fn();
      const unsubscribe = emitter.on("event", handler);
      
      unsubscribe();
      emitter.emit("event", "data");
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("emit()", () => {
    it("calls all registered handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      emitter.on("event", handler1);
      emitter.on("event", handler2);
      
      emitter.emit("event", "payload");
      
      expect(handler1).toHaveBeenCalledWith("payload");
      expect(handler2).toHaveBeenCalledWith("payload");
    });
  });
});
```

---

## Quick Reference

### Common Assertions

```typescript
// Boolean checks
expect(value).toBe(true);
expect(value).toBe(false);
expect(value).toBeNull();
expect(value).toBeUndefined();

// Equality
expect(obj).toEqual({ key: "value" });
expect(array).toContain("item");

// Function calls
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith("arg1", "arg2");
expect(fn).toHaveBeenCalledTimes(3);

// Promise assertions
await expect(promise).resolves.toBe(expected);
await expect(promise).rejects.toThrow(/error/);

// Object shape
expect(obj).toEqual(
  expect.objectContaining({ key: "value" })
);
expect(array).toEqual(
  expect.arrayContaining([1, 2])
);
```

### Common Vitest Utilities

```typescript
import { vi, expect, describe, it, beforeEach, afterEach } from "vitest";

// Mocking
vi.mock("../module.js");
vi.spyOn(object, "method");

// Timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();

// Wait for async
await vi.waitFor(() => {
  expect(condition).toBe(true);
}, { timeout: 1000 });

// Clear mocks
vi.clearAllMocks();
vi.restoreAllMocks();
```

---

## Best Practices

1. **Use test utilities**: Always use factories and mocks from `test-utils/` instead of creating inline test data.

2. **Test behavior, not implementation**: Focus on what the code does, not how it does it.

3. **Name tests descriptively**: Test names should describe the expected behavior.

4. **Arrange-Act-Assert**: Structure tests with clear sections.

5. **Test edge cases**: Empty input, null values, maximum values, error conditions.

6. **Mock external dependencies**: Never make real network calls or file system access in unit tests.

7. **Keep tests independent**: Each test should be able to run in isolation.

8. **Use beforeEach for setup**: Avoid duplicating setup code across tests.

9. **Test error paths**: Don't just test happy paths, test failure scenarios too.

10. **Maintain test utilities**: When you find yourself duplicating test setup, extract it to `test-utils/`.
