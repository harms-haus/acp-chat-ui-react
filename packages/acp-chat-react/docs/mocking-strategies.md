# Mocking Strategies Guide

Comprehensive guide for mocking ACP core dependencies when testing React components.

## Table of Contents

- [Overview](#overview)
- [MockSessionController](#mocksessioncontroller)
- [mockStore Function](#mockstore-function)
- [mockChatCore Function](#mockchatcore-function)
- [Event Mocking](#event-mocking)
- [State Configuration](#state-configuration)
- [Real Test Examples](#real-test-examples)
- [Best Practices](#best-practices)

---

## Overview

ACP Chat React provides built-in mocking utilities to simplify testing. These utilities let you create realistic mock stores and controllers without implementing the full ACP protocol stack.

**Key benefits:**

- No need to mock the entire SessionController interface manually
- Pre-configured event emission for testing reactive updates
- Type-safe configuration with sensible defaults
- Consistent patterns across all test files

**Available utilities:**

| Export | Purpose |
|--------|---------|
| `MockSessionController` | Class that implements SessionController interface |
| `mockStore()` | Creates store + controller pair |
| `mockChatCore()` | Creates standalone controller |
| `createMockAcpStore()` | Alias for mockStore (semantic clarity) |

---

## MockSessionController

The `MockSessionController` class provides a fully functional mock of the core SessionController.

### Basic Usage

```typescript
import { MockSessionController } from '@/test-utils/mocks.js';

const controller = new MockSessionController();
```

### Default State

The controller starts with these default values:

```typescript
{
  connectionStatus: 'disconnected',
  bridgeStatus: 'disconnected',
  sessionId: null,
  initialized: false,
  capabilities: null,
}
```

### Event Emission

The mock controller supports all standard ACP events. Emit events to trigger component updates:

```typescript
// Emit status change
controller.emitStatus();

// Emit session update
controller.emitSessionUpdate({ sessionId: 'new-session' });

// Emit error
controller.emitError(new Error('Connection failed'));

// Emit session clearing
controller.emitSessionClearing();

// Emit permission request
controller.emitPermissionRequest({
  sessionId: 'session-123',
  toolCall: { toolCallId: 'tool-456' },
  options: [
    { optionId: 'approve', name: 'Approve', kind: 'allow_once' },
    { optionId: 'deny', name: 'Deny', kind: 'deny' },
  ],
});
```

### Manual State Changes

Update state directly and emit events:

```typescript
controller.state.connectionStatus = 'connected';
controller.state.bridgeStatus = 'connected';
controller.state.initialized = true;
controller.state.sessionId = 'test-session-123';

// Notify all listeners
controller.emitStatus();
```

### Connection Helpers

Use convenience methods for connection state:

```typescript
controller.connect();   // Sets status to 'connected' and emits
controller.disconnect(); // Sets status to 'disconnected' and emits
```

---

## mockStore Function

The `mockStore()` function creates both a mock store and controller together.

### Basic Usage

```typescript
import { mockStore } from '@/test-utils/mocks.js';

const { store, controller } = mockStore();
```

### Configuration Options

```typescript
import { mockStore } from '@/test-utils/mocks.js';

const { store, controller } = mockStore({
  // Initial session state overrides
  sessionState: {
    initialized: true,
    sessionId: 'test-123',
    connectionStatus: 'connected',
  },
  
  // Store configuration
  storeConfig: {
    notificationCadenceMs: 0,  // Immediate notifications (default for tests)
    enableBatching: false,      // Disable batching (default for tests)
  },
});
```

### Usage with customRender

```typescript
import { mockStore, customRender } from '@/test-utils';
import { Composer } from './Composer.js';

test('renders composer with mock store', () => {
  const { store, controller } = mockStore({
    sessionState: { initialized: true, sessionId: 'test-123' }
  });

  customRender(<Composer store={store} controller={controller} />);
});
```

### Return Value

The function returns an object with both store and controller:

```typescript
{
  store: AcpStore;       // Use for component props
  controller: MockSessionController; // Use for event emission
}
```

---

## mockChatCore Function

The `mockChatCore()` function creates a standalone mock controller without a store.

### Basic Usage

```typescript
import { mockChatCore } from '@/test-utils/mocks.js';

const controller = mockChatCore();
```

### With Initial State

```typescript
const controller = mockChatCore({
  initialized: true,
  sessionId: 'session-456',
  connectionStatus: 'connected',
  bridgeStatus: 'ready',
});
```

### When to Use

Use `mockChatCore()` when:

- You need only the controller (no store)
- Testing low-level controller behavior
- Creating custom store configurations
- Testing hooks that use controller directly

---

## Event Mocking

Test how components respond to ACP events by emitting from the mock controller.

### Testing Status Changes

```typescript
import { mockStore, customRender } from '@/test-utils';
import { Composer } from './Composer.js';
import { screen, waitFor } from '@testing-library/react';

test('disables input when disconnected', async () => {
  const { store, controller } = mockStore({
    sessionState: { initialized: true, connectionStatus: 'connected' }
  });

  customRender(<Composer store={store} controller={controller} />);

  const input = screen.getByLabelText('Message input');
  expect(input).not.toBeDisabled();

  // Simulate disconnection
  controller.disconnect();

  await waitFor(() => {
    expect(input).toBeDisabled();
  });
});
```

### Testing Error Handling

```typescript
test('shows error message on connection error', async () => {
  const { store, controller } = mockStore();

  customRender(<ConnectionStatus controller={controller} />);

  // Emit error event
  controller.emitError(new Error('Network timeout'));

  await waitFor(() => {
    expect(screen.getByText('Connection error')).toBeInTheDocument();
  });
});
```

### Testing Permission Requests

```typescript
test('shows permission request dialog', async () => {
  const { store, controller } = mockStore({
    sessionState: { sessionId: 'session-123' }
  });

  customRender(<PermissionHandler controller={controller} />);

  controller.emitPermissionRequest({
    sessionId: 'session-123',
    toolCall: { toolCallId: 'tool-456' },
    options: [
      { optionId: 'approve', name: 'Approve', kind: 'allow_once' },
      { optionId: 'deny', name: 'Deny', kind: 'deny' },
    ],
  });

  await waitFor(() => {
    expect(screen.getByText('Permission Required')).toBeInTheDocument();
  });
});
```

### Testing Session Updates

```typescript
test('updates UI on session change', async () => {
  const { store, controller } = mockStore();

  customRender(<SessionInfo controller={controller} />);

  expect(screen.getByText('No session')).toBeInTheDocument();

  controller.emitSessionUpdate({
    sessionId: 'new-session',
    initialized: true,
  });

  await waitFor(() => {
    expect(screen.getByText('Session: new-session')).toBeInTheDocument();
  });
});
```

---

## State Configuration

Configure initial state for different test scenarios.

### Connected State

```typescript
const { store, controller } = mockStore({
  sessionState: {
    connectionStatus: 'connected',
    bridgeStatus: 'ready',
    sessionId: 'test-session',
    initialized: true,
    capabilities: null,
  },
});
```

### Disconnected State

```typescript
const { store, controller } = mockStore({
  sessionState: {
    connectionStatus: 'disconnected',
    bridgeStatus: 'disconnected',
    sessionId: null,
    initialized: false,
  },
});
```

### Partial State Overrides

Only specify what you need to change:

```typescript
// Just change initialization state
const { controller } = mockStore({
  sessionState: { initialized: true }
});

// Just change session ID
const { controller } = mockStore({
  sessionState: { sessionId: 'custom-session-id' }
});

// Just change connection status
const { controller } = mockStore({
  sessionState: { connectionStatus: 'connecting' }
});
```

### Testing Disabled States

Test components with different session states:

```typescript
test('disables when not connected', () => {
  const { store, controller } = mockStore({
    sessionState: { connectionStatus: 'disconnected' }
  });

  customRender(<Composer store={store} controller={controller} />);
  expect(screen.getByLabelText('Message input')).toBeDisabled();
});

test('disables when not initialized', () => {
  const { store, controller } = mockStore({
    sessionState: { initialized: false }
  });

  customRender(<Composer store={store} controller={controller} />);
  expect(screen.getByLabelText('Message input')).toBeDisabled();
});

test('disables when no session', () => {
  const { store, controller } = mockStore({
    sessionState: { sessionId: null }
  });

  customRender(<Composer store={store} controller={controller} />);
  expect(screen.getByLabelText('Message input')).toBeDisabled();
});
```

---

## Real Test Examples

### Example 1: Composer Component Test

From `composer-flow.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Composer } from './Composer.js';
import { mockStore } from '@/test-utils';

describe('Composer Component', () => {
  let store: ReturnType<typeof mockStore>['store'];
  let controller: ReturnType<typeof mockStore>['controller'];

  beforeEach(() => {
    const mock = mockStore({
      sessionState: {
        connectionStatus: 'connected',
        bridgeStatus: 'ready',
        sessionId: 'test-session-123',
        initialized: true,
      },
    });
    store = mock.store;
    controller = mock.controller;
  });

  it('calls sendPrompt on Enter key', async () => {
    const onSend = vi.fn();
    render(<Composer store={store} controller={controller} onSend={onSend} />);

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(controller.sendPrompt).toHaveBeenCalledWith(
        'test-session-123',
        'Test message'
      );
    });
    expect(onSend).toHaveBeenCalledWith('Test message');
  });

  it('clears input after sending', async () => {
    render(<Composer store={store} controller={controller} />);

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });
});
```

### Example 2: Settings Panel Test

From `settings-controls.test.tsx`:

```typescript
import { mockChatCore } from '@/test-utils';
import { SettingsPanel } from './SettingsPanel.js';
import { render, waitFor, screen } from '@testing-library/react';
import { useSettings } from '../hooks/useSettings.js';

test('fetches sessions from controller', async () => {
  const controller = mockChatCore({
    initialized: true,
    connectionStatus: 'connected',
  });

  function TestComponent() {
    const { state } = useSettings({ controller });
    return (
      <div>
        <span data-testid="sessions-count">{state.sessions.length}</span>
      </div>
    );
  }

  render(<TestComponent />);

  await waitFor(() => {
    expect(screen.getByTestId('sessions-count').textContent).toBe('2');
  });
});
```

### Example 3: Manual Controller Creation

When you need more control:

```typescript
import { MockSessionController } from '@/test-utils/mocks.js';
import { createAcpStore } from '../store/index.js';
import type { SessionControllerState } from '@harms-haus/acp-chat-core';

function createCustomMock(overrides: Partial<SessionControllerState>) {
  const controller = new MockSessionController();
  
  controller.state = {
    ...controller.state,
    ...overrides,
  };

  const store = createAcpStore(controller, {
    notificationCadenceMs: 0,
    enableBatching: false,
  });

  return { store, controller };
}

// Usage
const { store, controller } = createCustomMock({
  connectionStatus: 'connected',
  sessionId: 'custom-session',
});
```

---

## Best Practices

### 1. Use mockStore for Most Tests

Prefer `mockStore()` over manual controller creation:

```typescript
// ✅ Good
const { store, controller } = mockStore({
  sessionState: { initialized: true }
});

// ❌ Verbose
const controller = { /* manual mock */ };
const store = createAcpStore(controller);
```

### 2. Configure State at Creation Time

Set initial state in the config, not after:

```typescript
// ✅ Clear intent
const { controller } = mockStore({
  sessionState: { connectionStatus: 'disconnected' }
});

// ❌ Extra steps
const { controller } = mockStore();
controller.state.connectionStatus = 'disconnected';
controller.emitStatus();
```

### 3. Use Semantic Aliases

Choose the function that matches your intent:

```typescript
// Need both store and controller
const { store, controller } = mockStore();

// Need only controller
const controller = mockChatCore();

// Want semantic clarity
const { store, controller } = createMockAcpStore();
```

### 4. Test State Transitions

Verify components respond to state changes:

```typescript
test('updates on connection change', async () => {
  const { store, controller } = mockStore({
    sessionState: { connectionStatus: 'connected' }
  });

  render(<ConnectionIndicator controller={controller} />);
  expect(screen.getByText('Connected')).toBeInTheDocument();

  controller.disconnect();
  await waitFor(() => {
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});
```

### 5. Keep Mocks Minimal

Only override what your test needs:

```typescript
// ✅ Focused test
const { controller } = mockStore({
  sessionState: { initialized: false }
});

// ❌ Over-specified
const { controller } = mockStore({
  sessionState: {
    connectionStatus: 'disconnected',
    bridgeStatus: 'disconnected',
    sessionId: null,
    initialized: false,
    capabilities: null,
  },
});
```

### 6. Reuse Common Configurations

Create helper functions for repeated patterns:

```typescript
// In your test setup file
function createConnectedMock() {
  return mockStore({
    sessionState: {
      connectionStatus: 'connected',
      bridgeStatus: 'ready',
      sessionId: 'test-session',
      initialized: true,
    },
  });
}

// In your tests
const { store, controller } = createConnectedMock();
```

### 7. Combine with Factory Functions

Use factory functions with mock stores:

```typescript
import { mockStore, createMockMessage } from '@/test-utils';

test('renders messages from store', () => {
  const { store } = mockStore();
  const message = createMockMessage({
    role: 'user',
    content: 'Hello world',
  });

  // Add message to store if needed
  // Test rendering
});
```

---

## Quick Reference

### Creating Mocks

```typescript
// Store + controller pair
const { store, controller } = mockStore();

// With initial state
const { store, controller } = mockStore({
  sessionState: { initialized: true, sessionId: 'test' }
});

// Controller only
const controller = mockChatCore({ initialized: true });

// Manual creation
const controller = new MockSessionController();
```

### Emitting Events

```typescript
controller.emitStatus();
controller.emitSessionUpdate(params);
controller.emitError(error);
controller.emitSessionClearing();
controller.emitPermissionRequest(params);
```

### Changing State

```typescript
// Direct state change
controller.state.connectionStatus = 'connected';
controller.emitStatus();

// Use helpers
controller.connect();
controller.disconnect();
```

---

## Related Documentation

- [Component Testing Guide](./component-testing.md) - General testing patterns
- [CSS Variables](./CSS-VARIABLES.md) - Styling customization
- [ACP Protocol](../../docs/wiki/ACP-Protocol.md) - Core protocol reference
