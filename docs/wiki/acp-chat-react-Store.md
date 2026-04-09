# Store Architecture

Documentation for AcpStore implementation in `@harms-haus/acp-chat-react`.

## AcpStore Class

The `AcpStore` manages React-specific state and provides subscription-based updates.

### Class Structure

```typescript
class AcpStore {
  private sessionController: SessionController;
  private state: NormalizedState;
  private subscribers: Set<StateSubscriber>;
  private batchedNotifications: boolean;
  
  constructor(config: AcpStoreConfig);
  subscribe(callback: StateSubscriber): () => void;
  getState(): NormalizedState;
  notify(): void;
}
```

### Subscription API

```typescript
// Subscribe to state changes
const unsubscribe = store.subscribe((newState) => {
  // Handle state update
  render(newState);
});

// Cleanup
unsubscribe();
```

### Batched Notifications

The store batches notifications for performance:

```typescript
// Multiple state updates
store.notify(); // Batched
store.notify(); // Batched
store.notify(); // Batched

// Single notification sent to subscribers
```

## Snapshot Management

### Immutable Snapshots

All state updates create new snapshots:

```typescript
const newState = createNormalizedState(update);
this.state = newState; // New object reference
this.notify(); // Subscribers notified
```

### Version-Based Invalidation

Snapshots include version for cache invalidation:

```typescript
interface NormalizedState {
  version: number;
  messages: NormalizedMessage[];
  // ... other fields
}
```

## Event Integration

The store integrates with SessionController events:

```typescript
sessionController.on('sessionUpdate', (update) => {
  const newState = applySessionUpdate(this.state, update);
  this.state = newState;
  this.notify();
});
```

## Configuration

### AcpStoreConfig

```typescript
interface AcpStoreConfig {
  sessionController: SessionController;
  initialState?: Partial<NormalizedState>;
  batchNotifications?: boolean;
}
```

### Usage

```typescript
import { AcpStore, SessionController } from '@harms-haus/acp-chat-react';

const controller = new SessionController(config);
const store = new AcpStore({
  sessionController: controller,
  batchNotifications: true,
});
```

## React Integration

### Context Provider

```tsx
import { AcpStoreContext, AcpStore } from '@harms-haus/acp-chat-react';

const store = new AcpStore(config);

<AcpStoreContext.Provider value={store}>
  <App />
</AcpStoreContext.Provider>
```

### Hook Usage

```tsx
import { useAcpStore } from '@harms-haus/acp-chat-react';

function MyComponent() {
  const store = useAcpStore();
  const state = store.getState();
  
  return <div>{state.messages.length} messages</div>;
}
```

## Related Documentation

- [Components](./acp-chat-react-Components) - Component reference
- [Hooks](./acp-chat-react-Hooks) - Hooks reference
- [Examples](./acp-chat-react-Examples) - Usage examples
- [Session Management](./acp-chat-core-Session-Management) - Core controller
