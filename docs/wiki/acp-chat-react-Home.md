# ACP Chat React

React implementation of ACP Chat UI components.

## Package Overview

`@harms-haus/acp-chat-react` provides React components and hooks for building ACP chat interfaces.

### Relationship to acp-chat-core

```
@harms-haus/acp-chat-core
  └── Framework-agnostic core library
      ├── SessionController
      ├── TransportClient
      └── Normalization

@harms-haus/acp-chat-react
  └── React implementation
      ├── Components (Thread, MessageCard, Composer, etc.)
      ├── Hooks (useMessages, useSessionState, etc.)
      └── AcpStore
```

## Installation

```bash
npm install @harms-haus/acp-chat-core @harms-haus/acp-chat-react
```

## Quick Start

```typescript
import { AcpStore, Thread, Composer, useAcpConnection } from '@harms-haus/acp-chat-react';

// Create store
const store = new AcpStore();

// Connect to bridge
function ChatApp() {
  const { isConnected } = useAcpConnection(store);

  if (!isConnected) {
    return <div>Connecting...</div>;
  }

  return (
    <div>
      <Thread store={store} />
      <Composer store={store} />
    </div>
  );
}
```

## Component Catalog

| Component | Description |
|-----------|-------------|
| `Thread` | Virtualized message list |
| `MessageCard` | Individual message display |
| `Composer` | Input component |
| `ContentRenderer` | Content block renderer |
| `ThoughtStack` | Thought display component |
| `PermissionRequestCard` | Permission request UI |
| `VirtualizedThread` | Optimized thread rendering |
| `SettingsPanel` | Settings UI |
| `SessionList` | Session management UI |

## Hook Catalog

| Hook | Description |
|------|-------------|
| `useAcpStore` | Access store state |
| `useSessionState` | Get session state |
| `useIsConnected` | Connection status |
| `useIsInitialized` | Initialization status |
| `useActiveStreamingMessage` | Get active message |
| `useChatEvent` | Subscribe to events |
| `useThoughtEvents` | Get thought events |
| `usePermissionResponse` | Handle permissions |
| `useSettings` | Access settings |
| `useAcpConnection` | Connection management |

## CSS Customization

All components use CSS custom properties for styling:

```css
:root {
  /* Colors */
  --acp-color-bg-primary: #ffffff;
  --acp-color-bg-secondary: #f5f5f5;
  --acp-color-text-primary: #1a1a1a;
  --acp-color-text-secondary: #666666;
  
  /* Spacing */
  --acp-spacing-xs: 4px;
  --acp-spacing-sm: 8px;
  --acp-spacing-md: 16px;
  --acp-spacing-lg: 24px;
  
  /* Border radius */
  --acp-radius-sm: 4px;
  --acp-radius-md: 8px;
  --acp-radius-lg: 12px;
}
```

## Related Documentation

- [Components](./acp-chat-react-Components) - Component reference
- [Hooks](./acp-chat-react-Hooks) - Hooks reference
- [Store](./acp-chat-react-Store) - Store architecture
- [Examples](./acp-chat-react-Examples) - Integration examples
- [ACP Chat Core Home](./acp-chat-core-Home) - Core library docs
