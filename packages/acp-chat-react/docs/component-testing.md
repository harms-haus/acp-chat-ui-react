# Component Testing Guide

Testing guide for ACP Chat React components using React Testing Library and Vitest.

## Table of Contents

- [Setup](#setup)
- [Rendering Components](#rendering-components)
- [Querying Elements](#querying-elements)
- [User Events](#user-events)
- [Common Patterns](#common-patterns)

---

## Setup

### Test Environment

ACP Chat React uses Vitest with jsdom for component testing. Tests run in a browser-like environment.

**vitest.config.ts:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

### Required Dependencies

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "vitest": "^2.1.0",
    "jsdom": "^29.0.1"
  }
}
```

### Import Setup

Every test file needs these imports:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
```

---

## Rendering Components

### Basic Rendering

Use the standard `render` function from React Testing Library:

```typescript
import { render, screen } from '@testing-library/react';
import { Composer } from './Composer.js';

it('renders composer with input', () => {
  render(<Composer store={mockStore} controller={mockController} />);
  
  const input = screen.getByLabelText('Message input');
  expect(input).toBeInTheDocument();
});
```

### Creating Mock Objects

Most components require a mock store and controller. Create helpers for reuse:

```typescript
import { vi } from 'vitest';
import type { AcpStore, AcpStoreSnapshot } from '../store/index.js';
import type { SessionController, SessionControllerState } from '@harms-haus/acp-chat-core';

function createMockStore(overrides: Partial<SessionControllerState> = {}): AcpStore {
  const sessionState: SessionControllerState = {
    connectionStatus: 'connected',
    bridgeStatus: 'ready',
    sessionId: 'test-session-123',
    initialized: true,
    capabilities: null,
    ...overrides,
  };

  const snapshot: AcpStoreSnapshot = {
    session: sessionState,
    messages: new Map(),
    thoughts: new Map(),
    toolCalls: new Map(),
    permissionRequests: new Map(),
    timelineOrder: [],
    turnIdToMessageId: new Map(),
    version: 0,
  };

  return {
    getSessionState: () => sessionState,
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    getServerSnapshot: () => snapshot,
  } as unknown as AcpStore;
}

function createMockController(): SessionController {
  return {
    getState: () => ({
      connectionStatus: 'connected',
      bridgeStatus: 'ready',
      sessionId: 'test-session-123',
      initialized: true,
      capabilities: null,
    }),
    on: () => () => {},
    sendPrompt: vi.fn().mockResolvedValue(undefined),
    cancelPrompt: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    disconnect: vi.fn(),
    initialize: vi.fn(() => Promise.resolve({})),
    createSession: vi.fn(() => Promise.resolve({ sessionId: 'test-session' })),
    listSessions: vi.fn(() =>
      Promise.resolve({
        sessions: [
          {
            sessionId: 'session-1',
            cwd: '/home/user/project1',
            title: 'Project 1 Session',
            updatedAt: '2026-03-28T10:00:00Z',
          },
        ],
        nextCursor: undefined,
      })
    ),
    loadSession: vi.fn(() => Promise.resolve({})),
  } as unknown as SessionController;
}
```

### Rendering with Props

```typescript
it('shows custom placeholder', () => {
  render(
    <Composer
      store={mockStore}
      controller={mockController}
      placeholder="Custom placeholder"
    />
  );

  const input = screen.getByLabelText('Message input');
  expect(input).toHaveAttribute('placeholder', 'Custom placeholder');
});
```

### Testing Disabled States

Test components with different store states to verify disabled behavior:

```typescript
it('disables when not connected', () => {
  const disconnectedStore = createMockStore({ connectionStatus: 'disconnected' });
  
  render(<Composer store={disconnectedStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');
  expect(input).toBeDisabled();
});

it('disables when not initialized', () => {
  const uninitializedStore = createMockStore({ initialized: false });
  
  render(<Composer store={uninitializedStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');
  expect(input).toBeDisabled();
});

it('disables when no session', () => {
  const noSessionStore = createMockStore({ sessionId: null });
  
  render(<Composer store={noSessionStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');
  expect(input).toBeDisabled();
});
```

---

## Querying Elements

### Selector Convention (CRITICAL)

All interactive elements use `data-acp-*` attributes for reliable test targeting. Use these selectors instead of CSS classes or DOM structure.

| Selector | Element |
|----------|---------|
| `data-acp-root` | Root container |
| `data-acp-message` | Message item |
| `data-acp-message-role` | Message role (user/agent) |
| `data-acp-message-id` | Message ID attribute |
| `data-acp-message-status` | Message status indicator |
| `data-acp-thought` | Thought block |
| `data-acp-thought-root` | Thought stack root |
| `data-acp-thought-trigger` | Thought expand trigger |
| `data-acp-thought-group-id` | Thought group identifier |
| `data-acp-tool-call` | Tool call item |
| `data-acp-tool-call-root` | Tool call root |
| `data-acp-tool-call-id` | Tool call ID |
| `data-acp-tool-call-kind` | Tool call type |
| `data-acp-tool-call-status` | Tool call status |
| `data-acp-input` | Input field |
| `data-acp-send` | Send button |
| `data-acp-composer-input` | Composer input |
| `data-acp-composer-has-settings` | Settings row presence |
| `data-acp-settings-panel` | Settings panel root |
| `data-acp-settings-select-trigger` | Settings selector trigger |
| `data-acp-settings-select-input` | Settings selector input |
| `data-acp-slash-popover` | Slash command popover |
| `data-acp-slash-item-id` | Slash command item |
| `data-acp-message-action-bar` | Message action bar |
| `data-acp-message-action-id` | Message action button |
| `data-acp-content-type` | Content block type |

### Using data-acp Selectors

Query using attribute selectors:

```typescript
import { screen } from '@testing-library/react';

it('has correct data attributes', () => {
  render(<MessageCard message={mockMessage} />);

  const card = screen.getByText('Hello, this is a test message')
    .closest('[data-acp-message-role]');
  
  expect(card).toBeTruthy();
  expect(card?.getAttribute('data-acp-message-role')).toBe('user');
  expect(card?.getAttribute('data-acp-message-id')).toBe('msg_1');
});
```

### Container Queries

For elements not easily found by text or role, use container queries:

```typescript
it('has data-acp-settings-panel attribute', () => {
  const { container } = render(<SettingsPanel controller={mockController} />);

  expect(container.querySelector('[data-acp-settings-panel]')).not.toBeNull();
});

it('has data-acp-settings-select-trigger attributes', () => {
  const { container } = render(<SettingsPanel controller={mockController} />);

  expect(container.querySelector('[data-acp-settings-select-trigger="mode"]')).not.toBeNull();
  expect(container.querySelector('[data-acp-settings-select-trigger="model"]')).not.toBeNull();
});
```

### Query by Role and Label

Prefer accessible queries when available:

```typescript
it('renders input with label', () => {
  render(<Composer store={mockStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');
  expect(input).toBeInTheDocument();
});

it('renders expand button', async () => {
  render(<ThoughtStack group={group} defaultOpen={false} />);

  const trigger = screen.getByText('1 thought');
  fireEvent.click(trigger);

  const expandButton = screen.getByRole('button', { name: /thinking/i });
  expect(expandButton).toBeInTheDocument();
});
```

### Query by Test ID

For custom elements without standard roles:

```typescript
it('renders custom settings row', () => {
  const customSettingsRow = vi.fn(() => (
    <div data-testid="custom-settings">Custom Settings</div>
  ));

  render(
    <Composer
      store={mockStore}
      controller={mockController}
      renderSettingsRow={customSettingsRow}
    />
  );

  expect(screen.getByTestId('custom-settings')).toBeInTheDocument();
});
```

---

## User Events

### FireEvent for User Interactions

Use `fireEvent` to simulate user actions:

```typescript
import { fireEvent } from '@testing-library/react';

it('updates value on input change', () => {
  render(<Composer store={mockStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');
  fireEvent.change(input, { target: { value: 'Hello World' } });

  expect(input).toHaveValue('Hello World');
});

it('calls sendPrompt on Enter key', async () => {
  const onSend = vi.fn();
  render(<Composer store={mockStore} controller={mockController} onSend={onSend} />);

  const input = screen.getByLabelText('Message input');
  fireEvent.change(input, { target: { value: 'Test message' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

  await waitFor(() => {
    expect(mockController.sendPrompt).toHaveBeenCalledWith('test-session-123', 'Test message');
  });
  expect(onSend).toHaveBeenCalledWith('Test message');
});
```

### Keyboard Events

Test keyboard interactions with proper event objects:

```typescript
it('does not send on Shift+Enter', () => {
  render(<Composer store={mockStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');
  fireEvent.change(input, { target: { value: 'Test message' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

  expect(mockController.sendPrompt).not.toHaveBeenCalled();
});

it('does not send on Escape key', () => {
  render(<Composer store={mockStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');
  fireEvent.change(input, { target: { value: 'Test' } });
  fireEvent.keyDown(input, { key: 'Escape' });

  expect(mockController.sendPrompt).not.toHaveBeenCalled();
});
```

### Composition Events

Handle IME composition events for international input:

```typescript
it('handles composition events correctly', () => {
  render(<Composer store={mockStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');

  // Start composition (IME input)
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

  // Should not send during composition
  expect(mockController.sendPrompt).not.toHaveBeenCalled();

  // End composition
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

  // Now should send
  expect(mockController.sendPrompt).toHaveBeenCalled();
});
```

### Click Events

Test click interactions with buttons and triggers:

```typescript
it('expands when clicked', async () => {
  const thought = createMockThought('thought-1', 'I need to analyze this problem');
  const group = createMockThoughtGroup([{ type: 'thought', id: thought.id, data: thought }]);

  render(<ThoughtStack group={group} defaultOpen={false} />);

  const trigger = screen.getByText('1 thought');
  fireEvent.click(trigger);

  const expandButton = screen.getByRole('button', { name: /thinking/i });
  fireEvent.click(expandButton);

  await waitFor(() => {
    expect(screen.getByText('I need to analyze this problem')).toBeInTheDocument();
  });
});

it('calls onSelect when item is clicked', () => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  render(
    <SlashSuggestions
      commands={mockCommands}
      selectedIndex={0}
      onSelect={onSelect}
      onClose={onClose}
      anchorElement={null}
      open={true}
    />
  );

  const item = document.querySelector(`[data-acp-slash-item-id="clear"]`);
  expect(item).not.toBeNull();

  fireEvent.click(item!);

  expect(onSelect).toHaveBeenCalledWith(mockCommands[1]);
});
```

### Hover Events

Test hover-based UI like action bars:

```typescript
it('shows action bar on hover', () => {
  const { container } = render(
    <MessageActionBar
      message={mockMessage}
      actions={mockActions}
    />
  );

  const actionBar = container.querySelector('[data-acp-message-action-bar]');
  expect(actionBar).not.toBeNull();

  fireEvent.mouseEnter(actionBar!);
  expect(actionBar).toHaveClass('acp-message-action-bar--visible');

  fireEvent.mouseLeave(actionBar!);
  expect(actionBar).not.toHaveClass('acp-message-action-bar--visible');
});
```

### Hook Testing with renderHook

Test custom hooks using `renderHook`:

```typescript
import { renderHook, act } from '@testing-library/react';

describe('useSlashCommands', () => {
  it('should initialize with closed state', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.filteredCommands).toEqual(mockCommands);
  });

  it('should open on slash key', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    act(() => {
      result.current.handleSlashKey();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('should navigate with arrow keys', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    act(() => {
      result.current.handleSlashKey();
    });

    const downEvent = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(downEvent);
    });

    expect(result.current.selectedIndex).toBe(1);

    const upEvent = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(upEvent);
    });

    expect(result.current.selectedIndex).toBe(0);
  });
});
```

---

## Common Patterns

### Testing Async Operations

Use `waitFor` to wait for async updates:

```typescript
it('clears input after sending', async () => {
  render(<Composer store={mockStore} controller={mockController} />);

  const input = screen.getByLabelText('Message input');
  fireEvent.change(input, { target: { value: 'Test message' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

  await waitFor(() => {
    expect(input).toHaveValue('');
  });
});

it('fetches sessions from controller', async () => {
  function TestComponent() {
    const { state } = useSettings({ controller: mockController });
    return (
      <div>
        <span data-testid="sessions-count">{state.sessions.length}</span>
      </div>
    );
  }

  render(<TestComponent />);

  await waitFor(() => {
    expect(screen.getByTestId('sessions-count').textContent).toBe('1');
  });
});
```

### Testing State Updates

Use `act` for state updates:

```typescript
it('should set selected mode', async () => {
  function TestComponent() {
    const { state, actions } = useSettings({ controller: mockController });
    return (
      <div>
        <span data-testid="selected-mode">
          {state.selectedMode?.name ?? 'none'}
        </span>
        <button
          type="button"
          data-testid="set-mode"
          onClick={() =>
            actions.setMode({ id: 'proxy', name: 'Proxy', description: 'Test' })
          }
        >
          Set Mode
        </button>
      </div>
    );
  }

  render(<TestComponent />);

  expect(screen.getByTestId('selected-mode').textContent).toBe('none');

  await act(async () => {
    fireEvent.click(screen.getByTestId('set-mode'));
  });

  await waitFor(() => {
    expect(screen.getByTestId('selected-mode').textContent).toBe('Proxy');
  });
});
```

### Testing with Custom Render Functions

Test components that accept render props:

```typescript
it('uses custom render function when provided', () => {
  const customRender = vi.fn(() => <div data-testid="custom-message">Custom</div>);
  const messages = [mockUserMessage];

  render(<MessageList messages={messages} renderMessage={customRender} />);

  expect(customRender).toHaveBeenCalledWith(mockUserMessage, 0);
  expect(screen.getByTestId('custom-message')).toBeTruthy();
});

it('should use custom renderSettingsRow when provided', () => {
  const customRender = vi.fn(() => (
    <div data-acp-settings-row="custom">Custom Settings Row</div>
  ));

  const { container } = render(
    <SettingsPanel controller={mockController} renderSettingsRow={customRender} />
  );

  expect(container.querySelector('[data-acp-settings-row="custom"]')).not.toBeNull();
  expect(screen.getByText('Custom Settings Row')).toBeInTheDocument();
});
```

### Testing Content Rendering

Test different content block types:

```typescript
it('renders text content blocks', () => {
  const blocks: ContentBlock[] = [{ type: 'text', text: 'Hello world' }];
  render(<ContentRenderer blocks={blocks} />);

  expect(screen.getByText('Hello world')).toBeTruthy();
  expect(document.querySelector("[data-acp-content-type='text']")).toBeTruthy();
});

it('renders resource content blocks', () => {
  const blocks: ContentBlock[] = [
    {
      type: 'resource',
      resource: {
        uri: 'file:///test.txt',
        mimeType: 'text/plain',
        text: 'Resource content',
      },
    },
  ];
  render(<ContentRenderer blocks={blocks} />);

  expect(screen.getByText('Resource content')).toBeTruthy();
  expect(document.querySelector("[data-acp-content-type='resource']")).toBeTruthy();
});

it('renders resource_link content blocks', () => {
  const blocks: ContentBlock[] = [
    {
      type: 'resource_link',
      resourceLink: {
        uri: 'https://example.com/file.txt',
        mimeType: 'text/plain',
      },
    },
  ];
  render(<ContentRenderer blocks={blocks} />);

  const link = screen.getByText('https://example.com/file.txt');
  expect(link).toBeTruthy();
  expect(link.closest('a')?.getAttribute('href')).toBe('https://example.com/file.txt');
  expect(document.querySelector("[data-acp-content-type='resource_link']")).toBeTruthy();
});
```

### Testing Status Indicators

Test different component states:

```typescript
it('renders streaming status', () => {
  render(<MessageStatusIndicator status="streaming" />);

  const indicator = document.querySelector("[data-acp-message-status='streaming']");
  expect(indicator).toBeTruthy();
  expect(screen.getByText('Streaming')).toBeTruthy();
});

it('renders complete status', () => {
  render(<MessageStatusIndicator status="completed" />);

  const indicator = document.querySelector("[data-acp-message-status='completed']");
  expect(indicator).toBeTruthy();
  expect(screen.getByText('Completed')).toBeTruthy();
});

it('renders error status', () => {
  render(<MessageStatusIndicator status="error" />);

  const indicator = document.querySelector("[data-acp-message-status='error']");
  expect(indicator).toBeTruthy();
  expect(screen.getByText('Error')).toBeTruthy();
});

it('renders cancelled status', () => {
  render(<MessageStatusIndicator status="cancelled" />);

  const indicator = document.querySelector("[data-acp-message-status='cancelled']");
  expect(indicator).toBeTruthy();
  expect(screen.getByText('Cancelled')).toBeTruthy();
});
```

### Testing Tool Call Rendering

Test different tool call kinds and states:

```typescript
it('should render different tool call kinds', () => {
  const kinds: NormalizedToolCall['kind'][] = [
    'read', 'search', 'edit', 'write', 'execute', 'glob', 'grep', 'unknown'
  ];

  kinds.forEach((kind) => {
    const toolCall = createMockToolCall(`tool-${kind}`, kind, `${kind} operation`);
    const { container } = render(<ToolCall toolCall={toolCall} />);

    const root = container.querySelector('[data-acp-tool-call-root]');
    expect(root?.getAttribute('data-acp-tool-call-kind')).toBe(kind);
  });
});

it('should show input/output when expanded', async () => {
  const toolCall: NormalizedToolCall = {
    ...createMockToolCall('tool-1', 'read', 'Read file'),
    rawInput: { filePath: '/test/file.txt' },
    rawOutput: {
      output: 'File contents here',
      metadata: { truncated: false },
    },
  };

  render(<ToolCall toolCall={toolCall} isExpanded={true} />);

  await waitFor(() => {
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
  });
});
```

### Testing Render Isolation

Verify that updates don't cause unnecessary re-renders:

```typescript
it('should not re-render unrelated items when thought updates', async () => {
  const thought = createMockThought('thought-1', 'Initial thought');
  const group = createMockThoughtGroup([{ type: 'thought', id: thought.id, data: thought }]);

  const { rerender } = render(<ThoughtStack group={group} />);

  const updatedThought = { ...thought, content: 'Updated thought' };
  const updatedGroup = createMockThoughtGroup([
    { type: 'thought', id: updatedThought.id, data: updatedThought }
  ]);

  rerender(<ThoughtStack group={updatedGroup} />);

  await waitFor(() => {
    expect(screen.getByText('1 thought')).toBeInTheDocument();
  });
});

it('should memoize thought item components', async () => {
  const thought = createMockThought('thought-1', 'Test thought');
  const group = createMockThoughtGroup([{ type: 'thought', id: thought.id, data: thought }]);

  const { container } = render(<ThoughtStack group={group} defaultOpen={true} />);

  await waitFor(() => {
    const items = container.querySelectorAll('[data-acp-thought-item]');
    expect(items.length).toBe(1);
  });
});
```

### Testing Props Validation

Test that props are passed correctly to render callbacks:

```typescript
it('should pass correct props to custom render', () => {
  const customRender = vi.fn(() => <div data-acp-settings-row>Custom</div>);
  const customModes: AcpMode[] = [{ id: 'test', name: 'Test Mode' }];
  const customModels: AcpModel[] = [{ id: 'model-1', name: 'Test Model' }];

  render(
    <SettingsPanel
      controller={mockController}
      modes={customModes}
      models={customModels}
      renderSettingsRow={customRender}
    />
  );

  expect(customRender).toHaveBeenCalled();
  const props = (customRender.mock.calls[0] as unknown[])[0] as { 
    modes: AcpMode[]; 
    models: AcpModel[] 
  };
  expect(props.modes).toEqual(customModes);
  expect(props.models).toEqual(customModels);
});
```

### Testing Empty States

Test components with no data:

```typescript
it('renders empty list without errors', () => {
  render(<MessageList messages={[]} />);

  const list = document.querySelector('[data-acp-message-list]');
  expect(list).toBeTruthy();
});

it('renders default message', () => {
  render(<MessageEmptyState />);

  expect(screen.getByText('No messages yet')).toBeTruthy();
});

it('returns null for empty blocks', () => {
  const { container } = render(<ContentRenderer blocks={[]} />);
  expect(container.firstChild).toBeNull();
});
```

---

## Test File Organization

### File Naming

- Component tests: `<ComponentName>.test.tsx`
- Hook tests: `use-<HookName>.test.ts` or in component test file
- Logic tests: `<ComponentName>-logic.test.ts`

### Example Structure

```
src/
  composer/
    Composer.tsx
    composer-logic.ts
    composer-flow.test.tsx        # Component + logic tests
  settings/
    SettingsPanel.tsx
    use-settings.ts
    settings.test.tsx             # Component + hook tests
  message/
    MessageCard.tsx
    MessageList.tsx
    message-rendering.test.tsx    # Rendering tests
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/composer/composer-flow.test.tsx

# Run in watch mode
npm test -- --watch
```

---

## Checklist

Before submitting tests, verify:

- [ ] Uses `data-acp-*` selectors for stability
- [ ] Mocks store and controller properly
- [ ] Tests disabled states
- [ ] Tests async operations with `waitFor`
- [ ] Uses accessible queries when possible
- [ ] Tests keyboard interactions
- [ ] Tests edge cases (empty states, errors)
- [ ] Mocks external dependencies (clipboard, etc.)
- [ ] Follows existing test patterns
