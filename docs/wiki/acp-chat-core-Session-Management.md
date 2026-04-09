# Session Management

Documentation for SessionController architecture and usage in `@harms-haus/acp-chat-core`.

## SessionController Class Structure

The `SessionController` manages ACP session lifecycle and event processing.

### Class Fields

```typescript
class SessionController {
  private transport: TransportClient;
  private state: SessionControllerState;
  private eventHandlers: Map<string, Set<EventHandler>>;
  private pendingRequests: Map<string, PromiseHandler>;
  // ... additional fields
}
```

### State Management

- Immutable state snapshots
- Defensive copying on access
- Version-based invalidation

## Public APIs

### Lifecycle Methods

#### `connect()`
Establishes WebSocket connection.

```typescript
async connect(): Promise<void> {
  await this.transport.connect();
}
```

#### `disconnect()`
Closes connection and cleans up.

```typescript
async disconnect(): Promise<void> {
  await this.transport.disconnect();
  this.clearState();
}
```

#### `initialize()`
Initializes session with capabilities.

```typescript
async initialize(config: InitializeConfig): Promise<void> {
  // Send initialize request
  // Wait for acknowledgment
}
```

### Session Operations

#### `createSession()`
Creates a new ACP session.

```typescript
async createSession(
  cwd: string, 
  mcpServers?: unknown[],
  config?: SessionConfig
): Promise<SessionResult> {
  // Implementation
}
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cwd` | `string` | required | Working directory |
| `mcpServers` | `unknown[]` | `[]` | MCP server configurations |
| `config` | `SessionConfig` | `undefined` | Additional session options |

**Returns:** `Promise<SessionResult>` - Session creation result

#### `loadSession()`
Loads an existing session by ID.

```typescript
async loadSession(sessionId: string): Promise<void> {
  // Implementation
}
```

#### `listSessions()`
Lists all available sessions.

```typescript
async listSessions(): Promise<SessionInfo[]> {
  // Implementation
}
```

#### `sendPrompt()`
Sends a prompt to the agent.

```typescript
async sendPrompt(prompt: string): Promise<void> {
  // Implementation
}
```

#### `cancelPrompt()`
Cancels the current prompt processing.

```typescript
async cancelPrompt(): Promise<void> {
  // Implementation
}
```

### Permission Management

#### `respondToPermission()`
Responds to a permission request.

```typescript
async respondToPermission(
  requestId: string, 
  accepted: boolean
): Promise<void> {
  // Implementation
}
```

### Agent Control

#### `startAgent()`
Starts an agent with configuration.

```typescript
async startAgent(config: StartAgentConfig): Promise<void> {
  // Implementation
}
```

#### `initLive()`
Initializes live mode.

```typescript
async initLive(): Promise<void> {
  // Implementation
}
```

## Data Flow

### Request Flow
```
1. User calls sendPrompt()
2. SessionController creates JSON-RPC request
3. Request added to pending requests map
4. TransportClient wraps in BridgeEnvelope
5. WebSocket sends to bridge
6. Bridge forwards to ACP agent
```

### Response Flow
```
1. ACP agent processes request
2. Agent sends response via BridgeEnvelope
3. TransportClient receives and parses envelope
4. SessionController processes session/update
5. State updated and normalized
6. Event emitted to subscribers
7. Pending request resolved
```

## Event Subscription

### Subscribing to Events

```typescript
const controller = new SessionController(config);

// Subscribe to status changes
const unsubscribeStatus = controller.on('statusChange', (status) => {
  console.log('Status changed:', status);
});

// Subscribe to session updates
const unsubscribeUpdate = controller.on('sessionUpdate', (update) => {
  console.log('Session updated:', update);
});

// Cleanup
unsubscribeStatus();
unsubscribeUpdate();
```

### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `statusChange` | `ConnectionStatus` | Connection status changed |
| `sessionUpdate` | `SessionUpdate` | Session state updated |
| `traffic` | `TrafficEvent` | Network traffic event |
| `error` | `Error` | Error occurred |
| `sessionClearing` | `void` | Session being cleared |
| `permissionRequest` | `PermissionRequest` | Permission requested |

---

## Filesystem Handler Registration

The SessionController supports handling ACP filesystem events (`fs/read_text_file` and `fs/write_text_file`) through handler registration.

### `subscribeToFileReads()`

Register a handler for file read requests.

```typescript
subscribeToFileReads(handler: FileReadHandler): FileSystemSubscription {
  return this.fileSystemManager.subscribeToFileReads(handler);
}
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `handler` | `FileReadHandler` | Async function that receives read requests |

**Returns:** `FileSystemSubscription` object with `unsubscribe()` method

**Example:**
```typescript
const subscription = controller.subscribeToFileReads(async (request) => {
  const content = await fs.readFile(request.path, 'utf-8');
  return { content };
});

// Later, to unsubscribe:
subscription.unsubscribe();
```

---

### `subscribeToFileWrites()`

Register a handler for file write requests.

```typescript
subscribeToFileWrites(handler: FileWriteHandler): FileSystemSubscription {
  return this.fileSystemManager.subscribeToFileWrites(handler);
}
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `handler` | `FileWriteHandler` | Async function that receives write requests |

**Returns:** `FileSystemSubscription` object with `unsubscribe()` method

**Example:**
```typescript
const subscription = controller.subscribeToFileWrites(async (request) => {
  await fs.writeFile(request.path, request.content, 'utf-8');
  return { success: true };
});
```

---

### Filesystem Event Flow

```
ACP Bridge (fs/read_text_file)
    ↓
SessionController.handleAcpPayload()
    ↓
Path validation (reject .., /)
    ↓
Call all handlers (Promise.allSettled)
    ↓
First successful response
    ↓
Send JSON-RPC response to bridge
```

**Security:**
- Paths containing `..` (traversal) are rejected
- Absolute paths starting with `/` are rejected
- Multiple handlers supported, first successful response wins
- Graceful degradation: no-op if no handlers registered

---

## Usage Examples

### Basic Initialization

```typescript
import { SessionController } from '@harms-haus/acp-chat-core';

const controller = new SessionController({
  url: 'ws://localhost:8765',
});

// Connect and initialize
await controller.connect();
await controller.initialize({
  capabilities: {
    // Client capabilities
  }
});

// Create session
await controller.createSession('/path/to/project');

// Send prompt
await controller.sendPrompt('Hello, world!');

// Cleanup
await controller.disconnect();
```

### Event Subscription Pattern

```typescript
const controller = new SessionController(config);

// Subscribe to all relevant events
const subscriptions = [
  controller.on('statusChange', handleStatusChange),
  controller.on('sessionUpdate', handleSessionUpdate),
  controller.on('error', handleError),
];

// Cleanup all subscriptions
function cleanup() {
  subscriptions.forEach(unsubscribe => unsubscribe());
}
```

### Permission Handling

```typescript
controller.on('permissionRequest', async (request) => {
  const accepted = await showPermissionDialog(request);
  await controller.respondToPermission(request.id, accepted);
});
```

## Error Handling

### Transport Errors
- Connection failures
- WebSocket errors
- Reconnection attempts

### Request Errors
- Timeout handling
- Invalid responses
- Protocol errors

### Disconnect Cleanup
- Pending request resolution
- State cleanup
- Event handler cleanup

## Related Documentation

- [Architecture](./acp-chat-core-Architecture) - System overview
- [Types Reference](./acp-chat-core-Types-Reference) - Type definitions
- [Events](./acp-chat-core-Events) - Event system
- [ACP Protocol](./ACP-Protocol) - Protocol specification
