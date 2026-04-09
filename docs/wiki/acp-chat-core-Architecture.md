# ACP Chat Core Architecture

High-level architecture documentation for `@harms-haus/acp-chat-core`.

## Purpose and Goals

`@harms-haus/acp-chat-core` is a framework-agnostic library that provides:
- WebSocket transport for ACP (Agent Client Protocol) communication
- Session lifecycle management
- Event-driven state updates
- Normalized state representation
- Replay and capture functionality

## Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Application Layer                          │
│         (Your UI Components)                            │
├─────────────────────────────────────────────────────────┤
│         Normalization Layer                             │
│   (createNormalizedState, applySessionUpdate)          │
├─────────────────────────────────────────────────────────┤
│         Session Layer                                   │
│   (SessionController, ReplayController)                │
├─────────────────────────────────────────────────────────┤
│         Transport Layer                                 │
│   (TransportClient, WebSocket connection)              │
├─────────────────────────────────────────────────────────┤
│         Bridge Protocol Layer                           │
│   (BridgeEnvelope parsing/validation)                  │
├─────────────────────────────────────────────────────────┤
│         WebSocket Bridge                                │
│   (harms_haus_acp_ws_bridge)                            │
└─────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Generated Types Layer (`src/generated/`)
TypeScript types generated from Rust via ts-rs:
- `BridgeEnvelope` - Versioned message wrapper
- `BridgeMessage` - Union of all message types
- `BridgeStatus` - Connection status messages
- `UnsupportedVersionError` - Version negotiation errors

### 2. Transport Layer (`src/transport/`)
WebSocket communication:
- `TransportClient` - Manages WebSocket connection
- Connection state machine (disconnected, connecting, connected, reconnecting, error)
- Event emission for status changes and envelopes

### 3. Bridge Layer (`src/bridge/`)
Envelope parsing utilities:
- `parseEnvelope()` - Parse envelope from JSON
- `parseEnvelopeSafe()` - Safe parsing with error handling
- `validateEnvelope()` - Version validation
- `ENVELOPE_VERSION` constant

### 4. Session Layer (`src/session/`)
Session management:
- `SessionController` - Live ACP session management
- `ReplayController` - Replay session management
- `CaptureInterceptor` - Session recording

### 5. Normalization Layer (`src/normalization/`)
State normalization:
- `createNormalizedState()` - Create initial normalized state
- `applySessionUpdate()` - Apply updates to state
- Selectors for derived state

### 6. Configuration Layer (`src/presets/`)
Launch preset parsing:
- `parseLaunchPreset()` - Parse preset strings
- Support for multiple preset formats

### 7. Replay Data Layer (`src/replay/`)
Replay types and utilities:
- `ReplayMode` - Replay mode enumeration
- `ReplayModel` - Replay model configuration
- Replay event structures

### 8. UI Helpers Layer (`src/helpers/`)
Pure logic functions:
- Composer logic (input validation, lifecycle tracking)
- Thought grouping algorithms
- Timeline processing

## Data Flow

```
User Action
    ↓
SessionController.sendPrompt()
    ↓
TransportClient.send()
    ↓
WebSocket (BridgeEnvelope)
    ↓
ACP Agent (stdio)
    ↓
BridgeEnvelope response
    ↓
TransportClient events
    ↓
SessionController events
    ↓
AcpStore state update
    ↓
UI re-render
```

## Key Design Patterns

### 1. Event-Driven Architecture
- Three-layer event system (Transport → Session → Store)
- Subscriber pattern with cleanup functions
- Batched notifications for performance

### 2. Immutable State Snapshots
- All state updates create new snapshots
- Version-based invalidation
- Deep cloning for safety

### 3. Framework Agnosticism
- Pure logic functions (no framework dependencies)
- Event-based communication
- Snapshot-based state retrieval

### 4. Defensive Programming
- Multiple layers of error handling
- Type-safe envelope parsing
- Version negotiation

## Generated Types Warning

⚠️ **Important**: Types in `src/generated/` are auto-generated from Rust via ts-rs. Do not modify these files manually. Updates must be made to the Rust source and regenerated.

## Related Documentation

- [Types Reference](./acp-chat-core-Types-Reference) - Complete type catalog
- [Events](./acp-chat-core-Events) - Event system details
- [Session Management](./acp-chat-core-Session-Management) - Controller API
- [Implementation Guide](./acp-chat-core-Implementation-Guide) - Usage patterns
