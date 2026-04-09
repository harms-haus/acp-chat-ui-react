# Implementation Guide

Framework-agnostic guide for building ACP chat UIs with `@harms-haus/acp-chat-core`.

## Core Patterns

### State Subscription Pattern

The AcpStore architecture uses immediate state updates with batched notifications.

```typescript
import { AcpStore } from '@harms-haus/acp-chat-react';

const store = new AcpStore();

// Subscribe to state changes
const unsubscribe = store.subscribe((newState) => {
  // Immediate state update
  renderUI(newState);
});

// Cleanup on unmount
unsubscribe();
```

**Framework Adaptation:**

- **React**: Use `useAcpStore()` hook
- **Vue**: Use `ref()` with subscription
- **Svelte**: Use `writable()` store
- **Vanilla JS**: Direct subscription

---

### Event Handling Pattern

Three-layer event system: Transport → Session → Store.

```typescript
import { SessionController } from '@harms-haus/acp-chat-core';

const controller = new SessionController(config);

// Subscribe to session events
controller.on('sessionUpdate', (update) => {
  // Process update
  const newState = applySessionUpdate(currentState, update);
  
  // Notify subscribers
  store.notify(newState);
});

// Cleanup
controller.off('sessionUpdate');
```

**Event Subscription Manager:**

```typescript
class EventSubscriptionManager {
  private subscriptions: Map<string, Set<EventHandler>> = new Map();
  
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType)!.add(handler);
    
    // Return cleanup function
    return () => {
      this.subscriptions.get(eventType)?.delete(handler);
    };
  }
  
  emit(eventType: string, data: unknown): void {
    this.subscriptions.get(eventType)?.forEach(handler => {
      handler(data);
    });
  }
}
```

---

### Timeline-Based Rendering Pattern

Process timeline items in order with thought grouping.

```typescript
import { createNormalizedState } from '@harms-haus/acp-chat-core';

// Group thoughts by session update
function groupThoughts(events: Event[]): GroupedTimelineItem[] {
  const groups: Map<string, TimelineGroup> = new Map();
  let currentGroup: TimelineGroup | null = null;
  
  for (const event of events) {
    if (event.type === 'sessionUpdate') {
      // Start new group
      currentGroup = { id: event.update.id, items: [] };
      groups.set(event.update.id, currentGroup);
    }
    
    if (event.type === 'agent_thought_chunk' && currentGroup) {
      currentGroup.items.push(event.data);
    }
  }
  
  return Array.from(groups.values());
}
```

**Framework Adaptation:**

- Track active thought groups
- Auto-expand on new thoughts
- Respect user collapse/expand state
- Use event history for lifecycle

---

## Component Patterns

### Message List Rendering

Render messages with type-based rendering.

```typescript
import { MessageCard, ContentRenderer } from '@harms-haus/acp-chat-react';

function MessageList({ messages }) {
  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          renderers={{
            text: TextRenderer,
            image: ImageRenderer,
            resource: ResourceRenderer,
          }}
        />
      ))}
    </div>
  );
}
```

**MessageCard Structure:**

```typescript
function MessageCard({ message, className }) {
  return (
    <div className={`acp-message acp-message--${message.role} ${className}`}>
      <div className="acp-message__role">{message.role}</div>
      <div className="acp-message__content">
        <ContentRenderer content={message.content} />
      </div>
      <div className="acp-message__status">{message.status}</div>
    </div>
  );
}
```

---

### Input/Composer Components

Use pure logic functions for framework-agnostic implementation.

```typescript
// Pure logic function (framework-agnostic)
function handleKeydown(
  event: KeyboardEvent,
  state: ComposerState,
  onSubmit: (value: string) => void
): ComposerState {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (state.value.trim()) {
      onSubmit(state.value);
      return { ...state, value: '', lifecycle: 'submitted' };
    }
  }
  
  return state;
}
```

**Component Structure:**

```typescript
function Composer({ store, placeholder }) {
  const [state, setState] = useState({ value: '', lifecycle: 'idle' });
  
  const handleSubmit = async (value) => {
    setState((s) => ({ ...s, lifecycle: 'submitting' }));
    await store.sessionController.sendPrompt(value);
    setState((s) => ({ ...s, lifecycle: 'submitted' }));
  };
  
  return (
    <div className="acp-composer">
      <textarea
        value={state.value}
        onChange={(e) => setState((s) => ({ ...s, value: e.target.value }))}
        onKeyDown={(e) => handleKeydown(e, state, handleSubmit)}
        placeholder={placeholder}
        data-acp-input
      />
      <button 
        onClick={() => handleSubmit(state.value)}
        data-acp-send
      >
        Send
      </button>
    </div>
  );
}
```

---

## Status/Loading States

Derive status from session state.

```typescript
import { useSessionState } from '@harms-haus/acp-chat-react';

function StatusIndicator() {
  const store = useAcpStore();
  const status = useSessionState(store, (state) => state.status);
  const isConnected = useIsConnected(store);
  
  const getStatusText = () => {
    if (!isConnected) return 'Disconnected';
    switch (status) {
      case 'processing': return 'Processing...';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return 'Ready';
    }
  };
  
  return <div className="status">{getStatusText()}</div>;
}
```

---

## Error Handling

### Multiple Layers

```typescript
// Layer 1: Transport errors
transport.on('error', (error) => {
  console.error('Transport error:', error);
  // Show connection error UI
});

// Layer 2: Request errors
try {
  await controller.sendPrompt('Hello');
} catch (error) {
  console.error('Request error:', error);
  // Show request error UI
}

// Layer 3: Session errors
controller.on('error', (error) => {
  console.error('Session error:', error);
  // Show session error UI
});
```

### Try-Catch Patterns

```typescript
async function handleSendPrompt(value: string) {
  try {
    await sessionController.sendPrompt(value);
  } catch (error) {
    if (error instanceof ConnectionError) {
      // Handle connection error
    } else if (error instanceof TimeoutError) {
      // Handle timeout
    } else {
      // Handle generic error
    }
  }
}
```

---

## Advanced Patterns

### Permission Request Handling

Dual-update pattern (store + controller).

```typescript
import { usePermissionResponse, useChatEvent } from '@harms-haus/acp-chat-react';

function PermissionHandler() {
  const store = useAcpStore();
  const [pendingRequest, setPendingRequest] = useState(null);
  
  // Listen for permission requests
  useChatEvent(store, 'permissionRequest', (event) => {
    setPendingRequest(event.data);
  });
  
  // Handle response
  const handleResponse = async (accepted: boolean) => {
    if (pendingRequest) {
      try {
        await store.sessionController.respondToPermission(
          pendingRequest.id,
          accepted
        );
        setPendingRequest(null);
      } catch (error) {
        console.error('Permission response failed:', error);
      }
    }
  };
  
  if (!pendingRequest) return null;
  
  return (
    <PermissionRequestCard
      request={pendingRequest}
      onAccept={() => handleResponse(true)}
      onReject={() => handleResponse(false)}
    />
  );
}
```

---

### Thought Stack with Event-Based Lifecycle

Track events for auto-expand/collapse.

```typescript
import { useThoughtEvents } from '@harms-haus/acp-chat-react';

function ThoughtStackWithLifecycle() {
  const store = useAcpStore();
  const thoughts = useThoughtEvents(store);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set());
  
  // Auto-expand on new thought
  useChatEvent(store, 'agent_thought_chunk', (event) => {
    const groupId = event.data.groupId;
    if (!userExpanded.has(groupId)) {
      setExpandedGroups((prev) => new Set(prev).add(groupId));
    }
  });
  
  const handleToggle = (groupId: string) => {
    const isExpanded = expandedGroups.has(groupId);
    
    // Mark as user interaction
    if (isExpanded) {
      setUserExpanded((prev) => new Set(prev).add(groupId));
    } else {
      setUserExpanded((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
    
    // Toggle expansion
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (isExpanded) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };
  
  return (
    <ThoughtStack
      thoughts={thoughts}
      expandedGroups={expandedGroups}
      onToggle={handleToggle}
    />
  );
}
```

---

### Connection Management

Lifecycle management with auto-connect.

```typescript
import { useAcpConnection } from '@harms-haus/acp-chat-react';

function ConnectionManager() {
  const store = useAcpStore();
  const { isConnected, connect, disconnect, isConnecting, error } = useAcpConnection(store, {
    url: 'ws://localhost:8765',
    autoConnect: true,
    reconnect: true,
  });
  
  return (
    <div>
      {error && <div className="error">Connection error: {error.message}</div>}
      {isConnecting && <div>Connecting...</div>}
      {isConnected && <div>Connected</div>}
      {!isConnected && !isConnecting && (
        <button onClick={connect}>Connect</button>
      )}
      {isConnected && (
        <button onClick={disconnect}>Disconnect</button>
      )}
    </div>
  );
}
```

---

## Framework-Agnostic Abstractions

### Pure Logic Functions

Input validation, lifecycle tracking, button state logic.

```typescript
// Pure function - no framework dependencies
function validatePromptInput(value: string): { valid: boolean; error?: string } {
  if (!value.trim()) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }
  if (value.length > 10000) {
    return { valid: false, error: 'Prompt too long (max 10000 chars)' };
  }
  return { valid: true };
}

// Lifecycle tracking
function trackLifecycle(
  phase: 'idle' | 'submitting' | 'submitted',
  onTransition?: (from: string, to: string) => void
): void {
  // Track lifecycle transitions
  console.log(`Lifecycle: ${phase}`);
}

// Button state logic
function getButtonState(
  lifecycle: 'idle' | 'submitting' | 'submitted',
  isConnected: boolean,
  isLoading: boolean
): { disabled: boolean; text: string } {
  if (!isConnected) {
    return { disabled: true, text: 'Not connected' };
  }
  if (lifecycle === 'submitting' || isLoading) {
    return { disabled: true, text: 'Sending...' };
  }
  return { disabled: false, text: 'Send' };
}
```

---

### Type-Based Rendering

Switch pattern for content rendering.

```typescript
function ContentRenderer({ content }: { content: ContentBlock }) {
  switch (content.type) {
    case 'text':
      return <TextContent text={content.text} />;
    case 'image':
      return <ImageContent src={content.data} alt={content.alt} />;
    case 'resource_link':
      return <ResourceLink uri={content.uri} name={content.name} />;
    case 'embedded_resource':
      return <EmbeddedResource resource={content.resource} />;
    default:
      // Unknown type handling
      console.warn('Unknown content type:', content.type);
      return null;
  }
}
```

---

### Snapshot-Based State Management

Immutable snapshots with version-based invalidation.

```typescript
class StateManager {
  private state: NormalizedState;
  private version: number = 0;
  
  constructor(initialState: NormalizedState) {
    this.state = initialState;
  }
  
  update(update: Partial<NormalizedState>): void {
    // Create new snapshot (immutable)
    const newState = {
      ...this.state,
      ...update,
      version: this.version + 1,
    };
    
    this.state = newState;
    this.notify();
  }
  
  getState(): NormalizedState {
    // Return deep clone for safety
    return JSON.parse(JSON.stringify(this.state));
  }
  
  private notify(): void {
    // Notify subscribers of version change
    this.subscribers.forEach(callback => {
      callback(this.state);
    });
  }
}
```

---

## Implementation Checklist

- [ ] Set up project with dependencies
- [ ] Create SessionController instance
- [ ] Implement connection management
- [ ] Set up event subscription manager
- [ ] Implement state normalization
- [ ] Create message list component
- [ ] Create composer component
- [ ] Implement permission handling
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test with live agent
- [ ] Test with replay data

---

## Framework Translation Table

### React → Vanilla JS

| React Pattern | Vanilla JS Equivalent |
|--------------|---------------------|
| `useState` | Manual state + render |
| `useEffect` | Direct subscription |
| `useCallback` | Named function |
| `useMemo` | Cached value |
| Context | Global instance |

### React → Svelte

| React Pattern | Svelte Equivalent |
|--------------|-----------------|
| `useState` | `writable()` |
| `useEffect` | `$:` reactive statement |
| Context | `setContext`/`getContext` |
| Props | `export let` |

### React → Vue

| React Pattern | Vue Equivalent |
|--------------|---------------|
| `useState` | `ref()`/`reactive()` |
| `useEffect` | `watch()` |
| Context | `provide`/`inject` |
| Props | `defineProps` |

---

## Related Documentation

- [Architecture](./acp-chat-core-Architecture) - System overview
- [Types Reference](./acp-chat-core-Types-Reference) - Type definitions
- [Events](./acp-chat-core-Events) - Event system
- [Session Management](./acp-chat-core-Session-Management) - Controller API
- [ACP Protocol](./ACP-Protocol) - Protocol specification
