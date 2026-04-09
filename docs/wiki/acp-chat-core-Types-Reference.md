# Types Reference

Complete catalog of all exported types from `@harms-haus/acp-chat-core`.

## Transport/Bridge Types

### `ConnectionStatus`
Connection state enumeration.

```typescript
type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'error';
```

**File**: `src/transport/client.ts`  
**Purpose**: Represents WebSocket connection state.

---

### `TransportConfig`
Configuration for TransportClient.

```typescript
interface TransportConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}
```

**File**: `src/transport/client.ts`  
**Purpose**: Configure WebSocket connection parameters.

---

### `BridgeEnvelope`
Versioned message wrapper.

```typescript
interface BridgeEnvelope {
  version: number;
  seq: number;
  timestamp_ms: number;
  extraData?: Record<string, unknown>;
  type: string;
  payload: unknown;
}
```

**File**: `src/generated/BridgeEnvelope.ts`  
**Purpose**: Standard envelope format for all bridge messages.

---

### `BridgeMessage`
Union of all message types.

```typescript
type BridgeMessage = 
  | AcpPayloadMessage
  | BridgeStatusMessage
  | StderrMessage
  | ProcessExitMessage
  | ReplayMetadataMessage
  | StartAgentMessage;
```

**File**: `src/generated/BridgeMessage.ts`  
**Purpose**: All possible message variants.

---

### `BridgeStatus`
Bridge lifecycle status.

```typescript
interface BridgeStatus {
  status: 'connected' | 'disconnected' | 'error';
  message?: string;
}
```

**File**: `src/generated/BridgeStatus.ts`  
**Purpose**: Bridge connection status updates.

---

## Session/Controller Types

### `SessionControllerState`
Session controller state snapshot.

```typescript
interface SessionControllerState {
  status: ConnectionStatus;
  sessionId: string | null;
  mode: string | null;
  model: string | null;
  // ... additional fields
}
```

**File**: `src/session/SessionController.ts`  
**Purpose**: Complete session state representation.

---

### `StartAgentConfig`
Configuration for starting an agent.

```typescript
interface StartAgentConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}
```

**File**: `src/session/SessionController.ts`  
**Purpose**: Agent startup configuration.

---

### `PermissionRequestParams`
Permission request parameters.

```typescript
interface PermissionRequestParams {
  tool_call_id: string;
  tool_name: string;
  arguments: unknown;
}
```

**File**: `src/session/SessionController.ts`  
**Purpose**: Permission request payload structure.

---

## Replay Types

### `ReplayMode`
Replay mode enumeration.

```typescript
type ReplayMode = 'live' | 'replay';
```

**File**: `src/replay/types.ts`  
**Purpose**: Distinguish live vs replay mode.

---

### `ReplayControllerOptions`
Replay controller configuration.

```typescript
interface ReplayControllerOptions {
  replayData: ReplaySessionData;
  speed?: number;
  loop?: boolean;
}
```

**File**: `src/session/ReplayController.ts`  
**Purpose**: Configure replay behavior.

---

### `ReplaySessionData`
Complete replay session data structure.

```typescript
interface ReplaySessionData {
  metadata: ReplaySessionMetadata;
  events: ReplayEvent[];
}
```

**File**: `src/replay/types.ts`  
**Purpose**: Full replay session representation.

---

## State/Normalization Types

### `NormalizedState`
UI-ready normalized state.

```typescript
interface NormalizedState {
  messages: NormalizedMessage[];
  thoughts: NormalizedThought[];
  toolCalls: NormalizedToolCall[];
  permissionRequests: NormalizedPermissionRequest[];
  status: NormalizedStatus;
}
```

**File**: `src/normalization/types.ts`  
**Purpose**: Flattened state for UI consumption.

---

### `NormalizedMessage`
Normalized message representation.

```typescript
interface NormalizedMessage {
  id: string;
  role: MessageRole;
  content: ContentBlock[];
  status: MessageStatus;
  timestamp: number;
}
```

**File**: `src/normalization/types.ts`  
**Purpose**: Standardized message format.

---

### `MessageRole`
Message role enumeration.

```typescript
type MessageRole = 'user' | 'agent' | 'system';
```

**File**: `src/normalization/types.ts`  
**Purpose**: Message sender role.

---

### `ContentBlockType`
Content block type enumeration.

```typescript
type ContentBlockType = 
  | 'text' 
  | 'image' 
  | 'audio' 
  | 'resource_link' 
  | 'embedded_resource';
```

**File**: `src/normalization/types.ts`  
**Purpose**: Content block classification.

---

### `ToolCallKind`
Tool call type enumeration.

```typescript
type ToolCallKind = 
  | 'read_only' 
  | 'write' 
  | 'execute' 
  | 'other';
```

**File**: `src/normalization/types.ts`  
**Purpose**: Tool call categorization.

---

## Helper Types

### `ComposerState`
Composer input state.

```typescript
interface ComposerState {
  value: string;
  isComposing: boolean;
  lifecycle: 'idle' | 'submitting' | 'submitted';
}
```

**File**: `src/helpers/composer.ts`  
**Purpose**: Composer component state management.

---

### `ThoughtGroup`
Grouped thought items.

```typescript
interface ThoughtGroup {
  id: string;
  thoughts: ThoughtItem[];
  isExpanded: boolean;
}
```

**File**: `src/helpers/thought-grouping.ts`  
**Purpose**: Thought grouping for UI display.

---

### `GroupedTimelineItem`
Timeline item with grouping information.

```typescript
interface GroupedTimelineItem {
  id: string;
  type: 'message' | 'thought' | 'tool_call';
  data: unknown;
  group?: ThoughtGroup;
}
```

**File**: `src/helpers/timeline.ts`  
**Purpose**: Timeline rendering with grouping.

---

## Related Documentation

- [Architecture](./acp-chat-core-Architecture) - System overview
- [Events](./acp-chat-core-Events) - Event system
- [Session Management](./acp-chat-core-Session-Management) - Controller API
- [Implementation Guide](./acp-chat-core-Implementation-Guide) - Usage patterns
