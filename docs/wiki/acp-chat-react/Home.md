# ACP Chat React - Documentation

Welcome to the **acp-chat-react** documentation - the reference React implementation for building ACP-powered chat interfaces.

---

## 📦 Package Overview

**acp-chat-react** is a complete React implementation built on top of [`acp-chat-core`](./Home), providing ready-to-use components and hooks for building chat interfaces powered by the Agent Client Protocol (ACP).

### Relationship to acp-chat-core

```
┌─────────────────────────────────────────────────────────────┐
│                    Your React App                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Uses Components & Hooks
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  acp-chat-react                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Components                                     │  │
│  │  - Thread, MessageList, Composer, etc.               │  │
│  │  Hooks                                                │  │
│  │  - useAcpStore, useSessionState, etc.                │  │
│  │  Store                                                │  │
│  │  - AcpStore (wraps acp-chat-core)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           │ Depends On                       │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              acp-chat-core                            │  │
│  │  - SessionController                                 │  │
│  │  - NormalizedState                                   │  │
│  │  - applySessionUpdate                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- `acp-chat-react` wraps `acp-chat-core` with React-specific abstractions
- Uses `useSyncExternalStore` for efficient state subscription
- Provides batched notifications (16ms render cadence)
- Components are customizable via render props and composition
- SSR-safe implementation

---

## 📖 Documentation Navigation

### acp-chat-react Documentation

| Page | Description |
|------|-------------|
| **[Components](./Components)** | Complete component reference with props and usage |
| **[Hooks](./Hooks)** | React hooks reference with examples |
| **[Store](./Store)** | AcpStore architecture and API documentation |
| **[Examples](./Examples)** | Integration examples and advanced patterns |

---

### Related Documentation

| Page | Description |
|------|-------------|
| **[acp-chat-core Home](../acp-chat-core/Home)** | Core library documentation |
| **[ACP Protocol](../ACP-Protocol)** | Official ACP protocol specification |

## 🚀 Quick Start

### Installation

```bash
npm install @acp/chat-core @acp/chat-react
# or
pnpm add @acp/chat-core @acp/chat-react
```

### Basic Setup

**Note:** The following example demonstrates the recommended pattern using acp-chat-core's SessionController directly with React hooks. Actual exported hooks may vary - check the package exports for the current API.

```tsx
import { SessionController } from '@acp/chat-core';
import { AcpStore } from '@acp/chat-react';
import { Thread, Composer } from '@acp/chat-react';
import { useEffect, useState } from 'react';

function ChatApp() {
  const [controller, setController] = useState<SessionController | null>(null);
  const [store, setStore] = useState<AcpStore | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ctrl = new SessionController('ws://localhost:8765');
    const acpStore = new AcpStore(ctrl);

    ctrl.on('error', (err) => setError(err));
    ctrl.on('statusChange', (state) => {
      if (state.connectionStatus === 'connected') {
        setConnected(true);
      }
    });

    ctrl.connect();
    ctrl.initialize({ name: 'my-app', version: '1.0.0' })
      .then(() => ctrl.createSession('/workspace', []))
      .catch(setError);

    setController(ctrl);
    setStore(acpStore);

    return () => {
      ctrl.disconnect();
      acpStore.destroy();
    };
  }, []);

  if (error) return <div>Error: {error.message}</div>;
  if (!connected || !store || !controller) return <div>Connecting...</div>;

  return (
    <div className="chat-container">
      <Thread 
        store={store} 
        controller={controller}
        follow={true}
      />
      <Composer 
        store={store} 
        controller={controller}
      />
    </div>
  );
}
```

### With Custom Components

```tsx
import { useAcpStoreSnapshot } from '@acp/chat-react';
import { MessageCard, ContentRenderer } from '@acp/chat-react';
import type { AcpStore } from '@acp/chat-react';

function CustomMessageList({ store }: { store: AcpStore }) {
  const snapshot = useAcpStoreSnapshot(store);
  const messages = Array.from(snapshot.messages.values());

  return (
    <div>
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          showStatus={message.role === 'agent'}
        >
          <ContentRenderer blocks={message.contentBlocks} />
        </MessageCard>
      ))}
    </div>
  );
}
```

---

## 🎯 Key Features

### Components

- **Thread**: Timeline-based message rendering with thought grouping
- **MessageList**: Virtualized message list with custom rendering
- **MessageCard**: Individual message display with status indicators
- **Composer**: Input component with send/stop logic and slash commands
- **ContentRenderer**: Content block rendering (text, resource, resource_link)
- **ThoughtStack**: Agent reasoning display with auto-expand/collapse
- **PermissionRequestCard**: Permission request handling UI
- **SettingsPanel**: Session configuration and mode selection
- **SessionList**: Session management and history

### Hooks

- **useAcpStore**: Subscribe to store changes
- **useAcpStoreSnapshot**: Get immutable store snapshot
- **useSessionState**: Get session state (connection, initialized, etc.)
- **useIsConnected**: Check connection status
- **useActiveStreamingMessage**: Get currently streaming message
- **useChatEvent**: Subscribe to specific event types
- **usePermissionResponse**: Handle permission responses

### Store

- **AcpStore**: Wraps acp-chat-core state with React-compatible subscription API
- **Batched Notifications**: 16ms render cadence for performance
- **Snapshot-based**: Immutable state snapshots prevent unnecessary re-renders
- **Event Integration**: Subscribes to SessionController events automatically

---

## 🏗️ Architecture

### Store Pattern

```tsx
// AcpStore wraps SessionController
const store = new AcpStore(controller, {
  enableBatching: true,
  notificationCadenceMs: 16,
});

// Subscribe using hook
const snapshot = useAcpStoreSnapshot(store);

// Access state
const messages = Array.from(snapshot.messages.values());
const session = snapshot.session;
```

### Component Hierarchy

```
ChatApp
├── useAcpConnection (connection management)
│   ├── SessionController
│   └── AcpStore
├── Thread
│   ├── VirtualizedThread (scrolling)
│   └── ThreadItemRenderer
│       ├── MessageCard
│       │   ├── MessageHeader
│       │   ├── ContentRenderer
│       │   └── MessageStatusIndicator
│       ├── ThoughtStack
│       │   └── ThoughtContent
│       └── PermissionRequestCard
└── Composer
    ├── Textarea
    ├── SendButton
    └── StopButton
```

---

## 📊 Version Information

| Property | Value |
|----------|-------|
| Version | 0.0.1 |
| License | MIT |
| Peer Dependencies | React 18+, acp-chat-core 0.0.1 |
| Type Definitions | Included (TypeScript) |

---

## 🔗 Related Documentation

- **[acp-chat-core Home](../acp-chat-core/Home)** - Core library documentation
- **[ACP Protocol](../ACP-Protocol)** - Official ACP protocol specification
- **[Architecture](../acp-chat-core/Architecture)** - Core architecture overview
- **[Types Reference](../acp-chat-core/Types-Reference)** - Type definitions
- **[Implementation Guide](../acp-chat-core/Implementation-Guide)** - Framework-agnostic patterns

---

## 📝 Getting Help

- **Documentation**: Browse this wiki for guides and references
- **Troubleshooting**: Check the [Troubleshooting](../Troubleshooting) page
- **Issues**: Report bugs on GitHub
- **Discussions**: Ask questions in GitHub Discussions

---

**Last Updated:** April 2026

**Maintained By:** ACP Chat Core Team
