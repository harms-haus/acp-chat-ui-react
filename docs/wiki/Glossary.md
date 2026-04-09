# Glossary

Terminology reference for ACP Chat UI documentation.

## Core Terms

### ACP (Agent Client Protocol)
Protocol for communication between clients and AI agents. Defines JSON-RPC 2.0 based message format and session management.

### Session
Isolated conversation context between client and agent. Contains message history, state, and configuration.

### Prompt Turn
Single request/response cycle in a conversation. User sends prompt, agent processes and responds.

### Bridge
Middleware component (`harms_haus_acp_ws_bridge`) that translates between WebSocket and ACP stdio protocols.

### Envelope
Versioned message wrapper (`BridgeEnvelope`) used for all bridge communication. Contains metadata and payload.

### Normalization
Process of converting raw ACP events into UI-ready state representation.

### Timeline
Ordered sequence of messages, thoughts, and tool calls in a conversation.

### Thought
Agent's internal reasoning process, separate from final response. Can be expanded/collapsed in UI.

### Tool Call
Agent invocation of external tools (file operations, code execution, etc.). Requires permission.

### Permission Request
Agent request for user permission before executing certain tool calls.

### Replay
Playback of recorded session from captured events.

### Capture
Recording of session events for later replay.

## Technical Terms

### TransportClient
WebSocket client implementation in `@harms-haus/acp-chat-core`. Manages connection lifecycle.

### SessionController
Core class managing ACP session lifecycle, event processing, and state updates.

### NormalizedState
Flattened, UI-ready state representation derived from raw ACP events.

### AcpStore
React store implementation providing subscription-based state updates.

### BridgeEnvelope
Standard message format for all bridge communication. Includes version, sequence, timestamp, and payload.

### ConnectionStatus
Enumeration of WebSocket connection states: `disconnected`, `connecting`, `connected`, `reconnecting`, `error`.

### ContentBlock
Unit of message content (text, image, audio, resource link, embedded resource).

### MessageRole
Sender role: `user`, `agent`, or `system`.

### ToolCallKind
Tool categorization: `read_only`, `write`, `execute`, or `other`.

## State Terms

### Snapshot
Immutable state representation at a point in time. Used for version-based invalidation.

### Batched Notifications
Grouped state updates sent to subscribers for performance optimization.

### Optimistic Update
UI update applied before server confirmation, rolled back on error.

## Event Terms

### SessionUpdate
Event emitted when session state changes.

### StatusChange
Event emitted when connection status changes.

### Traffic
Network traffic event (request/response).

## Related Documentation

- [ACP Protocol](./ACP-Protocol) - Protocol specification
- [Architecture](./acp-chat-core-Architecture) - System overview
- [Types Reference](./acp-chat-core-Types-Reference) - Type definitions
- [Events](./acp-chat-core-Events) - Event system
