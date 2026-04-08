# Events

This page documents the complete event system in `acp-chat-core`. Every event that flows from the bridge WebSocket through to the React UI is covered here — what each event carries, where it originates, and how it is processed.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Event Flow Diagram](#event-flow-diagram)
- [Layer 1 — Transport Events (BridgeEnvelope)](#layer-1--transport-events-bridgeenvelope)
- [Layer 2 — SessionController Events](#layer-2--sessioncontroller-events)
- [Layer 3 — ACP Session Update Types](#layer-3--acp-session-update-types)
- [JSON-RPC Methods](#json-rpc-methods)
- [Status Value Mappings](#status-value-mappings)
- [Event Processing Pipeline](#event-processing-pipeline)
- [Event Batching and Notification Cadence](#event-batching-and-notification-cadence)
- [Timeline Ordering](#timeline-ordering)
- [Thought Grouping Logic](#thought-grouping-logic)

---

## Architecture Overview

The event system is organized in **three distinct layers**, each with its own event types, handlers, and responsibilities:

```
┌──────────────────────────────────────────────────────────┐
│                   Layer 1: Transport                     │
│  BridgeEnvelope types carried over WebSocket             │
│  (acp_payload, bridge_status, stderr, process_exit,      │
│   replay_metadata, start_agent)                          │
│  Source: Rust bridge → WebSocket                         │
│  Handler: TransportClient                                │
├──────────────────────────────────────────────────────────┤
│                   Layer 2: SessionController             │
│  Semantic events emitted by the session layer            │
│  (statusChange, sessionUpdate, traffic, error,           │
│   sessionClearing, permissionRequest)                    │
│  Source: SessionController / ReplayController            │
│  Handler: AcpStore                                       │
├──────────────────────────────────────────────────────────┤
│                   Layer 3: Normalized State              │
│  ACP session update types applied to state               │
│  (agent_message_chunk, agent_thought_chunk,              │
│   user_message, tool_call, tool_call_update,             │
│   permission_request)                                    │
│  Source: AcpStore → applySessionUpdate()                 │
│  Handler: React components via useSyncExternalStore      │
└──────────────────────────────────────────────────────────┘
```

**Key distinction:**
- **BridgeEnvelope events** are the raw wire format — opaque payloads wrapped with version and timestamp metadata. The bridge never interprets ACP payload contents.
- **SessionController events** are semantic events — the controller interprets BridgeEnvelope types and emits meaningful lifecycle events to consumers.
- **ACP session update types** are the normalized domain events that mutate the `NormalizedState` data structure consumed by the UI.

---

## Event Flow Diagram

The complete journey of an event from WebSocket to React component:

```
  Rust Bridge Process
        │
        │  WebSocket (JSON text frames)
        ▼
  ┌─────────────────────────────────┐
  │        TransportClient          │  transport/client.ts
  │                                 │
  │  1. Parse raw JSON              │
  │  2. Check for init responses    │
  │  3. Check for error responses   │
  │  4. parseEnvelopeSafe() →       │
  │     BridgeEnvelope              │
  │  5. emitEnvelope(envelope)      │
  │  6. emitStatusChange(status)    │
  │  7. emitError(error)            │
  └────────────┬────────────────────┘
               │
               │  BridgeEnvelope objects
               ▼
  ┌─────────────────────────────────┐
  │       SessionController         │  session/controller.ts
  │                                 │
  │  handleEnvelope(envelope):      │
  │  ├─ bridge_status → update      │
  │  │   state.bridgeStatus,       │
  │  │   emitStatusChange()        │
  │  │                              │
  │  └─ acp_payload →               │
  │     handleAcpPayload(payload):  │
  │     ├─ Has numeric id?          │
  │     │  → Resolve pending RPC    │
  │     │  → Emit messages/thoughts │
  │     │    from result arrays     │
  │     │                           │
  │     ├─ method=session/update?   │
  │     │  → Unbatch if needed      │
  │     │  → emitSessionUpdate()    │
  │     │                           │
  │     └─ method=                  │
  │        session/request_         │
  │        permission?              │
  │       → emitPermissionRequest() │
  │                                 │
  │  Also emits:                    │
  │  • emitTraffic("in"/"out")      │
  │  • emitError()                  │
  │  • emitSessionClearing()        │
  └────────────┬────────────────────┘
               │
               │  SessionUpdateParams, status objects
               ▼
  ┌─────────────────────────────────┐
  │          AcpStore               │  store/acp-store.ts
  │                                 │
  │  on("statusChange"):            │
  │    → Update sessionState        │
  │    → scheduleNotification()     │
  │                                 │
  │  on("sessionUpdate"):           │
  │    → applySessionUpdate()       │
  │      └─ switch(updateType):     │
  │         agent_message_chunk     │
  │         agent_thought_chunk     │
  │         user_message            │
  │         tool_call               │
  │         tool_call_update        │
  │         permission_request      │
  │    → version++                  │
  │    → scheduleNotification()     │
  │                                 │
  │  on("sessionClearing"):         │
  │    → Reset normalizedState      │
  │    → version++                  │
  │                                 │
  │  Notification batching:         │
  │  setTimeout(16ms) → flush to    │
  │  all subscribers                │
  └────────────┬────────────────────┘
               │
               │  AcpStoreSnapshot (via getSnapshot())
               ▼
  ┌─────────────────────────────────┐
  │     React Components            │
  │                                 │
  │  useSyncExternalStore(          │
  │    store.subscribe,             │
  │    store.getSnapshot,           │
  │    store.getServerSnapshot      │
  │  )                              │
  │                                 │
  │  → Re-render on version change  │
  └─────────────────────────────────┘
```

---

## Layer 1 — Transport Events (BridgeEnvelope)

**File:** `packages/acp-chat-core/src/generated/BridgeEnvelope.ts`

The `BridgeEnvelope` is a versioned discriminated union that wraps every message from the Rust bridge to the browser. Every envelope has a common shape plus a type-specific payload:

```typescript
// Common fields on every BridgeEnvelope
type BridgeEnvelopeCommon = {
  version: number;          // Envelope format version (currently 1)
  seq: number;              // Sequence number (0 in live mode; monotonic in replay)
  timestamp_ms: number;     // Unix timestamp in ms when envelope was created
};
```

The envelope type is determined by the `"type"` discriminant field. There are **6 variants**:

### 1. `acp_payload`

| Field | Description |
|-------|-------------|
| `payload` | `JsonValue` — raw JSON-RPC message from the ACP agent. Opaque to the bridge. |

- **What triggers it:** The ACP agent sends a JSON-RPC message (response or notification) through the bridge. The bridge wraps it without interpretation.
- **State changes:** None at transport level. The payload is forwarded to `SessionController.handleAcpPayload()`.
- **Handler:** `SessionController.handleEnvelope()` → `handleAcpPayload()` in `session/controller.ts:271-283`

### 2. `bridge_status`

| Field | Description |
|-------|-------------|
| `status` | `BridgeStatus` — one of `"starting" \| "connected" \| "reconnecting" \| "disconnected" \| "error"` |

- **What triggers it:** The bridge process changes its connection lifecycle state.
- **State changes:** Updates `SessionController.state.bridgeStatus` and triggers `emitStatusChange()`.
- **Handler:** `SessionController.handleEnvelope()` in `session/controller.ts:274-278`

### 3. `stderr`

| Field | Description |
|-------|-------------|
| `line` | `string` — a single stderr line from the agent process |

- **What triggers it:** The agent process writes to stderr.
- **State changes:** None at the SessionController level (logged/emitted as traffic only).
- **Handler:** `SessionController.handleEnvelope()` — passes through as traffic in `session/controller.ts:272`

### 4. `process_exit`

| Field | Description |
|-------|-------------|
| `code` | `number \| null` — exit code, if available |
| `signal` | `string \| null` — signal that terminated the process |

- **What triggers it:** The agent process terminates.
- **State changes:** None directly. Typically followed by a `bridge_status` change to `"disconnected"`.
- **Handler:** `SessionController.handleEnvelope()` — passes through as traffic in `session/controller.ts:272`

### 5. `replay_metadata`

| Field | Description |
|-------|-------------|
| `captured_at_ms` | `number` — original capture timestamp in ms |
| `total_envelopes` | `number` — total envelopes in the replay file |
| `description` | `string \| null` — optional description of the captured session |

- **What triggers it:** The first envelope in a replay session, providing context about the recording.
- **State changes:** None. Informational only.
- **Handler:** `ReplayController.handleEnvelope()` — informational, no action in `session/replay-controller.ts:502-505`

### 6. `start_agent`

| Field | Description |
|-------|-------------|
| `command` | `string` — command to execute |
| `args` | `string[]` — command arguments |
| `cwd` | `string \| null` — working directory |
| `env` | `[string, string][]` — environment variables |

- **What triggers it:** Sent **from the browser** to the bridge to launch a live agent process. This is the only client-to-bridge envelope type.
- **State changes:** Initiates the agent process on the bridge side.
- **Handler:** Created by `SessionController.startAgent()` in `session/controller.ts:214-228`

### BridgeEnvelope Parsing

**File:** `packages/acp-chat-core/src/bridge/parser.ts`

All incoming WebSocket messages are parsed via `parseEnvelopeSafe()`:

```typescript
function parseEnvelopeSafe(json: string): BridgeEnvelope | BridgeVersionError
```

- Valid envelopes pass through after version validation (currently only version `1` is supported).
- Unsupported versions return a `BridgeVersionError` which is emitted as a transport error.

---

## Layer 2 — SessionController Events

**File:** `packages/acp-chat-core/src/session/controller.ts`

The `SessionController` consumes `BridgeEnvelope` objects from `TransportClient` and emits **6 semantic events** to its subscribers. Both `SessionController` and `ReplayController` emit the same event set with identical signatures.

### TransportClient Events (Internal)

Before listing SessionController events, note that `TransportClient` itself has 3 internal event types:

**File:** `packages/acp-chat-core/src/transport/client.ts`

```typescript
interface TransportEvents {
  statusChange: (status: ConnectionStatus) => void;
  envelope: (envelope: BridgeEnvelope) => void;
  error: (error: Error) => void;
}
```

These are consumed only by `SessionController` (or `ReplayController`) and are not exposed to the UI layer.

### SessionController Events

#### 1. `statusChange`

```typescript
type StatusHandler = (state: SessionControllerState) => void;

interface SessionControllerState {
  connectionStatus: ConnectionStatus;
  bridgeStatus: string;
  sessionId: string | null;
  initialized: boolean;
  capabilities: unknown | null;
}
```

- **What triggers it:**
  - Transport connection status changes (WebSocket opens/closes/reconnects)
  - `bridge_status` envelope received
  - `initialize()` completes
  - `createSession()` or `loadSession()` completes (updates `sessionId`)
- **State changes:** Listeners receive the full `SessionControllerState` snapshot.
- **Handler location:** `AcpStore` constructor — `session/controller.ts:118-120`, consumed in `store/acp-store.ts:102-105`

#### 2. `sessionUpdate`

```typescript
type SessionUpdateHandler = (params: unknown) => void;

// The actual shape when received:
interface SessionUpdateParams {
  sessionId?: string;
  update?: {
    type?: string;
    sessionUpdate?: string;
    [key: string]: unknown;
  };
}
```

- **What triggers it:**
  - An `acp_payload` with `method: "session/update"` is received
  - A JSON-RPC response contains `result.messages` or `result.thoughts` arrays
  - Batched `session/update` notifications are unbatched into individual updates
- **State changes:** Each update is passed to `applySessionUpdate()` which modifies `NormalizedState`.
- **Handler location:** `AcpStore` constructor — `session/controller.ts:122-124`, consumed in `store/acp-store.ts:107-112`

#### 3. `traffic`

```typescript
type TrafficHandler = (direction: "in" | "out", data: unknown) => void;
```

- **What triggers it:**
  - Every incoming `BridgeEnvelope` (`direction: "in"`)
  - Every outgoing JSON-RPC request/notification/response (`direction: "out"`)
  - Every outgoing `BridgeEnvelope` (e.g., `start_agent`)
- **State changes:** None. Used for debugging, logging, and session capture.
- **Handler location:** `DefaultSessionCaptureInterceptor` — `session/controller.ts:126-128`, captured in `session/capture-interceptor.ts:171-174`

#### 4. `error`

```typescript
type ErrorHandler = (error: Error) => void;
```

- **What triggers it:**
  - WebSocket errors
  - Envelope parsing failures (`BridgeVersionError`)
  - JSON-RPC error responses
  - Message parse failures
- **State changes:** None in the store (triggers a notification flush for UI update).
- **Handler location:** `AcpStore` constructor — `session/controller.ts:130-132`, consumed in `store/acp-store.ts:114-116`

#### 5. `sessionClearing`

```typescript
type SessionClearingHandler = () => void;
```

- **What triggers it:** `loadSession()` is called — before the load request is sent, the controller emits this event to allow consumers to reset their state.
- **State changes:** `AcpStore` resets the entire `NormalizedState` to empty.
- **Handler location:** `AcpStore` constructor — `session/controller.ts:134-136`, consumed in `store/acp-store.ts:118-123`

#### 6. `permissionRequest`

```typescript
interface PermissionOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "deny" | "deny_always";
}

interface PermissionRequestParams {
  sessionId: string;
  toolCall: { toolCallId: string };
  options: PermissionOption[];
}

type PermissionRequestHandler = (
  params: PermissionRequestParams & { requestId: number }
) => void;
```

- **What triggers it:** An `acp_payload` with `method: "session/request_permission"` is received.
- **State changes:** Creates a `NormalizedPermissionRequest` in the state (via the `sessionUpdate` path that follows).
- **Handler location:** `session/controller.ts:138-140`, typically consumed by UI components to display permission dialogs.

---

## Layer 3 — ACP Session Update Types

**File:** `packages/acp-chat-core/src/normalization/store.ts`

When `AcpStore` receives a `sessionUpdate` event, it calls `applySessionUpdate()` which dispatches based on the update type. The type is determined by the `sessionUpdate` or `type` field:

```typescript
function getUpdateType(update: AcpUpdate): string | undefined {
  return update.sessionUpdate ?? update.type;
}
```

There are **6 update types** that mutate `NormalizedState`:

### 1. `agent_message_chunk`

**Payload structure:**

```typescript
interface AgentMessageChunk {
  type?: string;
  sessionUpdate?: string;       // "agent_message_chunk"
  turnId?: string;              // Groups chunks into a single message
  role?: string;                // "agent"
  content?: Array<{ type: string; text: string }> | { type: string; text: string };
  status?: string;              // "in_progress" | "done" | "cancelled" | "error"
  timestamp?: number;
}
```

- **What triggers it:** The ACP agent streams a response token-by-token (or in chunks).
- **State changes:**
  - If `turnId` matches an existing message, appends content to that message.
  - Otherwise, creates a new `NormalizedMessage` with `role: "agent"`.
  - Updates message status via `mapChunkStatus()`.
  - Adds to `timelineOrder` if new.
  - Records `turnId → messageId` mapping.
- **Handler location:** `applyAgentMessageChunk()` in `normalization/store.ts:248-297`

### 2. `agent_thought_chunk`

**Payload structure:**

```typescript
// Reuses AgentMessageChunk interface
interface AgentMessageChunk {
  type?: string;
  sessionUpdate?: string;       // "agent_thought_chunk"
  turnId?: string;              // Groups chunks into a single thought
  content?: Array<{ type: string; text: string }> | { type: string; text: string };
  status?: string;
  timestamp?: number;
}
```

- **What triggers it:** The ACP agent streams a thinking/reasoning block.
- **State changes:**
  - If `turnId` matches an existing thought (by searching `state.thoughts`), appends content.
  - Otherwise, creates a new `NormalizedThought`.
  - Adds to `timelineOrder` if new.
- **Handler location:** `applyAgentThoughtChunk()` in `normalization/store.ts:349-378`

### 3. `user_message` / `user_message_chunk`

**Payload structure:**

```typescript
interface UserMessage {
  type?: string;
  sessionUpdate?: string;       // "user_message" or "user_message_chunk"
  turnId?: string;
  role?: string;                // "user"
  content?: Array<{ type: string; text: string }> | { type: string; text: string };
  timestamp?: number;
}
```

- **What triggers it:** The server echoes back the user's submitted message.
- **State changes:**
  - If `turnId` matches an existing message, returns the existing message (no duplicate).
  - Otherwise, creates a new `NormalizedMessage` with `role: "user"` and `status: "complete"`.
  - Adds to `timelineOrder` if new.
  - Records `turnId → messageId` mapping.
- **Handler location:** `applyUserMessage()` in `normalization/store.ts:314-347`
- **Note:** Both `"user_message"` and `"user_message_chunk"` are handled identically via `case "user_message_chunk": case "user_message":`.

### 4. `tool_call`

**Payload structure:**

```typescript
interface ToolCallUpdate {
  type?: string;
  sessionUpdate?: string;       // "tool_call"
  toolCallId?: string;
  kind?: string;                // "read" | "search" | "edit" | "write" | "execute" | "glob" | "grep"
  title?: string;
  status?: string;              // "pending" | "completed"
  rawInput?: {
    filePath?: string;
    command?: string;
    pattern?: string;
    [key: string]: unknown;
  };
  rawOutput?: {
    metadata?: {
      loaded?: string[];
      preview?: string;
      truncated?: boolean;
      exit?: number;
    };
    output?: string;
  };
  timestamp?: number;
}
```

- **What triggers it:** The agent initiates a tool call (file read, command execution, etc.).
- **State changes:**
  - If `toolCallId` matches an existing tool call, updates its fields.
  - Otherwise, creates a new `NormalizedToolCall`.
  - Maps `kind` via `mapToolCallKind()` and `status` via `mapToolCallStatus()`.
  - Adds to `timelineOrder` if new.
- **Handler location:** `applyToolCall()` in `normalization/store.ts:524-599`

### 5. `tool_call_update`

**Payload structure:**

```typescript
// Same as ToolCallUpdate interface above, with sessionUpdate: "tool_call_update"
```

- **What triggers it:** The agent provides updated information for an existing tool call (e.g., the result/output of a completed tool call).
- **State changes:** Delegates entirely to `applyToolCall()` — the same handler handles both `tool_call` and `tool_call_update`.
- **Handler location:** `applyToolCallUpdate()` → `applyToolCall()` in `normalization/store.ts:601-603`

### 6. `permission_request`

**Payload structure:**

```typescript
interface PermissionRequestUpdate {
  type?: string;
  sessionUpdate?: string;       // "permission_request"
  requestId?: number;
  sessionId?: string;
  toolCallId?: string;
  options?: Array<{
    optionId: string;
    name: string;
    kind: string;               // "allow_once" | "allow_always" | "deny" | "deny_always"
  }>;
  status?: string;              // "pending" | "approved" | "denied" | "cancelled"
  selectedOptionId?: string;
  timestamp?: number;
}
```

- **What triggers it:** The agent requests user permission before executing a tool call.
- **State changes:**
  - If `requestId` matches an existing permission request, updates its status/options.
  - Otherwise, creates a new `NormalizedPermissionRequest`.
  - Adds to `timelineOrder` if new.
- **Handler location:** `applyPermissionRequest()` in `normalization/store.ts:605-639`

---

## JSON-RPC Methods

The ACP protocol uses JSON-RPC 2.0 for all request/response communication. Messages are sent as `acp_payload` envelopes.

### Outgoing Requests (Browser → Agent)

These are sent by `SessionController.sendRequest()` and `SessionController.sendNotification()`:

#### `initialize`

```typescript
// Request
{
  jsonrpc: "2.0",
  id: number,
  method: "initialize",
  params: {
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo?: { name: string; version: string }
  }
}

// Response
{
  jsonrpc: "2.0",
  id: number,
  result: { /* server capabilities */ }
}
```

- **Purpose:** Handshake with the ACP agent. Must be called before any other method.
- **Handler:** `SessionController.initialize()` in `session/controller.ts:155-166`

#### `session/new`

```typescript
// Request
{
  jsonrpc: "2.0",
  id: number,
  method: "session/new",
  params: {
    cwd: string,
    mcpServers: unknown[]
  }
}

// Response
{
  jsonrpc: "2.0",
  id: number,
  result: { sessionId: string }
}
```

- **Purpose:** Create a new agent session.
- **Handler:** `SessionController.createSession()` in `session/controller.ts:168-174`

#### `session/list`

```typescript
// Request
{
  jsonrpc: "2.0",
  id: number,
  method: "session/list",
  params: {
    cursor?: string,
    cwd?: string
  }
}

// Response
{
  jsonrpc: "2.0",
  id: number,
  result: {
    sessions: Array<{
      sessionId: string;
      cwd: string;
      title?: string;
      updatedAt?: string;
      _meta?: unknown;
    }>;
    nextCursor?: string;
  }
}
```

- **Purpose:** List existing sessions (paginated).
- **Handler:** `SessionController.listSessions()` in `session/controller.ts:176-182`

#### `session/load`

```typescript
// Request
{
  jsonrpc: "2.0",
  id: number,
  method: "session/load",
  params: {
    sessionId: string,
    cwd: string,
    mcpServers: unknown[]
  }
}

// Response includes messages and thoughts arrays which are unbatched
// into individual sessionUpdate events
{
  jsonrpc: "2.0",
  id: number,
  result: {
    sessionId: string,
    messages: Array<AgentMessageChunk | UserMessage>,
    thoughts: Array<AgentMessageChunk>
  }
}
```

- **Purpose:** Load a pre-existing session. The response contains all historical messages and thoughts, which the controller emits as individual `sessionUpdate` events.
- **Side effect:** Emits `sessionClearing` **before** sending the request to allow state reset.
- **Handler:** `SessionController.loadSession()` in `session/controller.ts:184-195`

#### `session/prompt`

```typescript
// Request
{
  jsonrpc: "2.0",
  id: number,
  method: "session/prompt",
  params: {
    sessionId: string,
    prompt: [{ type: "text", text: string }]
  }
}
```

- **Purpose:** Send a user prompt to the agent. The agent responds with streaming `session/update` notifications.
- **Handler:** `SessionController.sendPrompt()` in `session/controller.ts:197-199`

#### `session/cancel`

```typescript
// Notification (no id, no response expected)
{
  jsonrpc: "2.0",
  method: "session/cancel",
  params: { sessionId: string }
}
```

- **Purpose:** Cancel an in-progress prompt.
- **Handler:** `SessionController.cancelPrompt()` in `session/controller.ts:202-204`

### Incoming Notifications (Agent → Browser)

#### `session/update`

```typescript
// Single update
{
  jsonrpc: "2.0",
  method: "session/update",
  params: {
    sessionId: string,
    update: {
      type: string,       // or sessionUpdate: string
      // ... type-specific fields
    }
  }
}

// Batched update
{
  jsonrpc: "2.0",
  method: "session/update",
  params: {
    batched: true,
    updates: [
      { sessionId: string, params: { update: { ... } } },
      { sessionId: string, update: { ... } },
      // ...
    ]
  }
}
```

- **Purpose:** Streaming updates from the agent during prompt processing. Can be individual or batched.
- **Handler:** `SessionController.handleAcpPayload()` in `session/controller.ts:345-366`

#### `session/request_permission`

```typescript
{
  jsonrpc: "2.0",
  id: number,           // The request ID to respond to
  method: "session/request_permission",
  params: {
    sessionId: string,
    toolCall: { toolCallId: string },
    options: Array<PermissionOption>
  }
}
```

- **Purpose:** The agent requests user approval before executing a tool call.
- **Response:** Browser responds with `respondToPermission(requestId, optionId)` or `cancelPermission(requestId)`.
- **Handler:** `SessionController.handleAcpPayload()` in `session/controller.ts:367-373`

### Outgoing Responses (Browser → Agent)

#### Permission Response (approve)

```typescript
{
  jsonrpc: "2.0",
  id: number,
  result: {
    outcome: { outcome: "selected", optionId: string }
  }
}
```

#### Permission Response (cancel)

```typescript
{
  jsonrpc: "2.0",
  id: number,
  result: {
    outcome: { outcome: "cancelled" }
  }
}
```

---

## Status Value Mappings

### Message Status

Maps ACP agent message `status` field to internal `MessageStatus`:

**File:** `normalization/store.ts:299-312`

| ACP Status | Internal Status | Description |
|-----------|----------------|-------------|
| `"in_progress"` | `"streaming"` | Agent is actively generating content |
| `"done"` | `"complete"` | Message is finished |
| `"cancelled"` | `"cancelled"` | Message was cancelled by user |
| `"error"` | `"error"` | An error occurred during generation |
| (any other) | `"complete"` | Default fallback |

```typescript
function mapChunkStatus(status: string | undefined): MessageStatus {
  switch (status) {
    case "in_progress": return "streaming";
    case "done":        return "complete";
    case "cancelled":   return "cancelled";
    case "error":       return "error";
    default:            return "complete";
  }
}
```

### Tool Call Status

**File:** `normalization/store.ts:500-508`

| ACP Status | Internal Status | Description |
|-----------|----------------|-------------|
| `"completed"` | `"completed"` | Tool execution finished |
| `"pending"` | `"pending"` | Tool is waiting to execute |
| (any other) | `"pending"` | Default fallback |

### Tool Call Kind

**File:** `normalization/store.ts:485-498`

| Kind | Description |
|------|-------------|
| `"read"` | File read operation |
| `"search"` | Search operation |
| `"edit"` | File edit operation |
| `"write"` | File write operation |
| `"execute"` | Command execution |
| `"glob"` | File glob pattern matching |
| `"grep"` | Content search |
| (any other) | `"unknown"` |

### Permission Request Status

**File:** `normalization/store.ts:510-522`

| ACP Status | Internal Status |
|-----------|----------------|
| `"approved"` | `"approved"` |
| `"denied"` | `"denied"` |
| `"cancelled"` | `"cancelled"` |
| `"pending"` | `"pending"` |
| (any other) | `"pending"` |

### Connection Status

**File:** `transport/client.ts:4`

```typescript
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
```

| Status | Description |
|--------|-------------|
| `"disconnected"` | No active WebSocket connection |
| `"connecting"` | WebSocket is being established |
| `"connected"` | WebSocket is open and ready |
| `"reconnecting"` | Connection lost, attempting reconnect |
| `"error"` | An error occurred |

### Bridge Status

**File:** `generated/BridgeStatus.ts`

```typescript
type BridgeStatus = "starting" | "connected" | "reconnecting" | "disconnected" | "error";
```

| Status | Description |
|--------|-------------|
| `"starting"` | Bridge process is launching |
| `"connected"` | Bridge is connected to the agent |
| `"reconnecting"` | Bridge lost connection, reconnecting |
| `"disconnected"` | Bridge is shut down |
| `"error"` | Bridge encountered an error |

---

## Event Processing Pipeline

The full processing pipeline from raw WebSocket frame to React state update:

### Step 1: WebSocket → TransportClient

**File:** `transport/client.ts:213-260`

```
WebSocket.onmessage(event)
  → JSON.parse(event.data)
  → Is it an init response? (has type="init" and initId)
    → Resolve pending init promise
  → Is it an error response? (has error field)
    → emitError()
  → parseEnvelopeSafe(json)
    → BridgeVersionError? → emitError()
    → Valid BridgeEnvelope → emitEnvelope()
```

### Step 2: TransportClient → SessionController

**File:** `session/controller.ts:266-283`

```
handleTransportStatus(status)
  → Update state.connectionStatus
  → emitStatusChange()

handleEnvelope(envelope)
  → emitTraffic("in", envelope)
  → envelope.type === "bridge_status"?
    → Update state.bridgeStatus
    → emitStatusChange()
  → envelope.type === "acp_payload"?
    → handleAcpPayload(envelope.payload)
```

### Step 3: ACP Payload Dispatch

**File:** `session/controller.ts:285-374`

```
handleAcpPayload(payload)
  → Has numeric "id"?
    → Resolve pending JSON-RPC request
    → If result has messages array:
      → For each message: emitSessionUpdate({sessionId, update: msg})
    → If result has thoughts array:
      → For each thought: emitSessionUpdate({sessionId, update: thought})

  → Has method "session/update"?
    → batched === true && Array.isArray(updates)?
      → For each item: emitSessionUpdate({sessionId, update})
    → Otherwise: emitSessionUpdate(params)

  → Has method "session/request_permission"?
    → emitPermissionRequest(params, requestId)
```

### Step 4: SessionUpdate → NormalizedState

**File:** `normalization/store.ts:199-239`

```
applySessionUpdate(state, params)
  → updateType = update.sessionUpdate ?? update.type
  → switch(updateType):
    "agent_message_chunk"  → applyAgentMessageChunk()
    "agent_thought_chunk"  → applyAgentThoughtChunk()
    "user_message"         → applyUserMessage()
    "user_message_chunk"   → applyUserMessage() (same handler)
    "tool_call"            → applyToolCall()
    "tool_call_update"     → applyToolCall() (same handler)
    "permission_request"   → applyPermissionRequest()
```

### Step 5: AcpStore Notification

**File:** `store/acp-store.ts:100-126`

```
AcpStore subscribes to SessionController:
  on("statusChange")    → update sessionState + scheduleNotification()
  on("sessionUpdate")   → applySessionUpdate() + version++ + scheduleNotification()
  on("error")           → scheduleNotification()
  on("sessionClearing") → reset state + version++
```

---

## Event Batching and Notification Cadence

**File:** `packages/acp-chat-react/src/store/acp-store.ts`

The `AcpStore` implements a two-level batching strategy:

### Level 1: Bridge Batching

The ACP agent can send batched `session/update` notifications containing multiple updates in a single JSON-RPC message. The `SessionController` unbatch these into individual `sessionUpdate` events:

```
Bridge sends:
  { method: "session/update", params: { batched: true, updates: [...] } }

SessionController unbatches to:
  emitSessionUpdate({ sessionId, update: updates[0] })
  emitSessionUpdate({ sessionId, update: updates[1] })
  emitSessionUpdate({ sessionId, update: updates[2] })
  ...
```

### Level 2: React Notification Batching

The `AcpStore` batches **React subscriber notifications** using a `setTimeout` with a configurable cadence (default: **16ms**, roughly one animation frame):

```typescript
interface AcpStoreConfig {
  notificationCadenceMs?: number;  // default: 16
  enableBatching?: boolean;        // default: true
}
```

**Critical design principle:**

> ACP updates are processed **IMMEDIATELY** — state is mutated the instant the event arrives. Only the **React re-render notification** is delayed. No events are dropped or throttled.

```
Timeline:

t=0ms   sessionUpdate arrives → applySessionUpdate() runs immediately
        state is updated NOW
        scheduleNotification() → sets pendingNotification = true
                                  starts setTimeout(16ms)

t=5ms   sessionUpdate arrives → applySessionUpdate() runs immediately
        state is updated NOW
        scheduleNotification() → pendingNotification already true, no-op

t=12ms  sessionUpdate arrives → applySessionUpdate() runs immediately
        state is updated NOW
        scheduleNotification() → pendingNotification already true, no-op

t=16ms  setTimeout fires → flushNotifications()
        All React subscribers are notified ONCE
        React re-renders with all 3 updates applied
```

This means rapid streaming updates (e.g., token-by-token `agent_message_chunk` events) accumulate in state but only trigger a single React render cycle per 16ms window.

---

## Timeline Ordering

**File:** `normalization/store.ts`

The `NormalizedState` maintains a `timelineOrder` array that records the order in which items were added to the state:

```typescript
interface NormalizedState {
  // ...
  timelineOrder: Array<{
    type: "message" | "thought" | "tool_call" | "permission_request";
    id: string | number;
  }>;
  // ...
}
```

### How Ordering Works

- Each time a new item is created (new message, thought, tool call, or permission request), it is appended to `timelineOrder`.
- **Existing items are never reordered.** When an `agent_message_chunk` updates an existing message (same `turnId`), it modifies the message in place — no new timeline entry is created.
- The `getTimeline()` function resolves timeline entries to their full data objects:

```typescript
function getTimeline(state: NormalizedState): TimelineItem[] {
  return state.timelineOrder
    .map(item => {
      // Look up the full data object from the appropriate Map
      // Returns null if the item was somehow removed
    })
    .filter(item => item !== null);
}
```

### turnId Mapping

The `turnIdToMessageId` map connects ACP `turnId` values to internal message IDs:

```typescript
turnIdToMessageId: Map<string, string>;
```

This allows chunks with the same `turnId` to be merged into a single message. When a new `agent_message_chunk` arrives with a `turnId` that already exists in the map, the content is appended to the existing message rather than creating a new one.

---

## Thought Grouping Logic

**File:** `packages/acp-chat-core/src/helpers/thought-stack-logic.ts`

After the timeline is built, the UI layer groups consecutive thoughts and tool calls into collapsible "thought groups" for display.

### Grouping Algorithm

The `groupThoughtItems()` function scans the timeline and groups adjacent `thought` and `tool_call` items:

```
Timeline: [msg, thought, thought, tool_call, msg, thought, tool_call, tool_call, msg]

Groups:
  Group 0: [thought, thought, tool_call]          ← between messages
  Group 1: [thought, tool_call, tool_call]         ← between messages
```

```typescript
interface ThoughtGroup {
  id: string;                  // "thought-group-{index}"
  items: ThoughtItem[];        // Thoughts and tool calls in this group
  startTime: number;           // Earliest createdAt in group
  endTime: number;             // Latest createdAt in group
}
```

**Rules:**
1. Only `thought` and `tool_call` items are grouped together.
2. A `message` item **breaks** the current group.
3. Groups are created with sequential IDs (`thought-group-0`, `thought-group-1`, ...).
4. Each group tracks the time span from its first to last item.

### Grouped Timeline

The `createGroupedTimeline()` function produces a mixed array for rendering:

```typescript
type GroupedTimelineItem =
  | { type: "message"; id: string; data: NormalizedMessage }
  | { type: "thought_group"; id: string; data: ThoughtGroup };
```

This allows the UI to render messages normally and thought groups as collapsible sections.

### Active State Detection

The `isThoughtGroupActive()` function determines whether the most recent thought group is still "active" (should show as loading/in-progress):

```typescript
function isThoughtGroupActive(groups, isAgentTyping): boolean {
  if (groups.length === 0) return false;
  const lastGroup = groups[groups.length - 1];
  const lastItem = lastGroup.items[lastGroup.items.length - 1];
  const lastItemTime = lastItem.data.createdAt ?? 0;
  const isRecent = Date.now() - lastItemTime < 5000;  // 5-second threshold
  return isAgentTyping || isRecent;
}
```

A thought group is considered active if:
- The agent is still typing (`isAgentTyping` is true), OR
- The last item in the group was created within the last 5 seconds

### Expand/Collapse Logic

The `shouldThoughtGroupBeOpen()` function determines whether a thought group should render expanded or collapsed:

```typescript
function shouldThoughtGroupBeOpen(
  isActive,              // Is the group currently active?
  wasActive,             // Was it active on the previous check?
  hasBeenActive,         // Has it ever been active?
  defaultOpen,           // Default state when never active
  defaultOpenWhenActive, // State while active
  defaultOpenWhenIdle    // State after transitioning from active to idle
): boolean
```

| Condition | Result |
|-----------|--------|
| Currently active | `defaultOpenWhenActive` |
| Was active, now idle (transition) | `defaultOpenWhenIdle` |
| Never been active | `defaultOpen` |
