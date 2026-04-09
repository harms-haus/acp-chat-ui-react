# Hooks Reference

Complete hooks reference for `@harms-haus/acp-chat-react`.

## Store Hooks

### `useAcpStore`
Access AcpStore instance from context.

**Signature:**
```typescript
function useAcpStore(): AcpStore;
```

**Usage:**
```tsx
import { useAcpStore } from '@harms-haus/acp-chat-react';

function MyComponent() {
  const store = useAcpStore();
  return <div>Store: {store ? 'connected' : 'not connected'}</div>;
}
```

---

### `useAcpStoreSnapshot`
Get snapshot of store state.

**Signature:**
```typescript
function useAcpStoreSnapshot<T>(
  store: AcpStore,
  selector: (state: NormalizedState) => T
): T;
```

**Usage:**
```tsx
import { useAcpStoreSnapshot } from '@harms-haus/acp-chat-react';

function MessageCount() {
  const store = useAcpStore();
  const count = useAcpStoreSnapshot(store, (state) => state.messages.length);
  return <div>{count} messages</div>;
}
```

---

## Session State Hooks

### `useSessionState`
Get current session state.

**Signature:**
```typescript
function useSessionState<T>(
  store: AcpStore,
  selector: (state: SessionState) => T
): T;
```

**Usage:**
```tsx
import { useSessionState } from '@harms-haus/acp-chat-react';

function SessionInfo() {
  const store = useAcpStore();
  const sessionId = useSessionState(store, (state) => state.sessionId);
  return <div>Session: {sessionId}</div>;
}
```

---

### `useIsConnected`
Check connection status.

**Signature:**
```typescript
function useIsConnected(store: AcpStore): boolean;
```

**Usage:**
```tsx
import { useIsConnected } from '@harms-haus/acp-chat-react';

function ConnectionStatus() {
  const store = useAcpStore();
  const isConnected = useIsConnected(store);
  return <div>{isConnected ? 'Connected' : 'Disconnected'}</div>;
}
```

---

### `useIsInitialized`
Check initialization status.

**Signature:**
```typescript
function useIsInitialized(store: AcpStore): boolean;
```

---

### `useActiveStreamingMessage`
Get currently streaming message.

**Signature:**
```typescript
function useActiveStreamingMessage(
  store: AcpStore
): NormalizedMessage | null;
```

---

## Event Hooks

### `useChatEvent`
Subscribe to chat events.

**Signature:**
```typescript
function useChatEvent(
  store: AcpStore,
  eventType: ChatEventType,
  handler: (event: ChatEvent) => void
): void;
```

**Usage:**
```tsx
import { useChatEvent } from '@harms-haus/acp-chat-react';

function EventLogger() {
  const store = useAcpStore();
  
  useChatEvent(store, 'sessionUpdate', (event) => {
    console.log('Session updated:', event);
  });
  
  return null;
}
```

---

### `useThoughtEvents`
Get thought events.

**Signature:**
```typescript
function useThoughtEvents(store: AcpStore): NormalizedThought[];
```

---

### `usePermissionResponse`
Handle permission responses.

**Signature:**
```typescript
function usePermissionResponse(
  store: AcpStore,
  onAccept: (requestId: string) => void,
  onReject: (requestId: string) => void
): void;
```

---

## Settings Hooks

### `useSettings`
Access settings state.

**Signature:**
```typescript
function useSettings(store: AcpStore): Settings;
```

**Usage:**
```tsx
import { useSettings } from '@harms-haus/acp-chat-react';

function SettingsDisplay() {
  const store = useAcpStore();
  const settings = useSettings(store);
  return <div>Mode: {settings.mode}</div>;
}
```

---

## Connection Hooks

### `useAcpConnection`
Manage ACP connection lifecycle.

**Signature:**
```typescript
function useAcpConnection(
  store: AcpStore,
  config: ConnectionConfig
): {
  isConnected: boolean;
  isInitializing: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};
```

**Usage:**
```tsx
import { useAcpConnection } from '@harms-haus/acp-chat-react';

function App() {
  const store = useAcpStore();
  const { isConnected, connect, disconnect } = useAcpConnection(store, {
    url: 'ws://localhost:8765',
  });

  return (
    <div>
      <button onClick={isConnected ? disconnect : connect}>
        {isConnected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  );
}
```

---

## Related Documentation

- [Components](./acp-chat-react-Components) - Component reference
- [Store](./acp-chat-react-Store) - Store architecture
- [Examples](./acp-chat-react-Examples) - Usage examples
- [ACP Chat Core Home](./acp-chat-core-Home) - Core library docs
