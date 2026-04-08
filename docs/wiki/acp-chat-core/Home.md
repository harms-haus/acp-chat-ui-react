# ACP Chat Core & React - Documentation Wiki

Welcome to the comprehensive documentation for **acp-chat-core** and **acp-chat-react** - a headless library and reference implementation for building chat interfaces powered by the [Agent Client Protocol (ACP)](https://agentclientprotocol.com).

---

## 📦 Package Overview

### acp-chat-core

**Headless ACP State Management Library**

`acp-chat-core` is a framework-agnostic TypeScript library that translates ACP protocol events into normalized, renderable state. It provides:

- **WebSocket Transport**: Bidirectional communication with the Rust bridge
- **Session Management**: JSON-RPC based session lifecycle management
- **Event Processing**: Real-time ACP event handling and normalization
- **State Normalization**: Converts ACP payloads into consistent state shape
- **Replay Support**: Recorded session playback for demos and testing
- **Capture System**: Session recording for later replay

**Key Features:**
- ✅ Framework-agnostic (works with React, Vue, Svelte, Angular, Vanilla JS)
- ✅ Type-safe with comprehensive TypeScript definitions
- ✅ Event-driven architecture with typed subscriptions
- ✅ Replay and capture functionality
- ✅ Minimal bundle size (no UI dependencies)

**Installation:**
```bash
npm install @acp/chat-core
# or
pnpm add @acp/chat-core
```

---

### acp-chat-react

**Reference React Implementation**

`acp-chat-react` is a complete React implementation built on top of `acp-chat-core`, providing ready-to-use components and hooks for building ACP-powered chat interfaces.

**Components Include:**
- Thread view with timeline rendering
- Message cards with status indicators
- Composer input with slash commands
- Thought stack for agent reasoning
- Tool call display
- Permission request handling
- Settings panel
- Session list

**Installation:**
```bash
npm install @acp/chat-react
# or
pnpm add @acp/chat-react
```

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                     Your UI Framework                        │
│            (React, Vue, Svelte, Angular, Vanilla)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Consumes NormalizedState
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   acp-chat-core                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SessionController / ReplayController                │  │
│  │  - JSON-RPC request/response                         │  │
│  │  - Event emission (statusChange, sessionUpdate, ...) │  │
│  │  - Permission handling                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           │ Uses                             │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  NormalizedState                                     │  │
│  │  - Messages Map                                      │  │
│  │  - Thoughts Map                                      │  │
│  │  - ToolCalls Map                                     │  │
│  │  - PermissionRequests Map                            │  │
│  │  - Timeline Order                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           │ Wraps                            │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TransportClient (WebSocket)                         │  │
│  │  - Connection management                             │  │
│  │  - Automatic reconnection                            │  │
│  │  - Message parsing                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ WebSocket (BridgeEnvelope)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Rust Bridge                               │
│  - ACP agent communication                                 │
│  - Process management                                       │
│  - Event wrapping in BridgeEnvelope                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 Documentation Navigation

### ACP Chat Core Documentation

| Page | Description |
|------|-------------|
| **[Architecture](./Architecture)** | High-level architecture, layers, and design patterns |
| **[Types Reference](./Types-Reference)** | Complete catalog of all exported types with definitions |
| **[Events](./Events)** | Event system documentation, flows, and processing |
| **[Session Management](./Session-Management)** | SessionController API, usage, and patterns |
| **[Implementation Guide](./Implementation-Guide)** | Framework-agnostic guide for building ACP chat UIs |

---

### ACP Chat React Documentation

| Page | Description |
|------|-------------|
| **[React Home](../acp-chat-react/Home)** | Overview of React implementation |

---

### Protocol & External References

| Page | Description |
|------|-------------|
| **[ACP Protocol](../ACP-Protocol)** | Official ACP protocol specification reference |

---

### Additional Resources

| Page | Description |
|------|-------------|
| **[Glossary](../Glossary)** | Terminology and key concepts |
| **[Troubleshooting](../Troubleshooting)** | Common issues and solutions |
| **[Contributing](../Contributing)** | Development and contribution guidelines |

---

## 🚀 Quick Start

### Basic Setup (Framework Agnostic)

```typescript
import { 
  SessionController, 
  createNormalizedState, 
  applySessionUpdate 
} from '@acp/chat-core';

// 1. Create session controller
const controller = new SessionController('ws://localhost:8765');

// 2. Create normalized state
const state = createNormalizedState();

// 3. Subscribe to session updates
controller.on('sessionUpdate', (params) => {
  const item = applySessionUpdate(state, params);
  if (item) {
    console.log('Received:', item);
    // Update your UI here
  }
});

// 4. Connect and initialize
controller.connect();
await controller.initialize({ name: 'MyApp', version: '1.0.0' });

// 5. Create a session
const result = await controller.createSession('/workspace', []);
console.log('Session ID:', result.sessionId);

// 6. Send a prompt
await controller.sendPrompt(result.sessionId, 'Hello, world!');
```

### React Setup

**Note:** The following example demonstrates the pattern. Actual hook names and exports may vary - check the [acp-chat-react documentation](./acp-chat-react-Home) for the current API.

```tsx
import { SessionController } from '@acp/chat-core';
import { AcpStore } from '@acp/chat-react';
import { Thread } from '@acp/chat-react';
import { Composer } from '@acp/chat-react';
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
    <div>
      <Thread store={store} controller={controller} />
      <Composer store={store} controller={controller} />
    </div>
  );
}
```

---

## 🔑 Key Concepts

### Sessions

A **session** is an independent conversation context with a unique ID. Each session maintains its own:
- Message history
- Agent state
- Tool call history
- Permission requests
- Configuration (mode, model, etc.)

### Prompt Turns

A **prompt turn** is the complete lifecycle of a user prompt:
1. User sends prompt via `session/prompt`
2. Agent processes and streams updates via `session/update`
3. Agent may request permissions
4. Agent executes tools
5. Turn completes with status (completed, cancelled, error)

### Events

ACP uses a three-layer event system:
1. **Transport Layer**: Raw BridgeEnvelope messages from WebSocket
2. **Session Layer**: Typed events from SessionController (statusChange, sessionUpdate, etc.)
3. **Application Layer**: Framework-specific event handling (React hooks, etc.)

### Normalization

**Normalization** is the process of converting raw ACP payloads into a consistent, renderable state shape. The `NormalizedState` includes:
- `messages`: Map of all user and agent messages
- `thoughts`: Map of agent reasoning chunks
- `toolCalls`: Map of tool invocations
- `permissionRequests`: Map of pending permissions
- `timelineOrder`: Chronological ordering of all items

### Replay

**Replay** allows you to record and playback ACP sessions:
- **Capture**: Record live sessions to JSONL files
- **Playback**: Replay recorded sessions for demos, testing, or debugging
- **Modes/Models**: Fake modes and models for UI consistency

**Example:**
```ts
const replay = new ReplayController({ script: "session.jsonl" });
replay.connect();
await replay.initialize();
await replay.initReplay("feature-demo", "abc-123", 1.0); // 1.0 = normal speed
```

---

## 🎯 Design Philosophy

acp-chat-core follows these core principles:

1. **Framework Agnostic**: Core logic has zero framework dependencies
2. **Event-Driven**: All state changes flow through typed events
3. **Immutable State**: Snapshots are immutable copies, never references
4. **Type Safety**: Comprehensive TypeScript types throughout
5. **Separation of Concerns**: Transport, session, normalization, and UI are distinct layers
6. **Defensive Programming**: Timeouts, error handling, and cleanup at all layers

---

## 📊 Version Information

| Package | Version | License |
|---------|---------|---------|
| @acp/chat-core | 0.0.1 | MIT |
| @acp/chat-react | 0.0.1 | MIT |

**Dependencies:**
- TypeScript: ^5.7.0
- Vitest: ^2.1.0 (testing)

**Generated Types:**
The `src/generated/` directory contains TypeScript types auto-generated from Rust via [ts-rs](https://github.com/Aleph-Alpha/ts-rs). **DO NOT EDIT** these files manually - they are synchronized with the Rust bridge's wire format.

---

## 🔗 External Resources

- [Agent Client Protocol](https://agentclientprotocol.com) - Official ACP documentation
- [ACP TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk) - Official type definitions
- [Rust Bridge Repository](#) - Bridge implementation (link TBD)

---

## 📝 Getting Help

- **Documentation**: Browse this wiki for comprehensive guides
- **Troubleshooting**: Check the [Troubleshooting](./Troubleshooting) page for common issues
- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Ask questions and share ideas in GitHub Discussions

---

## 🤝 Contributing

We welcome contributions! See the [Contributing](./Contributing) guide for:
- Development setup
- Code style guidelines
- Testing requirements
- Documentation standards
- Pull request process

---

**Last Updated:** April 2026

**Maintained By:** ACP Chat Core Team
