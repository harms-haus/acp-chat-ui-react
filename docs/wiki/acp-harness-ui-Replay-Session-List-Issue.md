# Replay Session List Issue - Architectural Analysis

## Problem Statement

When connecting via replay mode in the harness UI, the sessions list is not appearing. The `SessionList` component checks for `listSessions()` and `loadSession()` methods on the controller, and `BridgeAdapter` doesn't implement them.

## ACP Protocol Already Has Session Management

ACP protocol defines (see https://agentclientprotocol.com/protocol/schema):
- `session/list` - Returns list of available sessions
- `session/load` - Load an existing session by ID
- `session/new` - Create a new session

These are **ACP JSON-RPC methods** (NOT custom bridge events).

## Current Architecture

### Package Purity Constraints

Per the user's requirements:
- **acp-chat-core** - MUST remain replay-free
- **acp-chat-react** - MUST remain replay-free
- **acp-ws-bridge** (bridge protocol) - MUST remain replay-free (transport only)
- **acp-harness-ui** - CAN have replay-specific adapters
- **crates/acp-harness-server** - CAN have replay logic

### Rust Server Already Implements ACP Session Methods

The Rust harness server already handles:
- `session/list` (replay.rs:1067-1097) - Returns sessions from manifest
- `session/load` (replay.rs:929+) - Loads session and starts replay

### Current Flow (BROKEN)

```
1. User clicks Connect in ReplayPanel
2. BridgeAdapter created, calls connect()
3. WsTransport connects to WebSocket
4. BridgeAdapter.initialize({ name, version }, replayDataPath)
5. Rust server receives initialize, loads manifest
6. Rust sends initialize response (ACP payload)
7. BridgeAdapter.initialize() resolves
8. App.tsx sets isConnected=true
9. SessionsSidebar renders with controller=BridgeAdapter, isConnected=true
10. SessionList checks: typeof controller.listSessions === 'function'
11. BridgeAdapter DOES NOT HAVE listSessions() method  <-- ROOT CAUSE
12. SessionList shows "Session list is not available"
```

### Root Cause

`BridgeAdapter` is a minimal adapter that only provides:
- `connect()`, `disconnect()`, `getState()`, `on()`
- `initialize()`, `setConfigOption()`, `startAgent()`, `respondToPermission()`

It does NOT implement the session management interface:
- `listSessions(cursor?, cwd?)` - Should call ACP `session/list`
- `loadSession(sessionId, cwd)` - Should call ACP `session/load`

## Solution Design

### Update BridgeAdapter to Implement ACP Session Methods

The fix is simple: implement `listSessions()` and `loadSession()` in `BridgeAdapter` that call the existing ACP methods via the transport.

```typescript
// In packages/acp-harness-ui/src/bridge-adapter/bridge-adapter.ts

async listSessions(cursor?: string, cwd?: string): Promise<{ sessions: SessionItem[], nextCursor?: string }> {
    if (!this.transport) {
        throw new Error('Not connected');
    }

    const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'session/list',
        params: { ...(cursor ? { cursor } : {}), ...(cwd ? { cwd } : {}) },
    };

    const response = await this.transport.sendRequest(request);
    if (response.error) {
        throw new Error(response.error.message);
    }
    return response.result as { sessions: SessionItem[], nextCursor?: string };
}

async loadSession(sessionId: string, cwd: string): Promise<void> {
    if (!this.transport) {
        throw new Error('Not connected');
    }

    const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'session/load',
        params: { sessionId, cwd },
    };

    const response = await this.transport.sendRequest(request);
    if (response.error) {
        throw new Error(response.error.message);
    }
    // Session loaded - Rust server will start replay streaming
}
```

### Expected Flow (FIXED)

```
1. User clicks Connect in ReplayPanel
2. BridgeAdapter connects and initializes
3. App.tsx sets isConnected=true
4. SessionList checks: typeof controller.listSessions === 'function' -> TRUE
5. SessionList calls controller.listSessions()
6. BridgeAdapter sends ACP session/list request via WsTransport
7. Rust server responds with sessions from manifest
8. SessionList displays sessions
9. User clicks a session
10. SessionList calls controller.loadSession(sessionId, cwd)
11. BridgeAdapter sends ACP session/load request
12. Rust server loads session and starts replay streaming
```

## Files to Modify

### TypeScript (packages/acp-ws-bridge)
- `src/ws-transport.ts` - Handle `bridge_status` envelopes, emit events via `onBridgeStatus`

### TypeScript (packages/acp-harness-ui)
- `src/bridge-adapter/bridge-adapter.ts` - Implement `listSessions`, `loadSession`, listen to `onBridgeStatus`, fix initialize params

## Changes Made

### 1. WsTransport - Handle bridge_status envelopes

Added `onBridgeStatus` callback to `WsTransport` so consumers can listen to bridge lifecycle events:

```typescript
// In ws-transport.ts
private bridgeStatusHandlers = new Set<(status: BridgeStatus) => void>();

onBridgeStatus(handler: (status: BridgeStatus) => void): () => void {
  this.bridgeStatusHandlers.add(handler);
  return () => this.bridgeStatusHandlers.delete(handler);
}

private handleBridgeEnvelope(envelope: BridgeEnvelope): void {
  // Handle bridge_status messages (bridge protocol lifecycle events)
  if (envelope.type === 'bridge_status') {
    const status = envelope.status;
    this.bridgeStatusHandlers.forEach(h => h(status));
    return;
  }
  // ... existing acp_payload handling
}
```

### 2. BridgeAdapter - Listen to bridge_status

Added `onBridgeStatus` listener in `connect()` to update `bridgeStatus` state:

```typescript
this.transport.onBridgeStatus?.((status) => {
  this.setState({ bridgeStatus: status });
});
```

### 3. BridgeAdapter - Fix initialize params

Changed from `params.replay_data_path` to `params._meta.replay.replayDataPath` to match Rust server expectations:

```typescript
params: {
  client_info: config,
  _meta: replayDataPath ? {
    replay: { replayDataPath },
  } : {},
},
```

### 4. BridgeAdapter - Implement listSessions and loadSession

Added ACP `session/list` and `session/load` methods.

### 5. BridgeAdapter - Forward ACP notifications (sessionUpdate, sessionClearing)

The `AcpStore` subscribes to `SessionController` events (`sessionUpdate`, `sessionClearing`, etc.) to update its normalized state. `BridgeAdapter` now mirrors this behavior:

- Subscribes to `WsTransport.onNotification()` in `connect()`
- `handleNotification()` parses `session/update` and `session/request_permission` notifications
- Emits `sessionUpdate` events to `AcpStore` (which listens via `sessionController.on("sessionUpdate", ...)`)
- Emits `sessionClearing` before `loadSession()` to reset the store
- Emits `permissionRequest` for permission prompts

This is the key fix for the session loading issue. Without notification forwarding, the Rust server streams replay events but the `AcpStore` never receives them.

## Validation Checklist

- [x] WsTransport handles bridge_status envelopes
- [x] WsTransport exposes onBridgeStatus callback
- [x] BridgeAdapter listens to onBridgeStatus
- [x] BridgeAdapter initializes with correct _meta.replay.replayDataPath format
- [x] BridgeAdapter implements listSessions() that calls ACP session/list
- [x] BridgeAdapter implements loadSession() that calls ACP session/load
- [x] BridgeAdapter subscribes to WsTransport.onNotification()
- [x] BridgeAdapter forwards session/update notifications as sessionUpdate events
- [x] BridgeAdapter emits sessionClearing before loadSession()
- [x] BridgeAdapter forwards session/request_permission as permissionRequest events
- [x] Build succeeds
- [ ] SessionList shows sessions when connected via replay (needs manual testing)
- [ ] Clicking a session loads it and streams replay events to UI (needs manual testing)
- [x] acp-chat-core remains replay-free (unchanged)
- [x] acp-chat-react remains replay-free (unchanged)
- [x] acp-ws-bridge remains replay-free (transport only, bridge_status is core bridge protocol)

## Notes on Custom Events vs ACP Protocol

The user's constraint about custom events is important:

> "Any replay packages on the web-socket MUST BE CUSTOM EVENTS and be exclusive to the bridge protocol (NO CUSTOM ACP EXTENSIONS)"

This means:
- Replay-specific features (like `replay_speed`, `replay_metadata`) use custom BridgeMessage types
- Standard session management (`session/list`, `session/load`) uses ACP protocol

The current architecture is correct:
- `replay_metadata` - Custom BridgeMessage (exclusive to bridge)
- `session/list`, `session/load` - ACP protocol (standard JSON-RPC)

The fix only requires implementing ACP methods in BridgeAdapter, not adding new bridge message types.