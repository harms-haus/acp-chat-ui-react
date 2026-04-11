# Testing Strategy - ACP Chat Core

This document outlines the testing strategy, philosophy, and patterns for the ACP Chat Core library.

---

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Pyramid](#test-pyramid)
- [Test Organization](#test-organization)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Mocking Patterns](#mocking-patterns)
- [Running Tests](#running-tests)

---

## Testing Philosophy

### Behavior Over Implementation

We test **what the code does**, not **how it does it**. This means:

- Test public APIs and observable behavior
- Don't test private methods directly
- Focus on inputs and outputs, not internal state
- Tests should remain valid even if internal implementation changes

**Example:**

```typescript
// GOOD: Test observable behavior
it('connects and updates connectionStatus to connected', () => {
  controller.connect();
  expect(controller.getState().connectionStatus).toBe('connected');
});

// BAD: Testing internal implementation details
it('sets the private transport status field', () => {
  expect((controller as any).transport.status).toBe('connected');
});
```

### Tests as Documentation

Well-written tests serve as living documentation:

- Clear test names describe expected behavior
- Examples show how to use the API
- Edge cases document known limitations

### Fast and Isolated

- Unit tests run in isolation, no external dependencies
- Integration tests use replay fixtures, not live servers
- All tests must be deterministic and repeatable

---

## Test Pyramid

Our testing follows the classic test pyramid:

```
         /\
        /  \       Integration Tests
       /----\      (20% of tests)
      /      \
     /--------\    Unit Tests
    /          \   (80% of tests)
   /------------\
```

### Unit Tests (80%)

**Purpose:** Verify individual components in isolation.

**Characteristics:**
- Fast execution (< 10ms per test)
- Mock external dependencies
- Test single responsibilities
- Located alongside source: `src/*.test.ts`

**Examples:**
- `src/session/session-controller.test.ts` - SessionController API
- `src/transport/client.test.ts` - TransportClient connection logic
- `src/helpers/composer-logic.test.ts` - Pure helper functions

### Integration Tests (20%)

**Purpose:** Verify components work together correctly.

**Characteristics:**
- Test full workflows and scenarios
- Use replay fixtures for deterministic behavior
- Located in `src/__tests__/integration/`

**Examples:**
- `src/__tests__/integration/session-lifecycle.test.ts` - Full session flow
- `src/__tests__/integration/acp-protocol.test.ts` - Protocol compliance
- `src/__tests__/integration/error-handling.test.ts` - Error scenarios

---

## Test Organization

### File Structure

```
packages/acp-chat-core/
├── src/
│   ├── session/
│   │   ├── controller.ts           # Source code
│   │   └── controller.test.ts      # Unit tests (same directory)
│   ├── transport/
│   │   ├── client.ts
│   │   └── client.test.ts
│   ├── helpers/
│   │   ├── composer-logic.ts
│   │   └── composer-logic.test.ts
│   ├── __tests__/
│   │   ├── integration/            # Integration tests
│   │   │   ├── session-lifecycle.test.ts
│   │   │   ├── acp-protocol.test.ts
│   │   │   └── error-handling.test.ts
│   │   ├── capture-interceptor.test.ts
│   │   └── replay-controller.test.ts
│   └── test-utils/                 # Test utilities (NOT exported from main index)
│       ├── index.ts
│       ├── fixtures.ts
│       ├── mocks.ts
│       ├── factories.ts
│       ├── replay-runner.ts
│       └── replay-assertions.ts
└── TESTING.md                      # This file
```

### Naming Conventions

- **Unit tests:** `*.test.ts` alongside source files
- **Integration tests:** `src/__tests__/integration/*.test.ts`
- **Test utilities:** `src/test-utils/*.ts` (not exported from main package)

### Why This Structure?

1. **Co-location:** Unit tests live next to the code they test, making it easy to find and update both together.

2. **Separation:** Integration tests in `__tests__/` directories signal they test broader scenarios.

3. **Utilities isolated:** Test utilities in `test-utils/` are never exported from the main `index.ts`, keeping the public API clean.

---

## Unit Testing

### Writing Unit Tests

**Basic structure:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionController } from './controller.js';

describe('SessionController', () => {
  let controller: SessionController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SessionController('ws://localhost:8080/bridge');
  });

  it('initializes with disconnected state', () => {
    const state = controller.getState();
    expect(state.connectionStatus).toBe('disconnected');
    expect(state.sessionId).toBeNull();
  });
});
```

### Testing Event Emitters

ACP Chat Core uses event-based APIs. Test event emission like this:

```typescript
it('emits statusChange on connection state changes', () => {
  const statusHandler = vi.fn();
  controller.on('statusChange', statusHandler);

  controller.connect();
  controller.disconnect();

  expect(statusHandler).toHaveBeenCalledTimes(2);
  expect(statusHandler).toHaveBeenNthCalledWith(1, expect.objectContaining({
    connectionStatus: 'connected',
  }));
});
```

### Testing Async Operations

For methods that return promises:

```typescript
it('initialize sends request and sets initialized flag', async () => {
  const mockTransport = getMockTransport();

  // Start initialize
  const initPromise = controller.initialize({
    name: 'test-client',
    version: '1.0.0',
  });

  // Extract request ID and simulate response
  const requestId = getLastRequestId();
  simulateResponse(requestId, {
    capabilities: { maxTokens: 4096 },
  });

  const result = await initPromise;

  expect(controller.getState().initialized).toBe(true);
  expect(result.capabilities).toEqual({ maxTokens: 4096 });
});
```

### Using Test Factories

The `factories.ts` module provides helpers for creating test data:

```typescript
import {
  createBridgeEnvelope,
  createACPPayloadNotification,
  createSessionUpdateEnvelope,
} from './test-utils/factories.js';

it('handles session update notifications', () => {
  const envelope = createSessionUpdateEnvelope({
    sessionId: 'test-session',
    update: { type: 'message', content: 'Hello' },
    seq: 1,
  });

  mockTransport.emitEnvelope(envelope);

  expect(sessionUpdateHandler).toHaveBeenCalledWith({
    sessionId: 'test-session',
    update: { type: 'message', content: 'Hello' },
  });
});
```

---

## Integration Testing

### Replay-Based Testing

Integration tests use **replay fixtures** to test full workflows without requiring a live WebSocket server.

**Fixture format:**

Fixtures are stored in `fixtures/replay-data/captured/{timestamp}/`:
- `session-data.json` - Session metadata
- `replay-events.jsonl` - JSONL file with captured events

### Using ReplayRunner

```typescript
import { ReplayRunner } from './test-utils/replay-runner.js';
import { loadFixture } from './test-utils/fixture-loader.js';
import {
  assertReplaySuccess,
  assertHasSessionUpdates,
  assertReplayStatistics,
} from './test-utils/replay-assertions.js';

it('executes replay fixture successfully', async () => {
  // Load fixture
  const fixture = loadFixture('captured/1775883989494');

  // Create and run replay
  const runner = new ReplayRunner({
    controller,
    fixture,
    replaySpeed: 1.0,
    timeoutMs: 10000,
  });

  const outcome = await runner.execute();

  // Assert success
  assertReplaySuccess(outcome);

  // Assert specific behaviors
  assertHasSessionUpdates(outcome, {
    update: { type: 'agent_thought_chunk' },
  });

  // Assert statistics
  assertReplayStatistics(outcome, {
    minEvents: 10,
    minTokens: 100,
    maxErrors: 0,
  });
});
```

### Integration Test Patterns

1. **Load fixture** - Use `loadFixture()` to load replay data
2. **Create runner** - Configure `ReplayRunner` with controller and fixture
3. **Execute** - Run the replay with `runner.execute()`
4. **Assert** - Use assertion helpers to verify outcomes

### Assertion Helpers

The `replay-assertions.ts` module provides:

```typescript
// Success/failure checks
assertReplaySuccess(outcome);
assertReplayFailed(outcome, /error pattern/);

// Session update assertions
assertHasSessionUpdates(outcome, filter, minCount);
assertSessionUpdateCount(outcome, filter, exactCount);
assertNoSessionUpdates(outcome, filter);
assertSessionUpdateSequence(outcome, ['type1', 'type2']);

// Permission request assertions
assertPermissionRequestsHandled(outcome, minCount);
assertPermissionRequestHasOption(outcome, 'allow_once');

// Statistics assertions
assertReplayStatistics(outcome, {
  minEvents: 10,
  maxEvents: 100,
  minTokens: 100,
  maxDurationMs: 5000,
  maxErrors: 0,
});

// Utility functions
filterSessionUpdates(updates, filter);
findFirstSessionUpdate(outcome, filter);
getUpdateTypes(outcome);
summarizeReplay(outcome);
```

---

## Mocking Patterns

### When to Use Mocks

**Use mocks when:**
- Testing in isolation (unit tests)
- External dependency is slow or unreliable
- You need to simulate edge cases (errors, timeouts)
- Testing event emission and subscription

**Don't use mocks when:**
- Testing integration between real components
- The dependency is fast and deterministic
- You want to test actual behavior (use replay fixtures instead)

### Mock TransportClient

For unit tests, mock the TransportClient:

```typescript
vi.mock('../transport/client.js', () => {
  class MockTransportClient {
    public status = 'disconnected';
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
        // Unsubscribe using the same switch as subscribe to match handler sets
        switch (event) {
          case 'statusChange':
            this.handlers.statusChange.delete(handler as any);
            break;
          case 'envelope':
            this.handlers.envelope.delete(handler as any);
            break;
          case 'error':
            this.handlers.error.delete(handler as any);
            break;
        }
      };
    }

    connect() {
      this.status = 'connected';
      this.handlers.statusChange.forEach(h => h('connected'));
    }

    emitEnvelope(envelope: any) {
      this.handlers.envelope.forEach(h => h(envelope));
    }

    // ... implement other methods
  }

  return { TransportClient: MockTransportClient };
});
```

### Using Mock Factories

The `mocks.ts` module provides pre-built mock factories:

```typescript
import {
  createMockTransport,
  createMockController,
} from './test-utils/mocks.js';

it('uses mock transport', () => {
  const mockTransport = createMockTransport({
    url: 'ws://test:8080',
  });

  mockTransport.connect();
  expect(mockTransport.status).toBe('connected');

  // Simulate receiving envelope
  const envelope = createBridgeEnvelope({
    payload: { jsonrpc: '2.0', id: 1, result: {} },
  });
  mockTransport.emitEnvelope(envelope);
});
```

### Mock vs Real Objects

| Scenario | Use |
|----------|-----|
| Testing single method logic | Mock |
| Testing event emission | Mock |
| Testing error handling | Mock |
| Testing full workflow | Replay fixture |
| Testing protocol compliance | Replay fixture |
| Testing component integration | Replay fixture |

---

## Running Tests

### Commands

```bash
# Run all tests
pnpm test-core

# Run with coverage
pnpm test-core:coverage

# Run specific test file
pnpm vitest run packages/acp-chat-core/src/session/controller.test.ts

# Watch mode for development
pnpm vitest --filter=acp-chat-core

# Run only integration tests
pnpm vitest run packages/acp-chat-core/src/__tests__/integration/
```

### Coverage Thresholds

The project enforces coverage thresholds:

- **Lines:** 80% minimum
- **Branches:** 75% minimum
- **Functions:** 80% minimum

After running `pnpm test-core:coverage`, check:
- `coverage/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI

### Coverage Report Example

```
=============================== Coverage summary ===============================
Statements   : 85.2% ( 1234/1448 )
Branches     : 78.5% ( 456/581 )
Functions    : 82.1% ( 234/285 )
Lines        : 84.8% ( 1198/1412 )
================================================================================
```

---

## Adding New Tests

### Checklist for New Test Files

1. **Choose location:**
   - Unit test: `src/module-name/file.test.ts`
   - Integration test: `src/__tests__/integration/feature.test.ts`

2. **Import test utilities:**
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { createBridgeEnvelope } from '../../test-utils/factories.js';
   ```

3. **Set up mocks (if unit test):**
   ```typescript
   vi.mock('../transport/client.js', () => {
     // Mock implementation
   });
   ```

4. **Write tests following patterns:**
   - Clear, descriptive test names
   - Arrange-Act-Assert structure
   - Test one behavior per test case

5. **Run and verify:**
   ```bash
   pnpm vitest run path/to/test.test.ts
   ```

### Example: Adding a Unit Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MyNewClass } from './my-new-class.js';

describe('MyNewClass', () => {
  it('does something useful', () => {
    const instance = new MyNewClass();
    const result = instance.doSomething('input');
    expect(result).toBe('expected output');
  });

  it('handles edge case: empty input', () => {
    const instance = new MyNewClass();
    const result = instance.doSomething('');
    expect(result).toBe('default output');
  });
});
```

### Example: Adding an Integration Test

```typescript
import { describe, it, expect } from 'vitest';
import { ReplayRunner } from '../../test-utils/replay-runner.js';
import { loadFixture } from '../../test-utils/fixture-loader.js';
import { assertReplaySuccess } from '../../test-utils/replay-assertions.js';

describe('New feature integration', () => {
  it('handles new feature scenario', async () => {
    const fixture = loadFixture('captured/new-feature-scenario');
    const runner = new ReplayRunner({ controller, fixture });
    const outcome = await runner.execute();

    assertReplaySuccess(outcome);
    // Add more specific assertions...
  });
});
```

---

## Troubleshooting

### Tests Not Running

**Problem:** Vitest can't find test files.

**Solution:** Check `vitest.config.ts` include patterns:
```typescript
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
  },
});
```

### Mock Not Working

**Problem:** Mocked module still uses real implementation.

**Solution:**
- Ensure `vi.mock()` is at the top of the file (before imports)
- Check module path is correct (relative to test file)
- Use `vi.clearAllMocks()` in `beforeEach`

### Replay Fixture Not Found

**Problem:** `loadFixture()` throws "Fixture not found".

**Solution:**
- Check fixture path: `fixtures/replay-data/captured/{timestamp}/`
- Verify both `session-data.json` and `replay-events.jsonl` exist
- Use `listFixtures()` to see available fixtures

### Coverage Below Threshold

**Problem:** Coverage report shows < 80%.

**Solution:**
- Run `pnpm test-core:coverage`
- Open `coverage/index.html`
- Find uncovered files/lines (highlighted in red)
- Add tests for uncovered code paths

---

## Resources

- **Vitest Documentation:** https://vitest.dev/
- **Test Utilities:** `src/test-utils/`
- **Example Tests:** `src/session/session-controller.test.ts`
- **Integration Examples:** `src/__tests__/integration/`

---

**Last Updated:** April 2026  
**Maintained By:** ACP Chat Core Team
