# Integration Testing Patterns for ACP Chat Core

This guide documents replay-based integration testing patterns for the ACP Chat Core library. Unlike unit tests that mock dependencies, integration tests exercise the full system using recorded replay fixtures.

## Table of Contents

- [Overview](#overview)
- [Replay Fixture Format](#replay-fixture-format)
- [Test Infrastructure](#test-infrastructure)
- [Writing Integration Tests](#writing-integration-tests)
- [Test Data Setup](#test-data-setup)
- [Examples from Wave 3 Tests](#examples-from-wave-3-tests)
- [Best Practices](#best-practices)

---

## Overview

Integration tests in ACP Chat Core use a **replay-based approach**:

1. **Capture** real ACP bridge traffic during actual sessions
2. **Store** as JSONL fixtures with timing and metadata
3. **Replay** through ReplayController in tests
4. **Assert** on session updates, permission requests, and outcomes

This approach provides:
- **Realistic testing** with actual ACP protocol messages
- **Deterministic** reproducible test scenarios
- **Fast execution** without network dependencies
- **Complete coverage** of complex interaction patterns

---

## Replay Fixture Format

### Directory Structure

```
fixtures/replay-data/
├── captured/                  # Captured from real sessions
│   └── {timestamp}/           # e.g., 1775883989494
│       ├── replay-events.jsonl
│       └── session-data.json
└── {demoType}/                # Curated scenarios
    └── session-{n}/           # e.g., tool-calling/session-1
        ├── replay-events.jsonl
        ├── manifest.json
        └── {sessionId}/
            └── session-data.json
```

### JSONL Event Format

Each line in `replay-events.jsonl` is a complete event:

```json
{
  "envelope": {
    "version": 1,
    "seq": 0,
    "timestamp_ms": 1775883989494,
    "type": "acp_payload",
    "payload": {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "session/update",
      "params": {
        "sessionId": "session-123",
        "update": { "type": "message", "id": "msg-1", "content": "Hello" }
      }
    }
  },
  "tokenCount": 42,
  "timestamp": 1775883989494,
  "direction": "in"
}
```

**Key fields:**
- `envelope`: Complete BridgeEnvelope with ACP payload
- `tokenCount`: Pre-computed token estimate
- `timestamp`: Unix timestamp in milliseconds
- `direction`: `"in"` (from bridge) or `"out"` (to bridge)

### Session Data Format

`session-data.json` contains metadata:

```json
{
  "sessionId": "session-123",
  "startTime": 1775883989494,
  "endTime": 1775884089494,
  "preExistingState": null,
  "modes": ["coding", "debugging"],
  "models": ["gpt-4", "claude-3"],
  "eventCount": 150,
  "totalTokenCount": 5432
}
```

---

## Test Infrastructure

### FixtureLoader

Load fixtures from the `fixtures/replay-data/` directory.

**Location:** `src/test-utils/fixture-loader.ts`

**Key functions:**

```typescript
import { loadFixture, listFixtures } from '../test-utils/fixture-loader.js';

// List all available fixtures
const fixtures = listFixtures();
// ['captured/1775883989494', 'tool-calling/session-1', ...]

// Load a specific fixture
const fixture = loadFixture('captured/1775883989494');
```

**Returns `LoadedFixture`:**
```typescript
interface LoadedFixture {
  demoType: string;              // 'captured' or demo type
  sessionId: string;             // Unique session ID
  metadata: ReplaySessionMetadata;
  sessionData: ReplaySessionData | null;
  events: LoadedReplayEvent[];   // All events in order
}
```

### ReplayRunner

Executes replay fixtures through ReplayController.

**Location:** `src/test-utils/replay-runner.ts`

**Basic usage:**

```typescript
import { ReplayRunner } from '../test-utils/replay-runner.js';
import { loadFixture } from '../test-utils/fixture-loader.js';
import { ReplayController } from '../session/replay-controller.js';

const controller = new ReplayController({ bridgeUrl: 'ws://localhost:8080/replay-v2' });
const fixture = loadFixture('tool-calling/session-1');

const runner = new ReplayRunner({
  controller,
  fixture,
  replaySpeed: 1.0,    // Optional: speed multiplier
  timeoutMs: 60000,    // Optional: timeout in ms
});

const outcome = await runner.execute();
```

**ReplayOutcome structure:**
```typescript
interface ReplayOutcome {
  success: boolean;
  error?: string;
  sessionUpdates: RecordedSessionUpdate[];
  permissionRequests: RecordedPermissionRequest[];
  statistics: ReplayStatistics;
  fixture: LoadedFixture;
}
```

**Auto-respond to permissions:**
```typescript
const outcome = await runner
  .autoRespondToPermissions('approve')  // Auto-approve all
  .execute();
```

### ReplayAssertions

Assertion helpers for replay outcomes.

**Location:** `src/test-utils/replay-assertions.ts`

**Key assertions:**

```typescript
import {
  assertReplaySuccess,
  assertReplayFailed,
  assertHasSessionUpdates,
  assertSessionUpdateCount,
  assertNoSessionUpdates,
  assertPermissionRequestsHandled,
  assertReplayStatistics,
  assertSessionUpdateSequence,
  summarizeReplay,
} from '../test-utils/replay-assertions.js';

// Assert success
assertReplaySuccess(outcome);

// Assert failure with specific error
assertReplayFailed(outcome, /timeout/);

// Assert session updates exist
assertHasSessionUpdates(outcome, {
  update: { type: 'agent_thought_chunk' }
});

// Assert exactly N updates
assertSessionUpdateCount(outcome, {
  update: { type: 'tool_call' }
}, 3);

// Assert no updates of a type
assertNoSessionUpdates(outcome, {
  update: { type: 'error' }
});

// Assert permission handling
assertPermissionRequestsHandled(outcome, 2);  // At least 2 requests

// Assert statistics
assertReplayStatistics(outcome, {
  minEvents: 10,
  maxEvents: 100,
  minTokens: 500,
  maxDurationMs: 5000,
  maxErrors: 0,
});

// Assert event ordering
assertSessionUpdateSequence(outcome, [
  'agent_thought_chunk',
  'tool_call',
  'message',
]);

// Get summary for logging
console.log(summarizeReplay(outcome));
```

**Filter helpers:**

```typescript
import { filterSessionUpdates, findFirstSessionUpdate } from '../test-utils/replay-assertions.js';

// Filter updates
const toolCalls = filterSessionUpdates(outcome.sessionUpdates, {
  update: { type: 'tool_call' }
});

// Find first matching update
const firstThought = findFirstSessionUpdate(outcome, {
  update: { type: 'agent_thought_chunk' }
});
```

---

## Writing Integration Tests

### Test Structure

Integration tests follow this pattern:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReplayController } from '../../session/replay-controller.js';
import { ReplayRunner } from '../../test-utils/replay-runner.js';
import { loadFixture } from '../../test-utils/fixture-loader.js';
import {
  assertReplaySuccess,
  assertHasSessionUpdates,
  summarizeReplay,
} from '../../test-utils/replay-assertions.js';

// Mock TransportClient
vi.mock('../../transport/client.js', () => {
  class MockTransportClient {
    public status: 'disconnected' | 'connected' | 'connecting' = 'disconnected';
    private handlers = {
      statusChange: new Set(),
      envelope: new Set(),
      error: new Set(),
    };

    on(event: string, handler: unknown): () => void {
      switch (event) {
        case 'statusChange':
          this.handlers.statusChange.add(handler as any);
          break;
        case 'envelope':
          this.handlers.envelope.add(handler as any);
          break;
        case 'error':
          this.handlers.error.add(handler as any);
          break;
      }
      return () => {
        // Cleanup handler
      };
    }

    connect() {
      this.setStatus('connected');
    }

    async disconnect() {
      this.setStatus('disconnected');
    }

    send(data: string) {}

    setStatus(status: any) {
      this.status = status;
      this.handlers.statusChange.forEach((h) => h(status));
    }

    emitEnvelope(envelope: any) {
      this.handlers.envelope.forEach((h) => h(envelope));
    }

    emitError(error: Error) {
      this.handlers.error.forEach((h) => h(error));
    }

    async initReplay(script: string, sessionId: string, replaySpeed?: number) {
      return Promise.resolve({ status: 'success' as const, mode: 'replay' as const });
    }
  }

  return { TransportClient: MockTransportClient };
});

describe('Integration test suite', () => {
  let controller: ReplayController;

  beforeEach(() => {
    controller = new ReplayController({
      bridgeUrl: 'ws://localhost:8080/replay-v2',
    });
  });

  afterEach(() => {
    controller.disconnect().catch(() => {});
  });

  it('loads replay fixture successfully', () => {
    const fixture = loadFixture('captured/1775883989494');
    expect(fixture.sessionId).toBeDefined();
    expect(fixture.events.length).toBeGreaterThan(0);
  });

  it('replays fixture and verifies outcomes', async () => {
    const fixture = loadFixture('tool-calling/session-1');

    const runner = new ReplayRunner({
      controller,
      fixture,
      replaySpeed: 1.0,
    });

    const outcome = await runner.execute();

    assertReplaySuccess(outcome);
    assertHasSessionUpdates(outcome, {
      update: { type: 'tool_call' }
    });

    console.log(summarizeReplay(outcome));
  });
});
```

### Mock Transport Pattern

All integration tests mock `TransportClient` to avoid real network calls:

**Key requirements:**
1. Implement all public methods (`connect`, `disconnect`, `send`, `on`)
2. Support event emission (`emitEnvelope`, `emitError`)
3. Track status changes
4. Mock `initReplay()` for replay mode

**Template:**
```typescript
vi.mock('../../transport/client.js', () => {
  class MockTransportClient {
    public status: ConnectionStatus = 'disconnected';
    private handlers = { /* ... */ };

    on(event: string, handler: unknown): () => void { /* ... */ }
    connect() { /* ... */ }
    disconnect() { /* ... */ }
    send(data: string) { /* ... */ }
    emitEnvelope(envelope: any) { /* ... */ }
    emitError(error: Error) { /* ... */ }
    async initReplay(script: string, sessionId: string) { /* ... */ }
  }

  return { TransportClient: MockTransportClient };
});
```

---

## Test Data Setup

### Fixture Locations

**Captured fixtures:**
- Location: `fixtures/replay-data/captured/{timestamp}/`
- Source: Automatically captured from real ACP sessions
- Use case: Testing with production-like data

**Structured fixtures:**
- Location: `fixtures/replay-data/{demoType}/session-{n}/`
- Source: Manually curated scenarios
- Use case: Testing specific behaviors (tool calling, permissions, etc.)

### Creating New Fixtures

**Method 1: Capture from live session**

```typescript
import { DefaultSessionCaptureInterceptor } from '../../session/capture-interceptor.js';
import { SessionController } from '../../session/controller.js';

const controller = new SessionController('ws://localhost:8080');
const interceptor = new DefaultSessionCaptureInterceptor(controller);

// Start capture
interceptor.startCapture('session-123');

// ... interact with session ...

// Stop and export
const session = interceptor.stopCaptureAndExport('/tmp/capture');
console.log(`Captured ${session.events.length} events`);
```

**Method 2: Create structured fixture manually**

1. Create directory: `fixtures/replay-data/my-scenario/session-1/`
2. Create `replay-events.jsonl` with event lines
3. Create `manifest.json` with metadata:

```json
{
  "demoType": "my-scenario",
  "sessions": [
    {
      "sessionId": "session-123",
      "modes": ["coding"],
      "models": ["gpt-4"],
      "capturedAt": 1775883989494,
      "tokenCount": 1234,
      "eventCount": 50,
      "description": "My test scenario"
    }
  ]
}
```

4. Optionally add `session-data.json` for pre-existing state

### Listing Available Fixtures

```typescript
import { listFixtures } from '../../test-utils/fixture-loader.js';

const fixtures = listFixtures();
fixtures.forEach((f) => console.log(f));

// Output:
// captured/1775883968100
// captured/1775883989494
// tool-calling/session-1
// simple-thought/session-1
```

---

## Examples from Wave 3 Tests

### Session Lifecycle Test

**File:** `src/__tests__/integration/session-lifecycle.test.ts`

```typescript
describe('basic lifecycle with replay fixtures', () => {
  it('loads replay fixture successfully', () => {
    const fixture = loadFixture('captured/1775883989494');
    expect(fixture.sessionId).toBeDefined();
    expect(fixture.events.length).toBeGreaterThan(0);
  });

  it('can create ReplayRunner with fixture', () => {
    const fixture = loadFixture('captured/1775883989494');

    const runner = new ReplayRunner({
      controller,
      fixture,
      replaySpeed: 1.0,
      timeoutMs: 10000,
    });

    expect(runner).toBeDefined();
    expect(runner.getStatistics()).toBeDefined();
  });
});
```

### ACP Protocol Compliance Test

**File:** `src/__tests__/integration/acp-protocol.test.ts`

```typescript
describe('JSON-RPC format', () => {
  it('JSON-RPC request has required fields', () => {
    const payload = createACPPayload({
      id: 1,
      method: 'session/new',
      params: { cwd: '/test' },
    });

    expect(payload).toHaveProperty('jsonrpc', '2.0');
    expect(payload).toHaveProperty('id');
    expect(payload).toHaveProperty('method');
  });

  it('Bridge envelope wraps ACP payload correctly', () => {
    const acpPayload = createACPPayload({
      id: 1,
      method: 'session/new',
      params: { cwd: '/test' },
    });

    const envelope = createBridgeEnvelope({
      seq: 5,
      timestamp_ms: 1234567890,
      payload: acpPayload,
    });

    expect(envelope).toHaveProperty('version', 1);
    expect(envelope).toHaveProperty('seq', 5);
    expect(envelope.type).toBe('acp_payload');
  });
});
```

### Error Handling Test

**File:** `src/__tests__/integration/error-handling.test.ts`

```typescript
describe('network errors', () => {
  it('emits error event on WebSocket connection failure', async () => {
    const errorHandler = vi.fn();
    controller.on('error', errorHandler);

    mockTransport.setStatus('error');
    mockTransport.emitError(new Error('WebSocket connection failed'));

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'WebSocket connection failed' })
    );
  });

  it('rejects pending requests on disconnect', async () => {
    controller.connect();
    
    const initializePromise = controller.initialize({
      name: 'test-client',
      version: '1.0.0',
    });

    controller.disconnect();

    await expect(initializePromise).rejects.toThrow('Disconnected');
  });
});
```

### Connection Lifecycle Test

**File:** `src/__tests__/integration/connection-lifecycle.test.ts`

```typescript
describe('connection establishment', () => {
  it('establishes connection and transitions through states', () => {
    const transport = new TransportClient({
      url: 'ws://localhost:8080/test',
      reconnect: false,
    });

    const statusChanges: string[] = [];
    transport.on('statusChange', (status) => statusChanges.push(status));

    expect(transport.getStatus()).toBe('disconnected');

    transport.connect();
    expect(transport.getStatus()).toBe('connecting');

    createdWebSocket.onopen?.();
    expect(transport.getStatus()).toBe('connected');

    expect(statusChanges).toEqual(['connecting', 'connected']);
  });
});
```

### Capture/Replay Flow Test

**File:** `src/__tests__/integration/capture-replay-flow.test.ts`

```typescript
describe('session capture functionality', () => {
  it('starts capture and records traffic events', () => {
    interceptor.startCapture('session-123');

    const envelope: BridgeEnvelope = {
      version: 1,
      seq: 0,
      timestamp_ms: Date.now(),
      type: 'acp_payload',
      payload: {
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'session-123',
          update: { type: 'message', id: 'msg-1', content: 'Test' },
        },
      },
    };

    controller.emitTraffic('in', envelope);
    controller.emitTraffic('out', envelope);

    const session = interceptor.exportCapturedSession();
    
    expect(session.sessionId).toBe('session-123');
    expect(session.events).toHaveLength(2);
    expect(session.events[0]?.direction).toBe('in');
    expect(session.events[1]?.direction).toBe('out');
  });

  it('can replay captured session data', async () => {
    // Capture a session
    interceptor.startCapture('replay-test-session');
    
    // ... emit events ...
    
    interceptor.stopCapture();
    const captured = interceptor.exportCapturedSession();
    
    expect(captured.events).toHaveLength(2);
    expect(captured.sessionId).toBe('replay-test-session');
  });
});
```

---

## Best Practices

### 1. Use Replay Fixtures for Integration Tests

**Do:**
```typescript
const fixture = loadFixture('tool-calling/session-1');
const runner = new ReplayRunner({ controller, fixture });
const outcome = await runner.execute();
```

**Don't:**
```typescript
// Don't make real network calls in integration tests
const controller = new SessionController('ws://real-bridge:8080');
```

### 2. Mock TransportClient Consistently

Always mock at the top of test files:

```typescript
vi.mock('../../transport/client.js', () => {
  class MockTransportClient {
    // Full implementation with all methods
  }
  return { TransportClient: MockTransportClient };
});
```

### 3. Use Assertion Helpers

**Do:**
```typescript
assertReplaySuccess(outcome);
assertHasSessionUpdates(outcome, { update: { type: 'tool_call' } });
assertReplayStatistics(outcome, { minEvents: 10, maxErrors: 0 });
```

**Don't:**
```typescript
// Don't manually check every field
expect(outcome.success).toBe(true);
expect(outcome.error).toBeUndefined();
expect(outcome.sessionUpdates.length).toBeGreaterThan(0);
```

### 4. Test Both Success and Failure Scenarios

```typescript
// Success case
it('replays fixture successfully', async () => {
  const outcome = await runner.execute();
  assertReplaySuccess(outcome);
});

// Failure case
it('handles malformed fixture gracefully', async () => {
  const outcome = await runner.execute();
  assertReplayFailed(outcome, /parse error/);
});
```

### 5. Auto-Respond to Permissions When Appropriate

```typescript
// For tool-calling tests
const outcome = await runner
  .autoRespondToPermissions('approve')
  .execute();

assertPermissionRequestsHandled(outcome);
```

### 6. Verify Event Ordering

```typescript
assertSessionUpdateSequence(outcome, [
  'agent_thought_chunk',
  'tool_call',
  'message',
]);
```

### 7. Log Summaries for Debugging

```typescript
it('runs integration test', async () => {
  const outcome = await runner.execute();
  
  assertReplaySuccess(outcome);
  console.log(summarizeReplay(outcome));
  // Output:
  // Replay SUCCESS
  // Events: 50 (25 in, 25 out)
  // Tokens: 2345
  // Duration: 234ms
  // Session Updates: 15
  // Permission Requests: 3 (3 handled)
  // Update Types: agent_thought_chunk, tool_call, message
});
```

### 8. Keep Fixtures Small and Focused

Each fixture should test one scenario:
- `tool-calling/session-1`: Basic tool calling
- `simple-thought/session-1`: Single thought process
- `permission-request/session-1`: Permission handling

### 9. Use Descriptive Test Names

```typescript
// Good
it('loads replay fixture successfully');
it('emits error event on WebSocket connection failure');
it('replays fixture with pre-existing session state');

// Bad
it('test 1');
it('should work');
```

### 10. Clean Up Resources

```typescript
afterEach(() => {
  controller.disconnect().catch(() => {});
  vi.clearAllMocks();
});
```

---

## Quick Reference

### Import Statements

```typescript
import { ReplayController } from '../../session/replay-controller.js';
import { ReplayRunner } from '../../test-utils/replay-runner.js';
import { loadFixture, listFixtures } from '../../test-utils/fixture-loader.js';
import {
  assertReplaySuccess,
  assertHasSessionUpdates,
  assertReplayStatistics,
  summarizeReplay,
} from '../../test-utils/replay-assertions.js';
```

### Common Assertions

```typescript
assertReplaySuccess(outcome);
assertReplayFailed(outcome, /error pattern/);
assertHasSessionUpdates(outcome, { update: { type: 'tool_call' } });
assertSessionUpdateCount(outcome, { update: { type: 'message' } }, 3);
assertNoSessionUpdates(outcome, { update: { type: 'error' } });
assertPermissionRequestsHandled(outcome, 2);
assertReplayStatistics(outcome, { minEvents: 10, maxErrors: 0 });
assertSessionUpdateSequence(outcome, ['thought', 'tool_call']);
```

### ReplayRunner Methods

```typescript
const runner = new ReplayRunner({ controller, fixture });
await runner.execute();
runner.getSessionUpdates();
runner.getPermissionRequests();
runner.getStatistics();
runner.autoRespondToPermissions('approve');
```

---

## Related Documentation

- [Unit Testing Patterns](./unit-testing-patterns.md) - For unit test patterns
- [Session Management](./acp-chat-core-Session-Management.md) - For ReplayController API
- [Types Reference](./acp-chat-core-Types-Reference.md) - For type definitions
