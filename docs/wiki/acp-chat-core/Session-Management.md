# Session Management

This page covers the session management layer in `acp-chat-core`: the `SessionController`, its state model, event system, JSON-RPC request/response flow, and the companion classes that extend it for replay and capture.

Everything starts with `SessionController`. It owns the WebSocket transport, tracks pending requests, and exposes a subscriber-based event model. If you need to build a chat UI on top of ACP, this is your entry point.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [SessionController](#sessioncontroller)
  - [Constructor](#constructor)
  - [Internal Fields](#internal-fields)
  - [State](#state-sessioncontrollerstate)
  - [Events](#events)
  - [The `on()` Subscriber Pattern](#the-on-subscriber-pattern)
  - [Lifecycle Methods](#lifecycle-methods)
  - [Session Operations](#session-operations)
  - [Permission Handling](#permission-handling)
  - [Agent Control](#agent-control)
  - [State Query](#state-query)
  - [Private Internals](#private-internals)
- [JSON-RPC Request/Response Pattern](#json-rpc-requestresponse-pattern)
- [Bridge Envelope Format](#bridge-envelope-format)
- [Data Flow](#data-flow)
- [ReplayController](#replaycontroller)
- [CaptureInterceptor](#captureinterceptor-defaultsessioncaptureinterceptor)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)
- [Design Patterns](#design-patterns)

---

## Architecture Overview

The session layer sits between the raw WebSocket transport and your application code. It handles three concerns:

1. **Connection lifecycle**. Opens and closes the WebSocket, tracks connection and bridge status.
2. **JSON-RPC messaging**. Sends requests with auto-incrementing IDs, matches responses, and handles timeouts.
3. **Event distribution**. Fans out state changes, session updates, traffic, errors, permission requests, and session clearing events to subscribers.

The transport layer (`TransportClient`) handles the raw WebSocket, reconnect logic, and envelope parsing. `SessionController` wraps it with ACP-specific semantics.

```
+-------------------+      +--------------------+      +----------+
|   Application     | ---> | SessionController  | ---> | WebSocket|
|   (React UI, etc) | <--- | (or ReplayCtrl)    | <--- |  Bridge  |
+-------------------+      +--------------------+      +----------+
                                    |
                            +-------+-------+
                            |               |
                     CaptureInterceptor   AcpStore
```

---

## SessionController

The main controller class. Imported from `acp-chat-core`:

```ts
import { SessionController } from "acp-chat-core";
```

### Constructor

```ts
constructor(bridgeUrl: string, requestTimeoutMs?: number)
```

**Note:** While the `requestTimeoutMs` parameter appears optional, the implementation hardcodes it to `30000` (30 seconds) when not provided. The parameter cannot be overridden in the current implementation.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `bridgeUrl` | `string` | required | WebSocket URL of the Rust bridge (e.g. `ws://localhost:3100`) |
| `requestTimeoutMs` | `number` | `30000ms (30 seconds)` | Milliseconds before a pending JSON-RPC request is rejected with a timeout error. **Note:** This value is hardcoded in the implementation and cannot be customized. |

Creates a `TransportClient` internally with `reconnect: true`, sets initial state to all-disconnected, and wires up three transport event handlers (`statusChange`, `envelope`, `error`).

```ts
const controller = new SessionController("ws://localhost:3100"); // Uses hardcoded 30s timeout
```

### Internal Fields

These are all private. Documented here so you understand how the class works internally.

| Field | Type | Purpose |
|---|---|---|
| `transport` | `TransportClient` | The underlying WebSocket client. Created in the constructor, never reassigned. |
| `nextRequestId` | `number` | Auto-incrementing counter for JSON-RPC request IDs. Starts at `1`. |
| `pendingRequests` | `Map<number, PendingRequest>` | Tracks in-flight requests by their numeric ID. Each entry holds the Promise resolve/reject callbacks and a timeout handle. |
| `requestTimeoutMs` | `number` | Timeout duration for each request. Copied from the constructor argument. |
| `state` | `SessionControllerState` | The mutable state object. See [State](#state-sessioncontrollerstate). |
| `statusHandlers` | `Set<StatusHandler>` | Subscribers for state changes. |
| `sessionUpdateHandlers` | `Set<SessionUpdateHandler>` | Subscribers for session data updates (messages, thoughts). |
| `trafficHandlers` | `Set<TrafficHandler>` | Subscribers for raw traffic (every inbound/outbound message). |
| `errorHandlers` | `Set<ErrorHandler>` | Subscribers for errors. |
| `sessionClearingHandlers` | `Set<SessionClearingHandler>` | Subscribers notified before a session is cleared/replaced. |
| `permissionRequestHandlers` | `Set<PermissionRequestHandler>` | Subscribers for permission prompts from the agent. |

### State (`SessionControllerState')

`getState()` returns a **shallow copy** of the internal state. Mutating the returned object won't affect the controller.

```ts
interface SessionControllerState {
  connectionStatus: ConnectionStatus; // WebSocket connection state
  bridgeStatus: string;               // Bridge lifecycle state
  sessionId: string | null;           // Current active session, or null
  initialized: boolean;               // Has initialize() succeeded?
  capabilities: unknown | null;       // Server capabilities from initialize()
}
```

#### `connectionStatus`

```ts
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
```

Managed by the transport. Changes whenever the WebSocket state changes.

#### `bridgeStatus`

```ts
type BridgeStatus = "starting" | "connected" | "reconnecting" | "disconnected" | "error";
```

Comes from `bridge_status` envelopes sent by the Rust bridge. This is separate from `connectionStatus` because the WebSocket can be connected while the bridge agent is still starting up.

#### `sessionId`

Set when `createSession()` or `loadSession()` succeeds. `null` when no session is active.

#### `initialized`

Flips to `true` after a successful `initialize()` call.

#### `capabilities`

The raw result from the `initialize` JSON-RPC call. Contains server-reported capabilities. Typed as `unknown` because the schema is defined by the ACP protocol, not this library.

### Events

The controller emits six typed events. All subscription happens through the `on()` method, and all handler sets use `Set` to prevent duplicate subscriptions.

| Event | Handler Signature | When it fires |
|---|---|---|
| `statusChange` | `(state: SessionControllerState) => void` | Any state field changes. Receives a snapshot. |
| `sessionUpdate` | `(params: unknown) => void` | New messages, thoughts, or batched updates arrive from the agent. |
| `traffic` | `(direction: "in" \| "out", data: unknown) => void` | Every message sent or received. Useful for debugging and capture. |
| `error` | `(error: Error) => void` | Transport errors, parse failures, version mismatches. |
| `sessionClearing` | `() => void` | Right before a session is replaced (called by `loadSession`). Use this to reset local state. |
| `permissionRequest` | `(params: PermissionRequestParams & { requestId: number }) => void` | Agent is asking for user approval to use a tool. |

### The `on()` Subscriber Pattern

Every `on()` call returns an **unsubscribe function**. Call it to remove the handler. This avoids the need for `off()` or `removeListener()` methods and makes cleanup straightforward.

```ts
const unsub = controller.on("statusChange", (state) => {
  console.log("Status changed:", state.connectionStatus);
});

// Later, when you want to stop listening:
unsub();
```

The method is overloaded for each event name so TypeScript narrows the handler type automatically:

```ts
on(event: "statusChange", handler: (state: SessionControllerState) => void): () => void;
on(event: "sessionUpdate", handler: (params: unknown) => void): () => void;
on(event: "traffic", handler: (direction: "in" | "out", data: unknown) => void): () => void;
on(event: "error", handler: (error: Error) => void): () => void;
on(event: "sessionClearing", handler: () => void): () => void;
on(event: "permissionRequest", handler: (params: PermissionRequestParams & { requestId: number }) => void): () => void;
```

Handlers are stored in `Set` instances. Adding the same function reference twice is a no-op (the Set ignores duplicates). This is intentional: it prevents double-firing when component code re-subscribes.

### Lifecycle Methods

#### `connect()`

```ts
connect(): void
```

Opens the WebSocket connection to the bridge. Safe to call when already connected (no-ops). The transport handles reconnect automatically.

#### `disconnect()`

```ts
disconnect(): void
```

Closes the WebSocket connection and immediately rejects all pending JSON-RPC requests with `new Error("Disconnected")`.

#### `initialize()`

```ts
async initialize(clientInfo?: { name: string; version: string }): Promise<unknown>
```

Sends the `initialize` JSON-RPC method with protocol version 1. Sets `state.initialized` to `true` and stores the result in `state.capabilities`. Emits a `statusChange` event.

The `clientInfo` parameter is optional. If provided, it tells the bridge which client is connecting.

```ts
await controller.initialize({ name: "my-chat-app", version: "1.0.0" });
```

### Session Operations

#### `createSession()`

```ts
async createSession(cwd: string, mcpServers?: unknown[]): Promise<unknown>
```

Creates a new agent session. Sends `session/new` with the working directory and optional MCP server configs. On success, updates `state.sessionId` and emits `statusChange`.

Returns the raw result, which includes the `sessionId`.

```ts
const result = await controller.createSession("/home/user/project", []);
console.log("Created session:", (result as any).sessionId);
```

#### `loadSession()`

```ts
async loadSession(sessionId: string, cwd: string, mcpServers?: unknown[]): Promise<unknown>
```

Loads an existing session. **Emits `sessionClearing` before sending the request** so consumers can reset their local state. On success, sets `state.sessionId` and emits `statusChange`.

```ts
await controller.loadSession("abc-123", "/home/user/project", []);
```

#### `listSessions()`

```ts
async listSessions(cursor?: string, cwd?: string): Promise<{
  sessions: Array<{
    sessionId: string;
    cwd: string;
    title?: string;
    updatedAt?: string;
    _meta?: unknown;
  }>;
  nextCursor?: string;
}>
```

Lists available sessions. Supports cursor-based pagination and optional filtering by working directory.

```ts
const { sessions, nextCursor } = await controller.listSessions(undefined, "/home/user/project");
for (const s of sessions) {
  console.log(`${s.sessionId}: ${s.title ?? "untitled"}`);
}
```

#### `sendPrompt()`

```ts
async sendPrompt(sessionId: string, prompt: string): Promise<void>
```

Sends a user prompt to the active session. The prompt string is wrapped in a text block array:

```ts
// Internally:
[{ type: "text", text: prompt }]
```

The response comes back as `sessionUpdate` events (not the Promise resolution). The Promise resolves when the bridge acknowledges receipt.

```ts
await controller.sendPrompt(sessionId, "Explain how this function works");
```

#### `cancelPrompt()`

```ts
async cancelPrompt(sessionId: string): Promise<void>
```

Cancels a running prompt. Sent as a JSON-RPC notification (no response expected). Note: this method sends a notification, not a request, so the Promise resolves immediately after sending.

```ts
await controller.cancelPrompt(sessionId);
```

### Permission Handling

When the agent wants to use a tool that requires approval, the bridge sends a `session/request_permission` notification. The controller parses it and emits a `permissionRequest` event.

The handler receives:

```ts
interface PermissionRequestParams {
  sessionId: string;
  toolCall: {
    toolCallId: string;
  };
  options: PermissionOption[];
}

interface PermissionOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "deny" | "deny_always";
}
```

Along with a `requestId` number needed to respond.

#### `respondToPermission()`

```ts
async respondToPermission(requestId: number, optionId: string): Promise<void>
```

Approves or denies a permission request by selecting one of the provided options. Sends a JSON-RPC response with `{ outcome: { outcome: "selected", optionId } }`.

```ts
controller.on("permissionRequest", (params) => {
  // Auto-approve "allow_once" if available
  const allowOnce = params.options.find(o => o.kind === "allow_once");
  if (allowOnce) {
    controller.respondToPermission(params.requestId, allowOnce.optionId);
  }
});
```

**Note:** The second parameter is the `optionId` string (e.g., `"allow_once"`), not the entire option object.

#### `cancelPermission()`

```ts
async cancelPermission(requestId: number): Promise<void>
```

Cancels a pending permission request. Sends a JSON-RPC response with `{ outcome: { outcome: "cancelled" } }`.

```ts
controller.cancelPermission(params.requestId);
```

### Agent Control

#### `startAgent()`

```ts
async startAgent(config: StartAgentConfig): Promise<void>
```

Tells the bridge to launch an agent process. This sends a raw `BridgeEnvelope` with type `start_agent` (not a JSON-RPC message), so there is no response to wait for.

```ts
interface StartAgentConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Array<[string, string]>;
}
```

```ts
await controller.startAgent({
  command: "claude",
  args: ["--agent"],
  cwd: "/home/user/project",
  env: [["API_KEY", "sk-..."]],
});
```

#### `initLive()`

```ts
async initLive(command: string, args: string[], cwd: string): Promise<InitSuccess>
```

Initializes a live agent session through the bridge transport. Returns `{ status: "success", mode: "live" }` on success. Throws on failure.

```ts
interface InitSuccess {
  status: "success";
  mode: "replay" | "live";
}
```

```ts
const result = await controller.initLive("claude", ["--agent"], "/home/user/project");
console.log("Live mode:", result.mode);
```

### State Query

#### `getState()`

```ts
getState(): SessionControllerState
```

Returns a shallow copy of the current state. The returned object is a fresh spread, so modifying it won't affect the controller's internal state.

```ts
const state = controller.getState();
if (state.connectionStatus === "connected" && state.initialized) {
  console.log("Ready to go, session:", state.sessionId);
}
```

### Private Internals

These methods are private but understanding them helps with debugging.

#### `sendRequest(method, params)`

Creates a JSON-RPC 2.0 request with the next sequential ID, registers it in `pendingRequests` with a timeout, and sends it over the transport. Returns a Promise that resolves when the matching response arrives (or rejects on timeout/disconnect).

#### `sendNotification(method, params)`

Sends a JSON-RPC notification (no ID, no response expected). Used for fire-and-forget messages like `session/cancel`.

#### `sendResponse(id, result)`

Sends a JSON-RPC response for a server-initiated request (like permission prompts).

#### `handleEnvelope(envelope)`

Called for every inbound `BridgeEnvelope`. Routes to `handleAcpPayload` for `acp_payload` types or updates `bridgeStatus` for `bridge_status` types.

#### `handleAcpPayload(payload)`

The core message router. Handles three cases:

1. **Response** (has numeric `id`): Matches to a pending request, resolves or rejects the Promise.
2. **Notification `session/update`**: Emits `sessionUpdate` events. Handles both single and batched updates.
3. **Notification `session/request_permission`**: Emits `permissionRequest` event.

#### `rejectAllPending(error)`

Rejects every pending request with the given error. Called during `disconnect()` and other teardown scenarios.

---

## JSON-RPC Request/Response Pattern

All ACP communication uses JSON-RPC 2.0 over WebSocket. The controller implements a promise-based RPC pattern:

### Request Flow

```
1. Controller creates request: { jsonrpc: "2.0", id: 42, method: "session/new", params: {...} }
2. Registers in pendingRequests: Map { 42 => { resolve, reject, timeout } }
3. Starts timeout timer (30s default)
4. Sends JSON over WebSocket
5. Emits "traffic" event (direction: "out")
   ...
6. Bridge forwards to agent, agent responds
7. Bridge wraps response in BridgeEnvelope { type: "acp_payload", payload: { id: 42, result: {...} } }
8. Transport receives and parses envelope
9. Controller's handleEnvelope() routes to handleAcpPayload()
10. Matches id=42 in pendingRequests
11. Clears timeout, resolves the Promise
12. Emits "traffic" event (direction: "in")
```

### Timeout Handling

If no response arrives within `requestTimeoutMs` (default 30 seconds), the pending request is removed from the map and the Promise is rejected:

```ts
// What happens internally:
const timeout = setTimeout(() => {
  this.pendingRequests.delete(id);
  reject(new Error(`Request ${id} (${method}) timed out`));
}, this.requestTimeoutMs);
```

The error message includes both the request ID and method name for debugging:

```
Error: Request 7 (session/new) timed out
```

### Notification Flow

Some messages are notifications (no ID, no response):

```ts
// Sent as notification (no response expected):
{ jsonrpc: "2.0", method: "session/cancel", params: { sessionId: "..." } }
```

### Response to Server

When the server sends a request (like a permission prompt), the controller sends back a response:

```ts
// Server sends: { id: 1, method: "session/request_permission", params: {...} }
// Client responds: { jsonrpc: "2.0", id: 1, result: { outcome: { outcome: "selected", optionId: "..." } } }
```

---

## Bridge Envelope Format

All messages from the bridge to the browser are wrapped in a `BridgeEnvelope`. This is the wire format defined by the Rust bridge and auto-generated in TypeScript via `ts-rs`.

### Structure

```ts
type BridgeEnvelope = {
  version: number;        // Currently must be 1
  seq: number;            // 0 in live mode, monotonically increasing in replay
  timestamp_ms: number;   // Unix timestamp in milliseconds
} & (
  | { type: "acp_payload";     payload: JsonValue }
  | { type: "bridge_status";   status: BridgeStatus }
  | { type: "stderr";          line: string }
  | { type: "process_exit";    code: number | null; signal: string | null }
  | { type: "replay_metadata"; captured_at_ms: number; total_envelopes: number; description: string | null }
  | { type: "start_agent";     command: string; args: string[]; cwd: string | null; env: [string, string][] }
)
```

This is a **discriminated union** on the `type` field. Each variant has its own set of additional fields.

### Envelope Types

| Type | Fields | Purpose |
|---|---|---|
| `acp_payload` | `payload` | Wraps a raw JSON-RPC message from the ACP agent. The bridge doesn't interpret the payload. |
| `bridge_status` | `status` | Notifies the client of bridge lifecycle changes. |
| `stderr` | `line` | A line of stderr output from the agent process. |
| `process_exit` | `code`, `signal` | The agent process has exited. |
| `replay_metadata` | `captured_at_ms`, `total_envelopes`, `description` | Metadata about the replay session. Sent once at the start of replay. |
| `start_agent` | `command`, `args`, `cwd`, `env` | Instruction to launch an agent process. This is sent *from* the client *to* the bridge, but shares the same envelope type. |

### Versioning

The envelope format is versioned. The current supported version is `1`. The bridge parser validates incoming envelopes:

```ts
const ENVELOPE_VERSION = 1;
const SUPPORTED_VERSIONS = [1];
```

If a future bridge sends version `2`, the parser throws a `BridgeVersionError`:

```ts
class BridgeVersionError extends Error {
  readonly received: number;
  readonly supported: readonly number[];
}
```

The `TransportClient` catches this in `parseEnvelopeSafe()` and emits it as an error event rather than crashing.

### BridgeStatus Values

```ts
type BridgeStatus = "starting" | "connected" | "reconnecting" | "disconnected" | "error";
```

These reflect the state of the bridge process and its connection to the ACP agent, independent of the WebSocket connection state.

---

## Data Flow

### Live Session Flow

```
  Browser                              Rust Bridge                         ACP Agent
  --------                             -----------                         ---------
     |                                      |                                  |
     |  connect()                           |                                  |
     |------- WebSocket connect ----------->|                                  |
     |<------ connection confirmed ---------|                                  |
     |                                      |                                  |
     |  initialize()                        |                                  |
     |------- JSON-RPC "initialize" ------->|  (stores capabilities)           |
     |<------ { result: capabilities } -----|                                  |
     |                                      |                                  |
     |  createSession(cwd)                  |                                  |
     |------- JSON-RPC "session/new" ------>|  spawn agent                     |
     |                                      |------- stdio connect ------------>|
     |<------ { result: { sessionId } } ----|                                  |
     |                                      |                                  |
     |  sendPrompt(sessionId, "...")        |                                  |
     |------- JSON-RPC "session/prompt" --->|------- ACP prompt --------------->|
     |                                      |                                  |
     |  (prompt acknowledged)               |                                  |
     |<------ { result: { messages } } -----|<------ streaming updates ---------|
     |                                      |                                  |
     |  sessionUpdate events fired          |                                  |
     |  (individual messages/thoughts       |                                  |
     |   emitted as they arrive)            |                                  |
     |                                      |                                  |
     |  cancelPrompt(sessionId)             |                                  |
     |------- JSON-RPC notification ------->|------- cancel ------------------->|
     |                                      |                                  |
```

### Permission Request Flow

```
  Browser                              Rust Bridge                         ACP Agent
  --------                             -----------                         ---------
     |                                      |                                  |
     |                                      |<------ tool needs permission -----|
     |                                      |                                  |
     |  permissionRequest event fired       |                                  |
     |<------ session/request_permission ---|                                  |
     |       { id, params: { sessionId,     |                                  |
     |         toolCall, options } }        |                                  |
     |                                      |                                  |
     |  User reviews options                |                                  |
     |                                      |                                  |
     |  respondToPermission(id, optionId)   |                                  |
     |------- JSON-RPC response ----------->|------- permission granted ------->|
     |       { id, result: { outcome:       |                                  |
     |         { outcome: "selected",       |                                  |
     |           optionId } } }             |                                  |
     |                                      |                                  |
```

### Session Update Batching

The bridge can send session updates individually or batched:

**Single update:**
```
{ method: "session/update", params: { sessionId, update: { ... } } }
```

**Batched updates:**
```
{ method: "session/update", params: { batched: true, updates: [ ... ] } }
```

The controller unrolls batched updates and emits a `sessionUpdate` event for each item. This means your handler always receives individual updates, never a batch.

---

## ReplayController

`ReplayController` provides the same public API as `SessionController` with two additions for replay mode. It connects to a bridge endpoint that replays a pre-recorded `.jsonl` session file instead of running a live agent.

```ts
import { ReplayController } from "acp-chat-core";
```

### Why it exists

For demos, testing, and development, you often want to replay a recorded session without running a real agent. `ReplayController` lets you swap it in for `SessionController` with zero code changes to your UI layer (aside from construction and the replay-specific methods).

### Constructor

```ts
constructor(options: ReplayControllerOptions)
```

```ts
interface ReplayControllerOptions {
  bridgeUrl: string;           // WebSocket URL of the replay-v2 endpoint
  modes?: ReplayMode[];        // Fake modes to expose via getState()
  models?: ReplayModel[];      // Fake models to expose via getState()
  requestTimeoutMs?: number;   // JSON-RPC timeout (default 30000)
}
```

Unlike `SessionController`, the `ReplayController` creates its transport with `reconnect: false`. Replays are finite and don't need reconnection.

```ts
const replay = new ReplayController({
  bridgeUrl: "ws://localhost:3100",
  modes: [{ id: "replay", name: "Replay", description: "Replay a recorded session" }],
  models: [{ id: "replay-model", name: "Replay Model", provider: "replay" }],
});
```

### State (`ReplayControllerState`)

Extends `SessionControllerState` with two extra fields:

```ts
interface ReplayControllerState extends SessionControllerState {
  modes: ReplayMode[];
  models: ReplayModel[];
}
```

```ts
interface ReplayMode {
  id: string;
  name: string;
  description?: string;
}

interface ReplayModel {
  id: string;
  name: string;
  description?: string;
  provider?: string;
}
```

Defaults are provided if you don't specify modes or models:

```ts
// Default modes:
[{ id: "replay", name: "Replay", description: "Replay a recorded session" }]

// Default models:
[{ id: "replay-model", name: "Replay Model", description: "Simulated model from replay data", provider: "replay" }]
```

### Same API as SessionController

These methods work identically to their `SessionController` counterparts:

| Method | Signature |
|---|---|
| `on()` | Same six events, same subscriber pattern, same return type |
| `getState()` | Returns `ReplayControllerState` (extends `SessionControllerState`) |
| `connect()` | Opens the WebSocket |
| `disconnect()` | Closes the WebSocket, rejects pending requests (returns `Promise<void>` unlike SessionController) |
| `initialize()` | Sends `initialize` JSON-RPC |
| `createSession()` | Same, plus optional `demoType` and `sessionId` params |
| `listSessions()` | Same |
| `loadSession()` | Same, emits `sessionClearing` first |
| `sendPrompt()` | Same |
| `cancelPrompt()` | Same |
| `respondToPermission()` | Sends permission response (uses `transport.send()` directly) |
| `cancelPermission()` | Sends deny response |

### Replay-Specific Methods

#### `initReplay()`

```ts
async initReplay(script: string, sessionId: string, replaySpeed?: number): Promise<{ status: "success"; mode: "replay" | "live" }>
```

Initializes replay mode. Must be called after `connect()` and before `createSession()`. The `script` parameter identifies which replay file to use, `sessionId` specifies the session to replay, and `replaySpeed` (optional, default: 1.0) controls playback speed.

```ts
await replay.connect();
await replay.initReplay("feature-demo", "abc-123", 1.0); // 1.0 = normal speed, 2.0 = 2x speed
```

#### `setReplaySpeed()`

```ts
setReplaySpeed(speed: number): void
```

Adjusts the playback speed. Sends a `set_replay_speed` notification to the bridge.

```ts
replay.setReplaySpeed(2.0); // 2x speed
```

### Differences from SessionController

| Aspect | SessionController | ReplayController |
|---|---|---|
| Transport reconnect | `true` | `false` |
| `disconnect()` return | `void` | `Promise<void>` |
| `createSession()` params | `cwd`, `mcpServers` | `cwd`, `mcpServers`, `demoType?`, `sessionId?` |
| `respondToPermission()` | Sends JSON-RPC response | Sends raw JSON via `transport.send()` |
| `cancelPermission()` | Sends JSON-RPC response | Sends raw JSON via `transport.send()` |
| `startAgent()` | Available | Not available |
| `initLive()` | Available | Not available |
| `initReplay()` | Not available | Available |
| `setReplaySpeed()` | Not available | Available |
| State type | `SessionControllerState` | `ReplayControllerState` (adds `modes`, `models`) |
| Handles `replay_metadata` envelope | No | Yes (no-op, informational) |
| Handles replay permission flow | Standard JSON-RPC | Also checks for permission data in `session/update` notifications |

---

## CaptureInterceptor (`DefaultSessionCaptureInterceptor`)

The capture interceptor wraps a `SessionController` and records all traffic during a session. Useful for creating replay files and debugging.

```ts
import { DefaultSessionCaptureInterceptor } from "acp-chat-core";
```

### Constructor

```ts
constructor(controller: SessionController)
```

Takes a `SessionController` instance. Registers traffic and session update handlers when capture starts.

### Interface

```ts
interface SessionCaptureInterceptor {
  startCapture(sessionId: string, initialState?: ReplaySessionData): void;
  stopCapture(): void;
  exportCapturedSession(): CapturedSession;
  isCapturing(): boolean;
  getActiveSessionId(): string | null;
}
```

### Methods

#### `startCapture()`

```ts
startCapture(sessionId: string, initialState?: ReplaySessionData): void
```

Begins recording. Registers `traffic` and `sessionUpdate` handlers on the controller. Throws if capture is already active.

The optional `initialState` parameter lets you capture pre-existing session state (messages, thoughts, tool calls) that existed before recording started.

```ts
interceptor.startCapture("session-abc", {
  messages: existingMessages,
  thoughts: [],
  toolCalls: [],
  sessionId: "session-abc",
  cwd: "/project",
});
```

#### `stopCapture()`

```ts
stopCapture(): void
```

Stops recording and unsubscribes from controller events. Throws if no capture is active.

#### `exportCapturedSession()`

```ts
exportCapturedSession(): CapturedSession
```

Returns the captured data. Can be called while capture is active (endTime will be null) or after stopping.

```ts
interface CapturedSession {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  events: CapturedEvent[];
  preExistingState: ReplaySessionData | null;
  modes: string[];
  models: string[];
}

interface CapturedEvent {
  envelope: BridgeEnvelope;
  tokenCount: number;
  timestamp: number;
  direction: "in" | "out";
}
```

#### `isCapturing()`

```ts
isCapturing(): boolean
```

Returns `true` if capture is currently active.

#### `getActiveSessionId()`

```ts
getActiveSessionId(): string | null
```

Returns the session ID being captured, or `null` if not capturing.

#### `stopCaptureAndExport()`

```ts
stopCaptureAndExport(outputDir?: string): CapturedSession
```

Convenience method that stops capture (if active) and exports the session. Also writes two files to disk:

- `{outputDir}/{startTime}/session-data.json` - Session metadata
- `{outputDir}/{startTime}/replay-events.jsonl` - Events as JSONL

Default output directory is `fixtures/replay-data/captured`.

```ts
const session = interceptor.stopCaptureAndExport();
```

### How It Works

When `startCapture()` is called, the interceptor subscribes to two controller events:

1. **`traffic`**: Records every inbound and outbound message as a `CapturedEvent`. Estimates token count using `text.length / 4`.
2. **`sessionUpdate`**: Extracts mode and model metadata from update payloads for the session summary.

Both handlers check `isCapturing()` before recording, so events received after `stopCapture()` won't be included.

When `stopCapture()` is called, the handlers are unsubscribed using the cleanup functions returned by `on()`.

---

## Error Handling

The controller doesn't throw for most errors. Instead, it emits them through the `error` event and rejects pending request promises.

### Error Sources

| Source | How it surfaces |
|---|---|
| WebSocket fails to connect | `error` event + `connectionStatus: "error"` |
| WebSocket closes unexpectedly | `connectionStatus: "disconnected"` or `"reconnecting"` |
| Envelope parse failure | `error` event with the parse error |
| Unsupported envelope version | `error` event with `BridgeVersionError` |
| JSON-RPC response with `error` field | Pending request Promise rejects |
| Request timeout | Pending request Promise rejects with `Error("Request N (method) timed out")` |
| Manual disconnect | All pending requests reject with `Error("Disconnected")` |

### Catching JSON-RPC Errors

```ts
try {
  await controller.createSession("/invalid/path");
} catch (err) {
  // err is an Error with the message from the JSON-RPC error response
  console.error("Failed:", (err as Error).message);
}
```

### Listening for Transport Errors

```ts
controller.on("error", (error) => {
  if (error instanceof BridgeVersionError) {
    console.error("Version mismatch:", error.received, "supported:", error.supported);
  } else {
    console.error("Transport error:", error.message);
  }
});
```

### Permission Error Pattern

Permission handling is not strictly an error case, but failures in the permission flow (like the agent timing out waiting for a response) surface through the agent's own error messages in `sessionUpdate` events, not through the controller's error channel.

---

## Usage Examples

### Basic Initialization

```ts
import { SessionController } from "acp-chat-core";

const controller = new SessionController("ws://localhost:3100");

// Listen for state changes
controller.on("statusChange", (state) => {
  console.log(`Connection: ${state.connectionStatus}, Bridge: ${state.bridgeStatus}`);
});

// Listen for errors
controller.on("error", (err) => {
  console.error("Controller error:", err.message);
});

// Connect and initialize
controller.connect();
await controller.initialize({ name: "my-app", version: "1.0.0" });
```

### Full Session Lifecycle

```ts
// 1. Set up
const controller = new SessionController("ws://localhost:3100");
controller.connect();

// 2. Initialize
await controller.initialize({ name: "chat-ui", version: "2.0.0" });

// 3. Create a session
const session = await controller.createSession("/home/user/project") as { sessionId: string };
console.log("Session:", session.sessionId);

// 4. Subscribe to updates
controller.on("sessionUpdate", (params) => {
  const p = params as { sessionId: string; update: any };
  console.log("Update:", p.update.type, "for session", p.sessionId);
});

// 5. Send a prompt
await controller.sendPrompt(session.sessionId, "What does this codebase do?");

// 6. Later, cancel if needed
await controller.cancelPrompt(session.sessionId);

// 7. Clean up
controller.disconnect();
```

### Event Subscription with Cleanup

```ts
// In a React component:
function useSessionEvents(controller: SessionController) {
  useEffect(() => {
    const unsubs = [
      controller.on("statusChange", (state) => {
        setStatus(state.connectionStatus);
      }),
      controller.on("sessionUpdate", (params) => {
        handleUpdate(params);
      }),
      controller.on("error", (err) => {
        reportError(err);
      }),
      controller.on("sessionClearing", () => {
        clearLocalState();
      }),
      controller.on("permissionRequest", (params) => {
        showPermissionDialog(params);
      }),
    ];

    // Cleanup on unmount
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [controller]);
}
```

### Permission Handling

```ts
controller.on("permissionRequest", (params) => {
  console.log("Permission requested for tool:", params.toolCall.toolCallId);
  console.log("Available options:");
  for (const option of params.options) {
    console.log(`  ${option.optionId}: ${option.name} (${option.kind})`);
  }

  // Example: show a dialog, let the user choose
  const userChoice = await showPermissionDialog(params);

  if (userChoice) {
    await controller.respondToPermission(params.requestId, userChoice.optionId);
  } else {
    await controller.cancelPermission(params.requestId);
  }
});
```

### Session Loading with State Reset

```ts
// Subscribe to clearing events to reset your state store
controller.on("sessionClearing", () => {
  myStore.reset(); // Clear messages, thoughts, tool calls
});

// Subscribe to updates to populate state
controller.on("sessionUpdate", (params) => {
  const p = params as { sessionId: string; update: any };
  myStore.applyUpdate(p.update);
});

// Load a previous session
await controller.loadSession("existing-session-id", "/project/path");
// The controller will:
// 1. Emit sessionClearing (you reset state)
// 2. Send session/load to bridge
// 3. Receive historical messages as updates
// 4. Emit sessionUpdate for each message/thought
```

### Replay Mode

```ts
import { ReplayController } from "acp-chat-core";

const replay = new ReplayController({
  bridgeUrl: "ws://localhost:3100",
  modes: [
    { id: "demo", name: "Feature Demo" },
  ],
  models: [
    { id: "gpt-4", name: "GPT-4", provider: "openai" },
  ],
});

// Same event subscriptions as SessionController
replay.on("sessionUpdate", (params) => {
  handleUpdate(params);
});

replay.on("statusChange", (state) => {
  console.log("Replay status:", state.connectionStatus);
  console.log("Modes:", state.modes);   // Only on ReplayControllerState
  console.log("Models:", state.models); // Only on ReplayControllerState
});

replay.connect();
await replay.initReplay("feature-demo", "recorded-session-id", 1.0);
await replay.initialize();
await replay.createSession("/project", []);

// Speed up playback
replay.setReplaySpeed(3.0);

// Clean up
await replay.disconnect();
```

### Session Capture

```ts
import { SessionController, DefaultSessionCaptureInterceptor } from "acp-chat-core";

const controller = new SessionController("ws://localhost:3100");
const interceptor = new DefaultSessionCaptureInterceptor(controller);

controller.connect();
await controller.initialize();
const session = await controller.createSession("/project") as { sessionId: string };

// Start recording
interceptor.startCapture(session.sessionId);

// ... user interacts with the session ...

// Check state
console.log("Capturing:", interceptor.isCapturing());
console.log("Session:", interceptor.getActiveSessionId());

// Stop recording
interceptor.stopCapture();

// Export to files
interceptor.exportCapturedSession("/path/to/output");

// Or use the convenience method that does both
const captured = interceptor.stopCaptureAndExport("/path/to/output");
console.log(`Captured ${captured.events.length} events`);
console.log(`Token estimate: ${captured.events.reduce((sum, e) => sum + e.tokenCount, 0)}`);
```

### Full Cleanup

```ts
function cleanup(controller: SessionController, unsubs: (() => void)[]) {
  // Unsubscribe all event handlers
  for (const unsub of unsubs) unsub();

  // Disconnect transport (also rejects all pending requests)
  controller.disconnect();
}
```

---

## Design Patterns

### Immutable State Snapshots

`getState()` returns a shallow copy (`{ ...this.state }`). Consumers can read the snapshot without worrying about it changing under them. The controller is the single writer.

This avoids the need for deep cloning while still preventing external mutation. Since all state fields are primitives or `null`, shallow copy is sufficient.

### Subscriber Pattern with Cleanup Functions

The `on()` method returns an unsubscribe function instead of requiring a separate `off()` call. This pattern works well with React's `useEffect` cleanup:

```ts
useEffect(() => {
  return controller.on("statusChange", handler);
  // The returned unsubscribe function IS the cleanup
}, []);
```

Using `Set` for handler storage means duplicate subscriptions are silently ignored. If the same function reference is passed twice, the second `add()` is a no-op.

### Promise-Based RPC

Every JSON-RPC request becomes a Promise. The controller tracks pending requests in a `Map<number, { resolve, reject, timeout }>`. When a response arrives with a matching ID, the Promise resolves (or rejects if the response contains an error).

This keeps the async boundary clean: callers use `await` and get typed results, while internally the controller manages the request ID lifecycle.

### Event-Driven Architecture

The controller doesn't know about your UI. It emits events and manages state. Your application subscribes to events and reacts. This makes the controller testable in isolation and decoupled from any specific rendering framework.

### Controller Swap (Live vs. Replay)

`ReplayController` mirrors `SessionController`'s public API. If your code depends only on the shared methods (`on`, `connect`, `disconnect`, `initialize`, `createSession`, `sendPrompt`, `cancelPrompt`, `loadSession`, `listSessions`, `getState`), you can swap between live and replay controllers without changing consumer code.

This works because both controllers emit the same events with the same shapes. The consumer can't tell (and shouldn't care) whether updates come from a live agent or a replay file.

### Interceptor Pattern

`DefaultSessionCaptureInterceptor` wraps a `SessionController` and listens to its events without modifying its behavior. It subscribes to `traffic` and `sessionUpdate` events during capture, records what it needs, and unsubscribes when done.

This keeps capture logic separate from session management. The interceptor can be added or removed without touching the controller or any other subscriber.
