# Testing Guide - acp-ws-bridge

Comprehensive guide for testing the ACP WebSocket Bridge TypeScript implementation.

## Quick Start

### Run Tests

```bash
# Run all tests
pnpm vitest run packages/acp-ws-bridge

# Run with coverage
pnpm vitest run packages/acp-ws-bridge --coverage

# Run specific test file
pnpm vitest run packages/acp-ws-bridge/src/client.test.ts

# Run tests in watch mode
pnpm vitest packages/acp-ws-bridge
```

### Package Scripts

```bash
# Run tests via package.json script
pnpm test-bridge

# Run tests with coverage
pnpm test-bridge:coverage
```

## Test Organization

### File Structure

Tests are organized alongside source code using the `*.test.ts` naming convention:

```
packages/acp-ws-bridge/src/
├── client.ts              # TransportClient implementation
├── client.test.ts         # Client connection tests (40 tests)
├── envelope.test.ts       # Envelope serialization tests (51 tests)
├── test-utils.ts          # Test utilities (MockWebSocket, builders)
└── index.ts               # Package exports
```

### Test Categories

**client.test.ts** (40 tests):
- Connection Establishment (7 tests)
- Disconnection (4 tests)
- State Transitions (4 tests)
- Connection Errors (4 tests)
- Auto-Reconnect Logic (5 tests)
- Event Handling (7 tests)
- Message Handling (2 tests)
- Send Method (3 tests)
- Init Methods (5 tests)
- setReplaySpeed (3 tests)

**envelope.test.ts** (51 tests):
- Basic serialization (7 tests)
- extraData serialization (8 tests)
- Round-trip serialization (4 tests)
- All BridgeMessage variants (11 tests)
- Round-trip with message variants (6 tests)
- Field name consistency (4 tests)
- Edge cases (5 tests)
- TestConstants samples (6 tests)

**Total: 95 tests**

## Test Utilities

The `test-utils.ts` module provides comprehensive testing infrastructure.

### MockWebSocket

Simulates WebSocket behavior without network connections.

```typescript
import { MockWebSocket } from "./test-utils";

// Setup in test
let originalWebSocket: typeof WebSocket;

beforeEach(() => {
  originalWebSocket = global.WebSocket;
  global.WebSocket = MockWebSocket as any;
  vi.useFakeTimers();
});

afterEach(() => {
  global.WebSocket = originalWebSocket;
  vi.useRealTimers();
});
```

#### Control Connection State

```typescript
const client = new TransportClient({ url: "ws://localhost:8080" });
client.connect();

// Get the mock WebSocket
const mockWs = (client as unknown as { ws: MockWebSocket }).ws;

// Simulate connection opening
mockWs.simulateOpen();

// Simulate receiving a message
mockWs.simulateMessage('{"type": "test"}');
mockWs.simulateMessageJson({ type: "test" });

// Simulate error
mockWs.simulateError();

// Simulate close
mockWs.simulateClose(1000, "Normal closure");

// Simulate connection failure
mockWs.failOnOpen(true);
```

#### Inspect Sent Messages

```typescript
// Get all sent messages
const messages = mockWs.getSentMessages();
expect(messages).toHaveLength(1);

// Parse and verify
const sent = JSON.parse(messages[0]!);
expect(sent.type).toBe("init");

// Clear buffer
mockWs.clearSentMessages();
```

### EnvelopeBuilder

Builder pattern for creating test BridgeEnvelope instances.

```typescript
import { EnvelopeBuilder, MessageBuilder } from "./test-utils";

// Basic usage
const envelope = EnvelopeBuilder.new()
  .message(MessageBuilder.acpPayload({ method: "test" }))
  .version(1)
  .seq(42)
  .timestampMs(1234567890)
  .extraData({ metadata: "value" })
  .build();

// With defaults
const defaultEnvelope = EnvelopeBuilder.new()
  .message(MessageBuilder.acpPayload({}))
  .build();
// version: 1, seq: 0, timestamp_ms: 1234567890
```

### MessageBuilder

Helper methods for creating BridgeMessage instances.

```typescript
import { MessageBuilder } from "./test-utils";

// ACP payload
const acpMsg = MessageBuilder.acpPayload({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {},
});

// ACP JSON-RPC request
const acpRequest = MessageBuilder.acpRequest("tools/call", { name: "test" });

// Bridge status
const statusMsg = MessageBuilder.bridgeStatus("connected");

// Stderr
const stderrMsg = MessageBuilder.stderr("Error: something failed");

// Process exit
const exitMsg = MessageBuilder.processExit(0, "SIGINT");

// Replay metadata
const replayMsg = MessageBuilder.replayMetadata(1234567890, 100, "Session");

// Start agent
const startMsg = MessageBuilder.startAgent(
  "node",
  ["script.js"],
  "/workspace",
  [["NODE_ENV", "test"]]
);
```

### TestConstants

Pre-built sample envelopes for common scenarios.

```typescript
import { TestConstants } from "./test-utils";

// Sample ACP payload envelope
const acpEnvelope = TestConstants.sampleEnvelopeAcpPayload();

// Sample bridge status envelope
const statusEnvelope = TestConstants.sampleEnvelopeBridgeStatus("connected");

// Sample stderr envelope
const stderrEnvelope = TestConstants.sampleEnvelopeStderr();

// Sample process exit envelope
const exitEnvelope = TestConstants.sampleEnvelopeProcessExit(1, "SIGTERM");

// Sample replay metadata envelope
const replayEnvelope = TestConstants.sampleEnvelopeReplayMetadata();

// Sample start agent envelope
const startEnvelope = TestConstants.sampleEnvelopeStartAgent();
```

### AsyncTestHelpers

Utilities for async test patterns.

```typescript
import { AsyncTestHelpers } from "./test-utils";

// Wait for delay
await AsyncTestHelpers.wait(1000);

// Wait for condition
await AsyncTestHelpers.waitForCondition(
  () => client.getStatus() === "connected",
  5000,  // timeout
  100    // check interval
);

// Capture events
const events = await AsyncTestHelpers.captureEvents(
  client,
  "statusChange",
  3  // number of events to capture
);

// Create deferred promise
const { promise, resolve, reject } = AsyncTestHelpers.createDeferred<string>();
// Later: resolve("value") or reject(new Error("failed"))
```

## Writing Tests

### Test Structure Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TransportClient } from "./client";
import { MockWebSocket } from "./test-utils";

describe("TransportClient", () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  describe("Connection Establishment", () => {
    it("should transition to connected when WebSocket opens", () => {
      const client = new TransportClient({ url: "ws://localhost:8080" });
      
      client.connect();
      const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateOpen();
      
      expect(client.getStatus()).toBe("connected");
    });
  });
});
```

### Testing State Transitions

```typescript
it("should follow complete lifecycle", () => {
  const client = new TransportClient({ url: "ws://localhost:8080" });
  const statusChanges: ConnectionStatus[] = [];
  
  client.on("statusChange", (status) => statusChanges.push(status));
  
  // Initial state
  expect(client.getStatus()).toBe("disconnected");
  
  // Start connection
  client.connect();
  expect(statusChanges).toEqual(["connecting"]);
  
  // WebSocket opens
  const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
  mockWs.simulateOpen();
  expect(statusChanges).toEqual(["connecting", "connected"]);
  
  // Close connection
  mockWs.simulateClose(1000, "Normal closure");
  expect(statusChanges).toEqual(["connecting", "connected", "disconnected"]);
});
```

### Testing with Fake Timers

Use fake timers to test reconnection logic without actual delays.

```typescript
it("should schedule reconnect with exponential backoff", () => {
  const client = new TransportClient({
    url: "ws://localhost:8080",
    reconnect: true,
    maxReconnectAttempts: 3,
    baseReconnectDelayMs: 1000,
    maxReconnectDelayMs: 10000,
  });
  
  client.connect();
  const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
  mockWs.simulateOpen();
  
  // First disconnect
  mockWs.simulateClose(1006, "Abnormal closure");
  
  // Fast-forward 1 second (first reconnect delay)
  vi.advanceTimersByTime(1000);
  
  // Should have called connect again
  expect(client.getStatus()).toBe("connecting");
});
```

### Testing Multiple Handlers

```typescript
it("should support multiple handlers for the same event", () => {
  const client = new TransportClient({ url: "ws://localhost:8080" });
  const handler1 = vi.fn();
  const handler2 = vi.fn();
  const handler3 = vi.fn();
  
  client.on("statusChange", handler1);
  client.on("statusChange", handler2);
  client.on("statusChange", handler3);
  
  client.connect();
  const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
  mockWs.simulateOpen();
  
  // All handlers should be called
  expect(handler1).toHaveBeenCalledTimes(2);
  expect(handler2).toHaveBeenCalledTimes(2);
  expect(handler3).toHaveBeenCalledTimes(2);
  
  // Verify all handlers received same events
  expect(handler1).toHaveBeenCalledWith("connecting");
  expect(handler2).toHaveBeenCalledWith("connecting");
  expect(handler3).toHaveBeenCalledWith("connecting");
});
```

### Testing Init Promises

```typescript
describe("initReplay", () => {
  it("should send init request and resolve on success", async () => {
    const client = new TransportClient({ url: "ws://localhost:8080" });
    
    client.connect();
    const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
    mockWs.simulateOpen();
    
    // Start init request
    const initPromise = client.initReplay("script.json", "test-session");
    
    // Verify request was sent
    const sentMessages = mockWs.getSentMessages();
    const sentData = JSON.parse(sentMessages[0]!);
    expect(sentData).toMatchObject({
      type: "init",
      mode: "replay",
      script: "script.json",
      sessionId: "test-session",
    });
    
    // Send success response
    mockWs.simulateMessageJson({
      type: "init",
      initId: sentData.initId,
      status: "success",
      mode: "replay",
    });
    
    const result = await initPromise;
    expect(result).toMatchObject({ status: "success", mode: "replay" });
  });
  
  it("should reject on error response", async () => {
    const client = new TransportClient({ url: "ws://localhost:8080" });
    
    client.connect();
    const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
    mockWs.simulateOpen();
    
    const initPromise = client.initReplay("script.json", "test-session");
    const sentMessages = mockWs.getSentMessages();
    const sentData = JSON.parse(sentMessages[0]!);
    
    // Send error response
    mockWs.simulateMessageJson({
      type: "init",
      initId: sentData.initId,
      status: "error",
      message: "Script not found",
    });
    
    await expect(initPromise).rejects.toThrow("Script not found");
  });
});
```

### Testing Envelope Serialization

```typescript
it("should serialize envelope with all required fields", () => {
  const envelope = EnvelopeBuilder.new()
    .message(MessageBuilder.acpPayload({ test: "value" }))
    .version(1)
    .seq(42)
    .timestampMs(1234567890)
    .build();
  
  const json = JSON.stringify(envelope);
  const parsed = JSON.parse(json);
  
  expect(parsed.version).toBe(1);
  expect(parsed.seq).toBe(42);
  expect(parsed.timestamp_ms).toBe(1234567890);
  expect(parsed.type).toBe("acp_payload");
  expect(parsed.payload).toEqual({ test: "value" });
});

it("should omit extraData when undefined", () => {
  const envelope = EnvelopeBuilder.new()
    .message(MessageBuilder.acpPayload({}))
    .build();
  
  const json = JSON.stringify(envelope);
  
  expect(json).not.toContain("extraData");
  expect(json).not.toContain("extra_data");
});

it("should use snake_case for timestamp_ms", () => {
  const envelope = EnvelopeBuilder.new()
    .message(MessageBuilder.acpPayload({}))
    .timestampMs(1234567890)
    .build();
  
  const json = JSON.stringify(envelope);
  
  expect(json).toContain("timestamp_ms");
  expect(json).not.toContain("timestampMs");
});
```

### Testing Edge Cases

```typescript
it("should handle very large timestamp values", () => {
  const largeTimestamp = Number.MAX_SAFE_INTEGER;
  const envelope = EnvelopeBuilder.new()
    .message(MessageBuilder.acpPayload({}))
    .timestampMs(largeTimestamp)
    .build();
  
  const json = JSON.stringify(envelope);
  const parsed = JSON.parse(json);
  
  expect(parsed.timestamp_ms).toBe(largeTimestamp);
});

it("should handle unicode in extraData", () => {
  const envelope = EnvelopeBuilder.new()
    .message(MessageBuilder.acpPayload({}))
    .extraData({
      emoji: "🚀",
      chinese: "你好",
      arabic: "مرحبا",
    })
    .build();
  
  const json = JSON.stringify(envelope);
  const parsed = JSON.parse(json);
  
  expect(parsed.extraData).toEqual({
    emoji: "🚀",
    chinese: "你好",
    arabic: "مرحبا",
  });
});

it("should handle deeply nested extraData", () => {
  const deepNested = {
    level1: {
      level2: {
        level3: {
          level4: {
            value: "deep",
          },
        },
      },
    },
  };
  
  const envelope = EnvelopeBuilder.new()
    .message(MessageBuilder.acpPayload({}))
    .extraData(deepNested)
    .build();
  
  const json = JSON.stringify(envelope);
  const parsed = JSON.parse(json);
  
  expect(parsed.extraData).toEqual(deepNested);
});
```

## Test Coverage

### Run Coverage

```bash
# Run with coverage
pnpm vitest run packages/acp-ws-bridge --coverage

# Or via package script
pnpm test-bridge:coverage
```

### Coverage Configuration

Coverage is configured in `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ... test config
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        branches: 75,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/test-utils.ts'],
    },
  },
});
```

### Coverage Targets

- **Lines**: ≥ 80%
- **Branches**: ≥ 75%
- **Functions**: No specific target (currently 86.56%)

### Current Coverage

As of the latest test suite:
- **Lines**: 82.83% ✅
- **Branches**: 91.66% ✅
- **Functions**: 86.56%

### Coverage Reports

Coverage reports are generated in three formats:

1. **Text**: Printed to console after test run
2. **LCOV**: `coverage/lcov.info` (for CI integration)
3. **HTML**: `coverage/lcov-report/index.html` (for browser viewing)

View HTML report:

```bash
open coverage/lcov-report/index.html
```

## Examples

### Complete Test Example

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TransportClient } from "./client";
import { MockWebSocket, EnvelopeBuilder, MessageBuilder } from "./test-utils";

describe("TransportClient Message Handling", () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it("should emit envelope event on valid message", () => {
    const client = new TransportClient({ url: "ws://localhost:8080" });
    const envelopeHandler = vi.fn();

    client.on("envelope", envelopeHandler);

    client.connect();
    const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
    mockWs.simulateOpen();

    // Create test envelope using builders
    const envelope = EnvelopeBuilder.new()
      .message(MessageBuilder.acpPayload({
        jsonrpc: "2.0",
        id: 1,
        method: "test",
        params: {},
      }))
      .version(1)
      .seq(0)
      .timestampMs(1234567890)
      .build();

    // Simulate receiving the envelope
    mockWs.simulateMessageJson(envelope);

    expect(envelopeHandler).toHaveBeenCalledTimes(1);
    expect(envelopeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        seq: 0,
        type: "acp_payload",
      })
    );
  });
});
```

### Testing Reconnect with Max Attempts

```typescript
it("should respect max reconnect attempts", () => {
  const client = new TransportClient({
    url: "ws://localhost:8080",
    reconnect: true,
    maxReconnectAttempts: 3,
    baseReconnectDelayMs: 1000,
  });

  // Initial connection
  client.connect();
  let mockWs = (client as unknown as { ws: MockWebSocket }).ws;
  mockWs.simulateOpen();

  // First disconnect - attempt 1 (delay: 1000ms)
  mockWs.simulateClose(1006, "Abnormal closure");
  expect(client.getStatus()).toBe("reconnecting");
  vi.advanceTimersByTime(1000);
  expect(client.getStatus()).toBe("connecting");
  
  mockWs = (client as unknown as { ws: MockWebSocket }).ws;
  mockWs.simulateClose(1006, "Abnormal closure");

  // Second disconnect - attempt 2 (delay: 2000ms)
  expect(client.getStatus()).toBe("reconnecting");
  vi.advanceTimersByTime(2000);
  expect(client.getStatus()).toBe("connecting");
  
  mockWs = (client as unknown as { ws: MockWebSocket }).ws;
  mockWs.simulateClose(1006, "Abnormal closure");

  // Third disconnect - attempt 3 (delay: 4000ms)
  expect(client.getStatus()).toBe("reconnecting");
  vi.advanceTimersByTime(4000);
  expect(client.getStatus()).toBe("connecting");
  
  mockWs = (client as unknown as { ws: MockWebSocket }).ws;
  mockWs.simulateClose(1006, "Abnormal closure");

  // Max attempts reached - no more reconnects
  expect(client.getStatus()).toBe("disconnected");
});
```

## Best Practices

1. **Always restore global state** - Restore `global.WebSocket` and timers in `afterEach`

2. **Use builder pattern** - `EnvelopeBuilder` and `MessageBuilder` reduce boilerplate

3. **Test edge cases** - Unicode, large numbers, null values, empty objects

4. **Verify field names** - Check `snake_case` in serialized JSON (`timestamp_ms`, not `timestampMs`)

5. **Use fake timers for async** - Control `setTimeout` for reconnection tests

6. **Test all message variants** - Each `BridgeMessage` type has different structure

7. **Test round-trips** - Serialize → deserialize → compare

8. **Mock external dependencies** - WebSocket, network calls, timers

9. **Test error paths** - Constructor failures, malformed JSON, network errors

10. **Verify handler removal** - Test both `on()` and `off()` methods

## Reference

- **95 total tests** across 2 test files
- **82.83% line coverage** (target: 80%)
- **91.66% branch coverage** (target: 75%)
- **Test utilities**: `MockWebSocket`, `EnvelopeBuilder`, `MessageBuilder`, `TestConstants`, `AsyncTestHelpers`

For more examples, see:
- `packages/acp-ws-bridge/src/client.test.ts` - Connection lifecycle tests
- `packages/acp-ws-bridge/src/envelope.test.ts` - Serialization tests
- `packages/acp-ws-bridge/src/test-utils.ts` - Test utilities implementation
