# Types Reference

Complete catalog of every type, interface, and type alias in `@acp/chat-core`. Organized by domain so you can find what you need without hunting through source files.

## Quick Reference

| Category | Exported | Internal | Total |
|----------|----------|----------|-------|
| Transport / Bridge | 8 | 3 | 11 |
| Session / Controller | 4 | 0 | 4 |
| Replay | 8 | 0 | 8 |
| Capture | 3 | 1 | 4 |
| State / Normalization | 17 | 5 | 22 |
| Helper | 6 | 0 | 6 |
| Presets | 1 | 0 | 1 |
| **Total** | **47** | **9** | **56** |

**Exported** means the type is re-exported from `packages/acp-chat-core/src/index.ts` and available via `import type { ... } from "@acp/chat-core"`. **Internal** types are defined in source files but not exposed through the public API. They're documented here because understanding them helps you work with the exported types.

Types marked with **GENERATED** come from `src/generated/` and are produced by [ts-rs](https://github.com/Aleph-Alpha/ts-rs) from Rust definitions. Don't edit them by hand.

---

## Transport / Bridge

Types that handle the WebSocket connection between the browser and the Rust bridge process.

---

### ConnectionStatus

**File:** `src/transport/client.ts`
**Exported:** Yes (via `src/index.ts`)

```typescript
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
```

Tracks the lifecycle of the WebSocket connection. The `TransportClient` emits this through the `statusChange` event whenever the state transitions. UI components bind to this to show connection indicators.

**Relationships:** Used by `TransportConfig`, `TransportEvents`, `SessionControllerState`, `ReplayControllerState`.

---

### TransportConfig

**File:** `src/transport/client.ts`
**Exported:** Yes

```typescript
interface TransportConfig {
  url: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}
```

Configuration passed to `new TransportClient(config)`. Controls where to connect and how aggressively to retry on disconnection.

- `url` is the WebSocket endpoint (e.g. `ws://127.0.0.1:8765`).
- `reconnect` enables automatic reconnection with exponential backoff.
- `maxReconnectAttempts` defaults to `10`.
- `baseReconnectDelayMs` defaults to `1000` (1 second).
- `maxReconnectDelayMs` caps the backoff at `30000` (30 seconds).

**Relationships:** Consumed by `TransportClient` constructor.

---

### TransportEvents

**File:** `src/transport/client.ts`
**Exported:** Yes

```typescript
interface TransportEvents {
  statusChange: (status: ConnectionStatus) => void;
  envelope: (envelope: BridgeEnvelope) => void;
  error: (error: Error) => void;
}
```

Maps event names to their handler signatures. Used internally by `TransportClient.on()` for type-safe event subscription. You subscribe to these events to receive parsed bridge envelopes and connection state changes.

**Relationships:** References `ConnectionStatus`, `BridgeEnvelope`.

---

### InitSuccess

**File:** `src/transport/client.ts`
**Exported:** Yes

```typescript
interface InitSuccess {
  status: "success";
  mode: "replay" | "live";
}
```

Returned by `TransportClient.initReplay()` and `TransportClient.initLive()` on successful initialization. The `mode` field tells you whether the bridge is running in replay or live mode.

**Relationships:** Discriminated union counterpart of `InitError`.

---

### InitError *(internal)*

**File:** `src/transport/client.ts`
**Exported:** No

```typescript
interface InitError {
  status: "error";
  message: string;
}
```

Returned when an init call fails. The `TransportClient` resolves its init promise with this shape, then rejects the outer promise with the `message`. Not re-exported because errors surface as rejected promises.

**Relationships:** Discriminated union counterpart of `InitSuccess`.

---

### DisconnectSuccess *(internal)*

**File:** `src/transport/client.ts`
**Exported:** No

```typescript
interface DisconnectSuccess {
  status: "success";
}
```

Return type of `TransportClient.disconnect()`. Not re-exported because the result is trivially always `{ status: "success" }`.

---

### BridgeEnvelope **(GENERATED)**

**File:** `src/generated/BridgeEnvelope.ts`
**Exported:** Yes

```typescript
type BridgeEnvelope = {
  version: number;
  seq: number;
  timestamp_ms: number;
} & (
  | {
      type: "acp_payload";
      payload: JsonValue;
    }
  | {
      type: "bridge_status";
      status: BridgeStatus;
    }
  | {
      type: "stderr";
      line: string;
    }
  | {
      type: "process_exit";
      code: number | null;
      signal: string | null;
    }
  | {
      type: "replay_metadata";
      captured_at_ms: number;
      total_envelopes: number;
      description: string | null;
    }
  | {
      type: "start_agent";
      command: string;
      args: Array<string>;
      cwd: string | null;
      env: Array<[string, string]>;
    }
);
```

The versioned wire format for all bridge-to-browser messages. Every message coming over the WebSocket is one of these. The discriminated union on `type` tells you what kind of data you're dealing with:

- `acp_payload` carries raw ACP JSON-RPC traffic from the agent.
- `bridge_status` signals bridge lifecycle changes.
- `stderr` forwards agent process stderr.
- `process_exit` fires when the agent process terminates.
- `replay_metadata` is sent once at the start of a replay session.
- `start_agent` is sent from the browser to the bridge to launch an agent.

The common fields (`version`, `seq`, `timestamp_ms`) enable ordering and version validation.

**Relationships:** Used everywhere. `TransportClient` parses raw JSON into this type. `SessionController` and `ReplayController` consume it. `CapturedEvent` and `ReplayEvent` wrap it. References `JsonValue` and `BridgeStatus`.

---

### BridgeMessage **(GENERATED)**

**File:** `src/generated/BridgeMessage.ts`
**Exported:** Yes

```typescript
type BridgeMessage =
  | { type: "acp_payload"; payload: JsonValue }
  | { type: "bridge_status"; status: BridgeStatus }
  | { type: "stderr"; line: string }
  | { type: "process_exit"; code: number | null; signal: string | null }
  | { type: "replay_metadata"; captured_at_ms: number; total_envelopes: number; description: string | null }
  | { type: "start_agent"; command: string; args: Array<string>; cwd: string | null; env: Array<[string, string]> };
```

The message-variant portion of `BridgeEnvelope` without the envelope wrapper fields. Useful when you only care about the payload discriminant and not the versioning metadata.

**Relationships:** The inner discriminated union from `BridgeEnvelope`. References `JsonValue` and `BridgeStatus`.

---

### BridgeStatus **(GENERATED)**

**File:** `src/generated/BridgeStatus.ts`
**Exported:** Yes

```typescript
type BridgeStatus = "starting" | "connected" | "reconnecting" | "disconnected" | "error";
```

The lifecycle states of the Rust bridge process itself. Distinct from `ConnectionStatus` which tracks the WebSocket connection. The bridge can be "connected" to the agent while the WebSocket is temporarily "reconnecting".

**Relationships:** Used in `BridgeEnvelope` (`type: "bridge_status"` variant) and stored in `SessionControllerState.bridgeStatus`.

---

### UnsupportedVersionError **(GENERATED)**

**File:** `src/generated/UnsupportedVersionError.ts`
**Exported:** Yes

```typescript
type UnsupportedVersionError = {
  received: number;
  supported: Array<number>;
};
```

Data shape returned when a `BridgeEnvelope` arrives with an unrecognized `version` number. The `received` field is what came in, and `supported` lists the versions this client can handle.

The `BridgeVersionError` class wraps this plain object into a proper `Error` instance.

**Relationships:** Consumed by `BridgeVersionError` constructor in `src/bridge/parser.ts`.

---

### JsonValue *(internal, GENERATED)*

**File:** `src/generated/serde_json/JsonValue.ts`
**Exported:** No (not re-exported from `src/index.ts`)

```typescript
type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]?: JsonValue } | null;
```

A recursive type representing any valid JSON value. Used as the type for the opaque `payload` field in `BridgeEnvelope` and `BridgeMessage` because the bridge doesn't interpret ACP JSON-RPC content.

**Relationships:** Referenced by `BridgeEnvelope` and `BridgeMessage`.

---

## Session / Controller

Types for managing an ACP session through the `SessionController` class.

---

### SessionControllerState

**File:** `src/session/controller.ts`
**Exported:** Yes

```typescript
interface SessionControllerState {
  connectionStatus: ConnectionStatus;
  bridgeStatus: string;
  sessionId: string | null;
  initialized: boolean;
  capabilities: unknown | null;
}
```

Snapshot of the controller's current state. Emitted through the `statusChange` event whenever anything changes. UI components read this to determine what to render.

- `connectionStatus` mirrors the WebSocket transport state.
- `bridgeStatus` comes from `BridgeEnvelope` messages with `type: "bridge_status"`.
- `sessionId` is set after `createSession()` or `loadSession()` succeeds.
- `initialized` becomes `true` after `initialize()` completes.
- `capabilities` stores the result from the `initialize` JSON-RPC call.

**Relationships:** Extended by `ReplayControllerState`. References `ConnectionStatus`.

---

### StartAgentConfig

**File:** `src/session/controller.ts`
**Exported:** Yes

```typescript
interface StartAgentConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Array<[string, string]>;
}
```

Configuration for launching an ACP agent process. Passed to `SessionController.startAgent()`. The bridge receives this as a `start_agent` envelope and spawns the specified command.

**Relationships:** Used by `SessionController.startAgent()`. Maps to the `start_agent` variant of `BridgeEnvelope`.

---

### PermissionOption

**File:** `src/session/controller.ts`
**Exported:** Yes

```typescript
interface PermissionOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "deny" | "deny_always";
}
```

A single choice presented to the user during a permission request. The `kind` determines the semantic meaning: one-time approvals, persistent allowances, one-time denials, or persistent blocks.

**Relationships:** Used in `PermissionRequestParams.options`.

---

### PermissionRequestParams

**File:** `src/session/controller.ts`
**Exported:** Yes

```typescript
interface PermissionRequestParams {
  sessionId: string;
  toolCall: {
    toolCallId: string;
  };
  options: PermissionOption[];
}
```

Payload of a `session/request_permission` JSON-RPC notification from the bridge. Contains the session context, the tool call that needs permission, and the options the user can choose from.

**Relationships:** References `PermissionOption`. Emitted through the `permissionRequest` event on both `SessionController` and `ReplayController`.

---

## Replay

Types for replaying pre-recorded ACP sessions. Split between the replay controller types (how you drive a replay) and the replay data types (what a recorded session looks like on disk).

---

### ReplayMode

**File:** `src/session/replay-controller.ts`
**Exported:** Yes

```typescript
interface ReplayMode {
  id: string;
  name: string;
  description?: string;
}
```

A fake "mode" exposed by `ReplayController` so the settings UI can display meaningful options even though there's no live agent. In replay mode these are typically `{ id: "replay", name: "Replay", description: "Replay a recorded session" }`.

**Relationships:** Used in `ReplayControllerOptions.modes` and stored in `ReplayControllerState.modes`.

---

### ReplayModel

**File:** `src/session/replay-controller.ts`
**Exported:** Yes

```typescript
interface ReplayModel {
  id: string;
  name: string;
  description?: string;
  provider?: string;
}
```

A fake "model" exposed by `ReplayController`. Similar to `ReplayMode`, this exists so the settings panel can render model information. The default is `{ id: "replay-model", name: "Replay Model", provider: "replay" }`.

**Relationships:** Used in `ReplayControllerOptions.models` and stored in `ReplayControllerState.models`.

---

### ReplayControllerOptions

**File:** `src/session/replay-controller.ts`
**Exported:** Yes

```typescript
interface ReplayControllerOptions {
  bridgeUrl: string;
  modes?: ReplayMode[];
  models?: ReplayModel[];
  requestTimeoutMs?: number;
}
```

Constructor options for `ReplayController`. The `bridgeUrl` points to the Rust bridge's replay-v2 WebSocket endpoint. `modes` and `models` let you customize what the controller reports to the UI. `requestTimeoutMs` defaults to 30000.

**Relationships:** References `ReplayMode`, `ReplayModel`. Consumed by `new ReplayController(options)`.

---

### ReplayControllerState

**File:** `src/session/replay-controller.ts`
**Exported:** Yes

```typescript
interface ReplayControllerState extends SessionControllerState {
  modes: ReplayMode[];
  models: ReplayModel[];
}
```

Extends the base `SessionControllerState` with the fake modes and models that the replay controller exposes. This means any code written to handle `SessionControllerState` will also work with `ReplayControllerState`.

**Relationships:** Extends `SessionControllerState`. References `ReplayMode`, `ReplayModel`.

---

### ReplaySessionMetadata

**File:** `src/replay/types.ts`
**Exported:** Yes

```typescript
interface ReplaySessionMetadata {
  demoType: string;
  sessionId: string;
  modes: string[];
  models: string[];
  capturedAt: number;
  tokenCount: number;
  eventCount: number;
  description: string;
}
```

Metadata about a recorded session, stored in a manifest file. Think of it as a card catalog entry: enough information to decide whether to load the full session without reading the event data.

- `demoType` categorizes the replay (e.g., `"feature-demo"`, `"bug-reproduction"`).
- `capturedAt` is a Unix timestamp in milliseconds.
- `tokenCount` and `eventCount` give a sense of session size.

**Relationships:** Used in `ReplayManifest.sessions`.

---

### ReplaySessionData

**File:** `src/replay/types.ts`
**Exported:** Yes

```typescript
interface ReplaySessionData {
  messages: NormalizedMessage[];
  thoughts: NormalizedThought[];
  toolCalls: NormalizedToolCall[];
  sessionId: string;
  cwd: string;
}
```

The pre-existing session state captured at the start of a recording. When you replay a session, this data is loaded first to restore the conversation context before events start streaming.

**Relationships:** References `NormalizedMessage`, `NormalizedThought`, `NormalizedToolCall`. Used in `CapturedSession.preExistingState` and passed to `SessionCaptureInterceptor.startCapture()`.

---

### ReplayEvent

**File:** `src/replay/types.ts`
**Exported:** Yes

```typescript
interface ReplayEvent {
  envelope: BridgeEnvelope;
  tokenCount: number;
}
```

A single event in a replay stream. Wraps a `BridgeEnvelope` with a pre-computed token estimate. The token count is calculated by `estimateTokenCount()` using a simple characters/4 approximation.

**Relationships:** References `BridgeEnvelope`. Similar to `CapturedEvent` but without the `timestamp` and `direction` fields.

---

### ReplayManifest

**File:** `src/replay/types.ts`
**Exported:** Yes

```typescript
interface ReplayManifest {
  demoType: string;
  sessions: ReplaySessionMetadata[];
}
```

An index file that organizes recorded sessions by demo type. Lets the UI present a browseable list of available replays without scanning every session file.

**Relationships:** References `ReplaySessionMetadata`.

---

## Capture

Types for recording live sessions into replay files. The capture system sits between `SessionController` and the event stream, recording everything that passes through.

---

### CapturedSession

**File:** `src/session/capture-interceptor.ts`
**Exported:** Yes

```typescript
interface CapturedSession {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  events: CapturedEvent[];
  preExistingState: ReplaySessionData | null;
  modes: string[];
  models: string[];
}
```

A complete recording of an ACP session. `startTime` and `endTime` are Unix timestamps in milliseconds. `endTime` is `null` while capture is still active. The `modes` and `models` arrays accumulate the distinct modes and models observed during the session.

**Relationships:** Contains `CapturedEvent[]` and optionally `ReplaySessionData`. Returned by `SessionCaptureInterceptor.exportCapturedSession()`.

---

### CapturedEvent

**File:** `src/session/capture-interceptor.ts`
**Exported:** Yes

```typescript
interface CapturedEvent {
  envelope: BridgeEnvelope;
  tokenCount: number;
  timestamp: number;
  direction: "in" | "out";
}
```

A single recorded event. Extends the concept of `ReplayEvent` with a capture timestamp and traffic direction (`"in"` for messages from the bridge, `"out"` for messages sent to it).

**Relationships:** References `BridgeEnvelope`. Used in `CapturedSession.events`.

---

### SessionCaptureInterceptor

**File:** `src/session/capture-interceptor.ts`
**Exported:** Yes

```typescript
interface SessionCaptureInterceptor {
  startCapture(sessionId: string, initialState?: ReplaySessionData): void;
  stopCapture(): void;
  exportCapturedSession(): CapturedSession;
  isCapturing(): boolean;
  getActiveSessionId(): string | null;
}
```

The interface that any capture interceptor must implement. `DefaultSessionCaptureInterceptor` is the provided implementation. You can implement this interface yourself if you need custom capture behavior (e.g., filtering, transformation, or sending captured data to an external service).

Usage:
```typescript
const controller = new SessionController(bridgeUrl);
const interceptor = new DefaultSessionCaptureInterceptor(controller);

interceptor.startCapture(sessionId, preExistingState);
// ... user interacts with the session ...
const captured = interceptor.stopCaptureAndExport();
```

**Relationships:** Implemented by `DefaultSessionCaptureInterceptor`. References `ReplaySessionData`, `CapturedSession`.

---

### CaptureState *(internal)*

**File:** `src/session/capture-interceptor.ts`
**Exported:** No

```typescript
interface CaptureState {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  events: CapturedEvent[];
  preExistingState: ReplaySessionData | null;
  modes: Set<string>;
  models: Set<string>;
}
```

Internal mutable state held by `DefaultSessionCaptureInterceptor` during an active capture. Uses `Set<string>` for modes and models (converted to arrays when exported). Not exposed because consumers should use `CapturedSession` instead.

---

## State / Normalization

Types for the incremental normalization layer. Raw ACP JSON-RPC updates arrive in various shapes. The normalization layer converts them into stable, predictable types that the UI can render.

### Core State

---

### NormalizedState

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface NormalizedState {
  messages: Map<string, NormalizedMessage>;
  thoughts: Map<string, NormalizedThought>;
  toolCalls: Map<string, NormalizedToolCall>;
  permissionRequests: Map<number, NormalizedPermissionRequest>;
  timelineOrder: Array<{ type: TimelineItemType; id: string | number }>;
  turnIdToMessageId: Map<string, string>;
}
```

The central state container. Created by `createNormalizedState()` and updated by `applySessionUpdate()`. Uses `Map` for O(1) lookups by ID. The `timelineOrder` array preserves insertion order so you can render items chronologically. The `turnIdToMessageId` map links ACP turn IDs to the generated message IDs.

Query this state with the accessor functions: `getMessages()`, `getThoughts()`, `getToolCalls()`, `getTimeline()`, `getPermissionRequests()`, etc.

**Relationships:** References all normalized types and `TimelineItemType`.

---

### SessionUpdateParams

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface SessionUpdateParams {
  sessionId?: string;
  update?: {
    type?: string;
    sessionUpdate?: string;
    [key: string]: unknown;
  };
}
```

The input to `applySessionUpdate()`. This is the shape of the data emitted by `SessionController` through its `sessionUpdate` event. The `update` field contains the raw ACP update object, which is discriminated by either `update.type` or `update.sessionUpdate`.

**Relationships:** Input to `applySessionUpdate()`. Produced by `SessionController` and `ReplayController`.

---

### Message Entities

---

### NormalizedMessage

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface NormalizedMessage {
  id: string;
  role: MessageRole;
  status: MessageStatus;
  content: string;
  contentBlocks: ContentBlock[];
  createdAt?: number;
  updatedAt?: number;
  parentMessageId?: string;
  turnId?: string;
}
```

A chat message from either the user or the agent. The `content` field is the plain text representation. The `contentBlocks` field preserves structured content (text, resources, resource links). During streaming, the same `NormalizedMessage` is updated in place as chunks arrive, matched by `turnId`.

`parentMessageId` is reserved for threading support. `turnId` links the message to an ACP turn.

**Relationships:** Used in `NormalizedState.messages`, `TimelineItem`, `ReplaySessionData`, `GroupedTimelineItem`. References `MessageRole`, `MessageStatus`, `ContentBlock`.

---

### NormalizedThought

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface NormalizedThought {
  id: string;
  content: string;
  turnId?: string;
  createdAt?: number;
  updatedAt?: number;
}
```

An agent's internal reasoning, displayed in a collapsible "thinking" section. Thoughts accumulate over multiple chunks within the same `turnId`. Simpler than `NormalizedMessage` because thoughts don't have roles, statuses, or structured content blocks.

**Relationships:** Used in `NormalizedState.thoughts`, `TimelineItem`, `ReplaySessionData`, `ThoughtItem`. Grouped by `ThoughtGroup`.

---

### NormalizedToolCall

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface NormalizedToolCall {
  toolCallId: string;
  kind: ToolCallKind;
  title: string;
  status: ToolCallStatus;
  rawInput?: {
    filePath?: string;
    command?: string;
    pattern?: string;
    [key: string]: unknown;
  };
  rawOutput?: {
    metadata: {
      loaded?: string[];
      preview?: string;
      truncated: boolean;
      exit?: number;
    };
    output: string;
  };
  createdAt?: number;
  updatedAt?: number;
}
```

A tool invocation by the agent. The `kind` field categorizes the tool for display (file read, search, edit, etc.). `rawInput` captures the tool's arguments in a loosely-typed way. `rawOutput` contains the result with metadata about truncation and loaded files.

Tool calls arrive in two phases: first a `tool_call` update sets up the basics, then a `tool_call_update` fills in the output after execution.

**Relationships:** Used in `NormalizedState.toolCalls`, `TimelineItem`, `ReplaySessionData`, `ThoughtItem`. Grouped with thoughts in `ThoughtGroup`.

---

### NormalizedPermissionRequest

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface NormalizedPermissionRequest {
  requestId: number;
  sessionId: string;
  toolCallId: string;
  options: Array<{
    optionId: string;
    name: string;
    kind: string;
  }>;
  status: PermissionRequestStatus;
  selectedOptionId?: string;
  createdAt: number;
}
```

A pending permission request from the agent. Tracks which tool call triggered it, what options the user can choose from, and whether a response has been given. The `selectedOptionId` is populated when the user responds via `updatePermissionRequestStatus()`.

**Relationships:** Used in `NormalizedState.permissionRequests`, `TimelineItem`. References `PermissionRequestStatus`.

---

### TimelineItem

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
type TimelineItem =
  | { type: "message"; id: string; data: NormalizedMessage }
  | { type: "thought"; id: string; data: NormalizedThought }
  | { type: "tool_call"; id: string; data: NormalizedToolCall }
  | { type: "permission_request"; id: number; data: NormalizedPermissionRequest };
```

A discriminated union that puts messages, thoughts, tool calls, and permission requests into a single chronological list. Use `getTimeline(state)` to get these in order. Each variant has both a `type` discriminant and a `data` payload with the full entity.

Note that `permission_request` uses `number` for `id` (matching the JSON-RPC request ID), while the others use `string`.

**Relationships:** References `NormalizedMessage`, `NormalizedThought`, `NormalizedToolCall`, `NormalizedPermissionRequest`. Returned by `getTimeline()`. Used by `ThoughtItem`, `GroupedTimelineItem`.

---

### Enum-like Types

These string literal unions act as type-safe enumerations for the status and category fields on the entity types.

---

### MessageRole

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
type MessageRole = "user" | "agent";
```

Who sent the message. `"user"` for human input, `"agent"` for AI output.

**Relationships:** Used in `NormalizedMessage.role`.

---

### MessageStatus

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
type MessageStatus = "streaming" | "complete" | "cancelled" | "error";
```

Where the message is in its lifecycle. `"streaming"` means the agent is still generating content. The normalization layer maps ACP's `"in_progress"` to `"streaming"` and `"done"` to `"complete"`.

**Relationships:** Used in `NormalizedMessage.status`.

---

### ToolCallKind

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
type ToolCallKind = "read" | "search" | "edit" | "write" | "execute" | "glob" | "grep" | "unknown";
```

A categorization of what the tool does. Used by the UI to pick appropriate icons and display formatting. Anything not in the known list maps to `"unknown"`.

**Relationships:** Used in `NormalizedToolCall.kind`.

---

### ToolCallStatus

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
type ToolCallStatus = "pending" | "completed";
```

Whether the tool has finished executing. `"pending"` means the agent called the tool but the result hasn't arrived yet.

**Relationships:** Used in `NormalizedToolCall.status`.

---

### PermissionRequestStatus

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
type PermissionRequestStatus = "pending" | "approved" | "denied" | "cancelled";
```

The resolution state of a permission request. Starts as `"pending"`, then transitions to one of the terminal states when the user responds or the request is cancelled.

**Relationships:** Used in `NormalizedPermissionRequest.status`. Used by `updatePermissionRequestStatus()`.

---

### TimelineItemType

**File:** `src/normalization/store.ts`
**Exported:** No (exported from `store.ts` but not re-exported from `src/index.ts`)

```typescript
type TimelineItemType = "message" | "thought" | "tool_call" | "permission_request";
```

The type discriminant used in `NormalizedState.timelineOrder`. Matches the `type` field values in `TimelineItem`.

**Relationships:** Used in `NormalizedState.timelineOrder`.

---

### Content Block Types

ACP messages can contain structured content beyond plain text. These types model that structure.

---

### ContentBlockType

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
type ContentBlockType = "text" | "resource" | "resource_link";
```

The type discriminant for content blocks. Plain text, embedded resources (with inline data), and resource links (references without inline data).

**Relationships:** Used in the `type` field of all `ContentBlock` variants.

---

### TextContentBlock

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface TextContentBlock {
  type: "text";
  text: string;
}
```

A plain text segment. The simplest content block. Multiple consecutive text blocks get merged during normalization by `mergeContentBlocks()`.

---

### ResourceContentBlock

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface ResourceContentBlock {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string | undefined;
    text?: string | undefined;
    blob?: string | undefined;
  };
}
```

An embedded resource with its content inlined. The `text` field holds text-based resources, while `blob` holds base64-encoded binary data. `mimeType` tells you the format.

---

### ResourceLinkContentBlock

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
interface ResourceLinkContentBlock {
  type: "resource_link";
  resourceLink: {
    uri: string;
    mimeType?: string | undefined;
  };
}
```

A reference to a resource without inlining its content. Lighter weight than `ResourceContentBlock` because it doesn't carry the actual data. Use the `uri` to fetch the content when needed.

---

### ContentBlock

**File:** `src/normalization/store.ts`
**Exported:** Yes

```typescript
type ContentBlock = TextContentBlock | ResourceContentBlock | ResourceLinkContentBlock;
```

The discriminated union of all content block types. Use `block.type` to narrow:

```typescript
function renderBlock(block: ContentBlock): string {
  switch (block.type) {
    case "text": return block.text;
    case "resource": return `[Resource: ${block.resource.uri}]`;
    case "resource_link": return `[Link: ${block.resourceLink.uri}]`;
  }
}
```

**Relationships:** References `TextContentBlock`, `ResourceContentBlock`, `ResourceLinkContentBlock`. Used in `NormalizedMessage.contentBlocks`.

---

### Internal Normalization Types

These types exist in `src/normalization/store.ts` but are not exported. They represent the raw shapes coming from ACP before normalization converts them.

---

### AgentMessageChunk *(internal)*

```typescript
interface AgentMessageChunk {
  type?: string;
  sessionUpdate?: string;
  turnId?: string;
  role?: string;
  content?: Array<{ type: string; text: string }> | { type: string; text: string };
  status?: string;
  timestamp?: number;
}
```

Raw shape of an `agent_message_chunk` or `agent_thought_chunk` ACP update. The `content` can be either an array of content blocks or a single block. The normalization layer handles both cases.

---

### UserMessage *(internal)*

```typescript
interface UserMessage {
  type?: string;
  sessionUpdate?: string;
  turnId?: string;
  role?: string;
  content?: Array<{ type: string; text: string }> | { type: string; text: string };
  timestamp?: number;
}
```

Raw shape of `user_message` and `user_message_chunk` ACP updates. Simpler than `AgentMessageChunk` because user messages don't have a `status` field.

---

### ToolCallUpdate *(internal)*

```typescript
interface ToolCallUpdate {
  type?: string;
  sessionUpdate?: string;
  toolCallId?: string;
  kind?: string;
  title?: string;
  status?: string;
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

Raw shape of `tool_call` and `tool_call_update` ACP updates. All fields are optional because different update types carry different subsets.

---

### PermissionRequestUpdate *(internal)*

```typescript
interface PermissionRequestUpdate {
  type?: string;
  sessionUpdate?: string;
  requestId?: number;
  sessionId?: string;
  toolCallId?: string;
  options?: Array<{
    optionId: string;
    name: string;
    kind: string;
  }>;
  status?: string;
  selectedOptionId?: string;
  timestamp?: number;
}
```

Raw shape of `permission_request` ACP updates. Maps to `NormalizedPermissionRequest` through `applyPermissionRequest()`.

---

### AcpUpdate *(internal)*

```typescript
type AcpUpdate = AgentMessageChunk | UserMessage | ToolCallUpdate | PermissionRequestUpdate | { type?: string; sessionUpdate?: string; [key: string]: unknown };
```

The catch-all union for any ACP update shape. The final variant with `[key: string]: unknown` handles unrecognized update types gracefully.

---

## Helper

Pure functions and types for UI logic that doesn't belong in the state layer. Originally in the Svelte package, moved here so any UI framework can use them.

### Composer

---

### ComposerState

**File:** `src/helpers/composer-logic.ts`
**Exported:** Yes

```typescript
interface ComposerState {
  value: string;
  disabled: boolean;
  isStreaming: boolean;
  isComposing: boolean;
}
```

The state of the message input field. `value` is the current text. `disabled` blocks input during initialization. `isStreaming` means the agent is generating a response. `isComposing` is true while the user is in an IME composition (important for CJK languages).

**Relationships:** Input to `canSend()`, used by composer-related helper functions.

---

### PromptPhase

**File:** `src/helpers/composer-logic.ts`
**Exported:** Yes

```typescript
type PromptPhase = "idle" | "active" | "complete" | "cancelled" | "error";
```

Where the prompt lifecycle currently stands. `"idle"` before the user sends anything. `"active"` while the agent is working. Terminal states are `"complete"`, `"cancelled"`, and `"error"`.

**Relationships:** Used in `PromptLifecycleState.phase`.

---

### PromptLifecycleState

**File:** `src/helpers/composer-logic.ts`
**Exported:** Yes

```typescript
interface PromptLifecycleState {
  phase: PromptPhase;
  turnId?: string | undefined;
}
```

Tracks a prompt's lifecycle phase and the associated turn ID. Created by `startPrompt()`, `completePrompt()`, `cancelPrompt()`, and `failPrompt()`. The `turnId` is set when the prompt starts and lets you correlate the prompt with the resulting message.

**Relationships:** References `PromptPhase`. Input to `isPromptActive()` and `shouldShowStopButton()`.

---

### Thought Stack

Types for grouping consecutive thoughts and tool calls into collapsible sections.

---

### ThoughtItem

**File:** `src/helpers/thought-stack-logic.ts`
**Exported:** Yes

```typescript
interface ThoughtItem {
  type: "thought" | "tool_call";
  id: string;
  data: NormalizedThought | NormalizedToolCall;
}
```

A thought or tool call that belongs to a thought group. Extracted from `TimelineItem` by filtering for the `"thought"` and `"tool_call"` variants.

**Relationships:** Used in `ThoughtGroup.items`. References `NormalizedThought`, `NormalizedToolCall`.

---

### ThoughtGroup

**File:** `src/helpers/thought-stack-logic.ts`
**Exported:** Yes

```typescript
interface ThoughtGroup {
  id: string;
  items: ThoughtItem[];
  startTime: number;
  endTime: number;
}
```

A consecutive run of thoughts and tool calls grouped together for display. Created by `groupThoughtItems()` or `createGroupedTimeline()`. The `startTime` and `endTime` come from the first and last item's `createdAt` timestamps.

**Relationships:** Contains `ThoughtItem[]`. Used in `GroupedTimelineItem`.

---

### GroupedTimelineItem

**File:** `src/helpers/thought-stack-logic.ts`
**Exported:** Yes

```typescript
type GroupedTimelineItem =
  | { type: "message"; id: string; data: Extract<TimelineItem, { type: "message" }>["data"] }
  | { type: "thought_group"; id: string; data: ThoughtGroup };
```

A timeline where consecutive thoughts and tool calls are collapsed into a single `thought_group` entry. Produced by `createGroupedTimeline()`. Messages stay as individual items. This is the type you render in the main chat view.

**Relationships:** References `TimelineItem`, `ThoughtGroup`.

---

## Presets

---

### LaunchPreset

**File:** `src/presets/launch.ts`
**Exported:** Yes

```typescript
interface LaunchPreset {
  launchCmd: string | null;
  sessionId: string | null;
  cwd: string | null;
  bridgeMode: "proxy" | "replay" | null;
  autoConnect: boolean;
  bridgeUrl: string;
  replayFile: string | null;
}
```

Parsed from environment variables (`ACP_LAUNCH_CMD`, `ACP_SESSION_ID`, `ACP_CWD`, `ACP_BRIDGE_MODE`, `ACP_AUTO_CONNECT`, `ACP_BRIDGE_URL`, `ACP_REPLAY_FILE`). Controls how the app starts up:

- `bridgeMode: "proxy"` means the bridge connects to a live agent. Requires `launchCmd`.
- `bridgeMode: "replay"` means the bridge replays a recorded session. Requires `replayFile`.
- `autoConnect` tells the UI to connect immediately on load.
- `bridgeUrl` defaults to `ws://127.0.0.1:8765`.

Validate with `isPresetValid()` before using.

**Relationships:** Created by `parseLaunchPreset()`. Validated by `isPresetValid()`.

---

## Type Dependency Map

This shows how the major types connect. Arrows point from a type to the types it references.

```
LaunchPreset
  -> (controls) TransportClient, SessionController, ReplayController

TransportClient
  -> TransportConfig, TransportEvents, ConnectionStatus, InitSuccess, BridgeEnvelope

BridgeEnvelope (GENERATED)
  -> BridgeStatus, JsonValue

SessionController
  -> SessionControllerState, StartAgentConfig, PermissionRequestParams, PermissionOption
  -> TransportClient, BridgeEnvelope

ReplayController
  -> ReplayControllerState, ReplayControllerOptions, ReplayMode, ReplayModel
  -> SessionControllerState (extended), TransportClient, BridgeEnvelope

SessionCaptureInterceptor
  -> CapturedSession, CapturedEvent, ReplaySessionData
  -> (wraps) SessionController

CapturedSession -> CapturedEvent -> BridgeEnvelope
                -> ReplaySessionData -> NormalizedMessage, NormalizedThought, NormalizedToolCall

NormalizedState -> NormalizedMessage, NormalizedThought, NormalizedToolCall, NormalizedPermissionRequest
               -> TimelineItem, TimelineItemType

TimelineItem -> NormalizedMessage, NormalizedThought, NormalizedToolCall, NormalizedPermissionRequest

NormalizedMessage -> MessageRole, MessageStatus, ContentBlock
ContentBlock -> TextContentBlock, ResourceContentBlock, ResourceLinkContentBlock
NormalizedToolCall -> ToolCallKind, ToolCallStatus
NormalizedPermissionRequest -> PermissionRequestStatus

GroupedTimelineItem -> TimelineItem, ThoughtGroup
ThoughtGroup -> ThoughtItem -> NormalizedThought, NormalizedToolCall

ComposerState -> (standalone)
PromptLifecycleState -> PromptPhase
```

---

## Export Summary

Every type re-exported from `src/index.ts`, grouped by import path:

```typescript
// From generated/index.js (GENERATED)
export type { BridgeEnvelope, BridgeMessage, BridgeStatus, UnsupportedVersionError }

// From transport/index.js
export type { ConnectionStatus, TransportConfig, TransportEvents, InitSuccess }

// From session/index.js
export type { SessionControllerState, StartAgentConfig, PermissionRequestParams, PermissionOption }
export type { CapturedSession, CapturedEvent, SessionCaptureInterceptor }
export type { ReplayControllerOptions, ReplayControllerState, ReplayMode, ReplayModel }

// From normalization/index.js
export type {
  NormalizedMessage, NormalizedState, NormalizedThought, NormalizedToolCall,
  MessageRole, MessageStatus, ToolCallKind, ToolCallStatus,
  ContentBlock, ContentBlockType, TextContentBlock, ResourceContentBlock, ResourceLinkContentBlock,
  TimelineItem, SessionUpdateParams,
  NormalizedPermissionRequest, PermissionRequestStatus,
}

// From replay/types.js
export type { ReplaySessionMetadata, ReplaySessionData, ReplayEvent, ReplayManifest }

// From presets/index.js
export type { LaunchPreset }

// From helpers/index.js
export type { ComposerState, PromptPhase, PromptLifecycleState, ThoughtItem, ThoughtGroup, GroupedTimelineItem }
```

Types defined in source files but **not** re-exported from `src/index.ts`:

| Type | File | Reason |
|------|------|--------|
| `InitError` | `transport/client.ts` | Errors surface as rejected promises |
| `DisconnectSuccess` | `transport/client.ts` | Trivially always `{ status: "success" }` |
| `JsonValue` | `generated/serde_json/JsonValue.ts` | Only needed by generated types internally |
| `TimelineItemType` | `normalization/store.ts` | Used only within the normalization layer |
| `AgentMessageChunk` | `normalization/store.ts` | Internal raw ACP update shape |
| `UserMessage` | `normalization/store.ts` | Internal raw ACP update shape |
| `ToolCallUpdate` | `normalization/store.ts` | Internal raw ACP update shape |
| `PermissionRequestUpdate` | `normalization/store.ts` | Internal raw ACP update shape |
| `AcpUpdate` | `normalization/store.ts` | Internal catch-all union |
| `CaptureState` | `session/capture-interceptor.ts` | Internal mutable state |
