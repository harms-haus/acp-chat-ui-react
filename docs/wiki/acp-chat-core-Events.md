# ACP Chat Core Events

Complete documentation of the event system in `@harms-haus/acp-chat-core`.

## Event Flow Architecture

The event system operates in three layers:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Store Layer                                   │
│  (AcpStore notifications - batched state updates)      │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Session Layer                                 │
│  (SessionController events - session updates)          │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Transport Layer                               │
│  (TransportClient events - raw envelopes)              │
└─────────────────────────────────────────────────────────┘
```

## Transport Layer Events (BridgeEnvelope)

These events come directly from the WebSocket bridge:

### `acp_payload`
Raw JSON-RPC message from ACP agent.

### `bridge_status`
Bridge lifecycle status (connected, disconnected, etc.).

### `stderr`
Process stderr output.

### `process_exit`
Process termination notification.

### `replay_metadata`
Replay session metadata (used in replay mode).

### `start_agent`
Agent start command (used in live mode).

## SessionController Events

The SessionController emits these events:

### `statusChange`
```typescript
interface StatusChangeEvent {
  type: 'statusChange';
  status: ConnectionStatus;
}
```

### `sessionUpdate`
```typescript
interface SessionUpdateEvent {
  type: 'sessionUpdate';
  update: SessionUpdate;
}
```

### `traffic`
Network traffic events.

### `error`
Error events from the session.

### `sessionClearing`
Session is being cleared/reset.

### `permissionRequest`
Permission request from agent.

## ACP Session Update Types

### `user_message` / `user_message_chunk`
User message content.

### `agent_message_chunk`
Streaming agent response.

### `agent_thought_chunk`
Agent thought process (internal reasoning).

### `tool_call`
Tool invocation by agent.

### `tool_call_update`
Tool call status update.

### `permission_request`
Permission request for tool execution.

## JSON-RPC Methods (ACP Protocol)

| Method | Direction | Description |
|--------|-----------|-------------|
| `session/update` | Agent → Client | Session state update |
| `session/request_permission` | Agent → Client | Request permission |
| `session/new` | Client → Agent | Create new session |
| `session/load` | Client → Agent | Load existing session |
| `session/prompt` | Client → Agent | Send prompt |
| `session/cancel` | Client → Agent | Cancel current prompt |
| `initialize` | Client → Agent | Initialize connection |

## Status Values

### Message Status
- `pending` - Awaiting processing
- `streaming` - Currently streaming
- `complete` - Finished
- `error` - Encountered error

### Tool Call Status
- `pending` - Awaiting execution
- `executing` - Currently executing
- `complete` - Execution finished
- `error` - Execution failed

### Permission Request Status
- `pending` - Awaiting user response
- `accepted` - User accepted
- `rejected` - User rejected

### Connection Status
- `disconnected` - Not connected
- `connecting` - Attempting connection
- `connected` - Connected and ready
- `reconnecting` - Reconnecting
- `error` - Connection error

## Event Processing Flow

### Request/Response Flow
```
1. Client sends prompt via SessionController
2. TransportClient wraps in BridgeEnvelope
3. WebSocket sends to bridge
4. Bridge forwards to ACP agent
5. Agent processes and responds
6. Response wrapped in BridgeEnvelope
7. TransportClient emits envelope event
8. SessionController processes update
9. State normalized and emitted
10. UI updates
```

### Event Batching
- Store batches notifications for performance
- Thought events grouped by session update
- Timeline items ordered by timestamp
- Permission requests filtered and deduplicated

## Event Processing Pipeline

```typescript
// 1. Transport receives envelope
transport.on('envelope', (envelope) => {
  // 2. Session processes envelope
  session.handleEnvelope(envelope);
  
  // 3. Session emits normalized update
  session.on('sessionUpdate', (update) => {
    // 4. Normalization applies update
    const newState = applySessionUpdate(state, update);
    
    // 5. Store emits notification
    store.notify(newState);
  });
});
```

## Related Documentation

- [Types Reference](./acp-chat-core-Types-Reference) - Type definitions
- [Session Management](./acp-chat-core-Session-Management) - Controller API
- [ACP Protocol](./ACP-Protocol) - Protocol specification
- [Implementation Guide](./acp-chat-core-Implementation-Guide) - Usage patterns
