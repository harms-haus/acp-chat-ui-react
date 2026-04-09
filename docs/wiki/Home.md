# ACP Chat UI Documentation

Welcome to the **ACP Chat UI** documentation - a comprehensive suite for building AI agent chat interfaces.

## Packages

This documentation covers two main packages:

### [@harms-haus/acp-chat-core](./acp-chat-core-Home)
Framework-agnostic core library providing:
- WebSocket transport layer
- Session management
- Event-driven architecture
- Replay and capture systems

### [@harms-haus/acp-chat-react](./acp-chat-react-Home)
React implementation providing:
- Ready-to-use components
- React hooks
- Store management
- Height estimation

## Quick Start

1. **Install packages**:
```bash
npm install @harms-haus/acp-chat-core @harms-haus/acp-chat-react
```

2. **Basic usage**:
```typescript
import { SessionController } from '@harms-haus/acp-chat-core';
import { Thread, Composer } from '@harms-haus/acp-chat-react';
```

3. **See examples**: [Implementation Guide](./acp-chat-core-Implementation-Guide)

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                 Your Application                    │
├─────────────────────────────────────────────────────┤
│           @harms-haus/acp-chat-react                │
│  (Components, Hooks, Store)                         │
├─────────────────────────────────────────────────────┤
│         @harms-haus/acp-chat-core                   │
│  (Session Controller, Transport, Normalization)     │
├─────────────────────────────────────────────────────┤
│              WebSocket Bridge                       │
│         (harms_haus_acp_ws_bridge)                  │
├─────────────────────────────────────────────────────┤
│              ACP Agent (stdior)                      │
└─────────────────────────────────────────────────────┘
```

## Core Concepts

- **SessionController**: Manages ACP session lifecycle and events
- **BridgeEnvelope**: Versioned WebSocket message format
- **NormalizedState**: UI-ready state representation
- **Replay System**: Session recording and playback
- **Event System**: Three-layer event processing

## Documentation Sections

### ACP Chat Core
- [Architecture](./acp-chat-core-Architecture) - High-level design
- [Types Reference](./acp-chat-core-Types-Reference) - Complete type catalog
- [Events](./acp-chat-core-Events) - Event system documentation
- [Session Management](./acp-chat-core-Session-Management) - Controller API
- [ACP Protocol](./ACP-Protocol) - Protocol specification
- [Implementation Guide](./acp-chat-core-Implementation-Guide) - Framework-agnostic patterns

### ACP Chat React
- [Components](./acp-chat-react-Components) - Component reference
- [Hooks](./acp-chat-react-Hooks) - React hooks
- [Store](./acp-chat-react-Store) - Store architecture
- [Examples](./acp-chat-react-Examples) - Integration examples

### Additional Resources
- [Glossary](./Glossary) - Terminology reference
- [Troubleshooting](./Troubleshooting) - Common issues
- [Contributing](./Contributing) - Contribution guidelines

## Version Information

| Package | Version |
|---------|---------|
| @harms-haus/acp-chat-core | 0.0.1 |
| @harms-haus/acp-chat-react | 0.0.1 |
| harms_haus_acp_ws_bridge | 0.1.0 |

---

**Last Updated**: April 2026  
**Maintained By**: ACP Chat Core Team
