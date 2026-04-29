# ACP Terminals Capability - Vertical Slice Research

**Date:** 2026-04-28
**Scope:** Trace the hot paths for adding `terminals` capability to `acp-chat-core`

---

## 1. How SessionController Handles Initialize and Capabilities

**File:** `packages/acp-chat-core/src/session/controller.ts`

### Current Initialize Implementation (lines 191-202)

```typescript
async initialize(clientInfo?: { name: string; version: string }): Promise<unknown> {
  const params = {
    protocolVersion: 1,
    clientCapabilities: {},       // <-- HARDCODED EMPTY
    ...(clientInfo ? { clientInfo } : {}),
  };
  const result = await this.sendRequest("initialize", params);
  this.state.initialized = true;
  this.state.capabilities = result;  // stores agent's capabilities
  this.emitStatusChange();
  return result;
}
```

### Key Observations

- `clientCapabilities` is currently **hardcoded to `{}`** - no capabilities are advertised
- The agent's capabilities response is stored in `this.state.capabilities` (typed as `unknown | null`)
- `SessionControllerState.capabilities` (line 31) has no specific type - it's `unknown`
- There is no mechanism to pass client capabilities (like `{ terminal: true }` or `{ fs: { readTextFile: true, writeTextFile: true } }`) into the controller

### What Needs to Change

The `initialize` method should accept an optional `clientCapabilities` parameter:

```typescript
interface InitializeOptions {
  clientInfo?: { name: string; version: string };
  clientCapabilities?: ClientCapabilities;  // from @agentclientprotocol/sdk
}

async initialize(options?: InitializeOptions): Promise<unknown>
```

---

## 2. Filesystem Capability as a Precedent - Full Trace

The filesystem capability is the closest existing precedent. Here is the full path:

### 2a. Types (`packages/acp-chat-core/src/filesystem/types.ts`)

```typescript
export interface FileReadRequest {
  path: string;
  line?: number;
  limit?: number;
}

export interface FileReadResponse {
  content: string;
}

export interface FileWriteRequest {
  path: string;
  content: string;
}

export interface FileWriteResponse {
  success: boolean;
}

export type FileReadHandler = (request: FileReadRequest) => Promise<FileReadResponse | null>;
export type FileWriteHandler = (request: FileWriteRequest) => Promise<FileWriteResponse | null>;

export interface FileSystemSubscription {
  unsubscribe(): void;
}
```

### 2b. Subscription Manager (`packages/acp-chat-core/src/filesystem/subscription-manager.ts`)

```typescript
export class FileSystemSubscriptionManager {
  private readHandlers: Map<string, FileReadHandler> = new Map();
  private writeHandlers: Map<string, FileWriteHandler> = new Map();
  private subscriptionCounter = 0;

  subscribeToFileReads(handler: FileReadHandler): FileSystemSubscription { ... }
  subscribeToFileWrites(handler: FileWriteHandler): FileSystemSubscription { ... }
  getReadHandlers(): FileReadHandler[] { ... }
  getWriteHandlers(): FileWriteHandler[] { ... }
}
```

### 2c. Controller Integration (`packages/acp-chat-core/src/session/controller.ts`)

The SessionController owns a `FileSystemSubscriptionManager`:

```typescript
// Line 86
private fileSystemManager: FileSystemSubscriptionManager;

// Line 105 - constructor
this.fileSystemManager = new FileSystemSubscriptionManager();

// Lines 335-341 - public subscription methods
public subscribeToFileReads(handler: FileReadHandler): FileSystemSubscription {
  return this.fileSystemManager.subscribeToFileReads(handler);
}

public subscribeToFileWrites(handler: FileWriteHandler): FileSystemSubscription {
  return this.fileSystemManager.subscribeToFileWrites(handler);
}
```

### 2d. Request Dispatch in `handleAcpPayload` (lines 386-410)

When the agent sends `fs/read_text_file` or `fs/write_text_file`, the controller handles them:

```typescript
// In handleAcpPayload - method dispatch
} else if (obj.method === "fs/read_text_file") {
  const requestId = obj.id as number | undefined;
  const params = obj.params as Record<string, unknown> | undefined;
  if (typeof requestId !== "number") {
    this.emitError(new Error("fs/read_text_file: missing or invalid request id"));
    return;
  }
  if (!params || typeof params.path !== "string") {
    this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: path required" });
    return;
  }
  this.handleFileReadRequest(requestId, params.path, params.line, params.limit);
} else if (obj.method === "fs/write_text_file") {
  // ... similar pattern
  this.handleFileWriteRequest(requestId, params.path, params.content);
}
```

### 2e. Handler Execution (lines 462-518)

```typescript
private async handleFileReadRequest(requestId: number, path: string, line?: unknown, limit?: unknown): Promise<void> {
  if (!this.validatePath(path)) {
    this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid path" });
    return;
  }

  const request: FileReadRequest = { path };
  // ... add line/limit if provided

  const handlers = this.fileSystemManager.getReadHandlers();
  if (handlers.length === 0) {
    this.sendJsonRpcErrorResponse(requestId, { code: -32601, message: "No file read handlers available" });
    return;
  }

  const results = await Promise.allSettled(handlers.map(h => h(request)));
  const successful = results.find(r => r.status === "fulfilled" && r.value !== null);

  if (successful) {
    await this.sendJsonRpcResponse(requestId, successful.value);
  } else {
    this.sendJsonRpcErrorResponse(requestId, { code: -32000, message: "Failed to read file" });
  }
}
```

### 2f. Exports (`packages/acp-chat-core/src/index.ts`)

```typescript
// Lines 150-161
export type {
  FileReadRequest, FileReadResponse, FileWriteRequest, FileWriteResponse,
  FileReadHandler, FileWriteHandler, FileSystemSubscription,
} from "./filesystem/types.js";

export { FileSystemSubscriptionManager } from "./filesystem/subscription-manager.js";
```

### 2g. Important Caveat - Transport Response Limitation

**Lines 521-538** reveal that the transport interface doesn't currently support sending raw JSON-RPC responses:

```typescript
private async sendJsonRpcErrorResponse(requestId: number, error: { code: number; message: string }): Promise<void> {
  const payload = { jsonrpc: "2.0" as const, id: requestId, error };
  this.emitTraffic("out", payload);
  console.warn("sendJsonRpcErrorResponse: Transport interface Doesn't support raw JSON sending yet");
}

private async sendJsonRpcResponse(requestId: number, result: FileReadResponse | FileWriteResponse): Promise<void> {
  const payload = { jsonrpc: "2.0" as const, id: requestId, result };
  this.emitTraffic("out", payload);
  console.warn("sendJsonRpcResponse: Transport interface Doesn't support raw JSON sending yet");
}
```

This is a **known limitation** - filesystem (and by extension terminal) response delivery through the transport layer is incomplete.

---

## 3. Method Handler Registration and Dispatch in `handleAcpPayload`

**File:** `packages/acp-chat-core/src/session/controller.ts`, lines 343-450

The `handleAcpPayload` method is the central dispatch hub. It is called from `handleNotification`:

```typescript
private handleNotification(notification: ACPNotification): void {
  this.emitTraffic("in", notification);
  this.handleAcpPayload(notification);
}
```

### Dispatch Logic Flow

```
handleAcpPayload(payload)
  |
  +-- Validate: is object? has id or method?
  |
  +-- [METHOD-BASED DISPATCH] if "method" in obj:
  |     |
  |     +-- "session/update"         --> emitSessionUpdate()
  |     +-- "session/request_permission" --> emitPermissionRequest()
  |     +-- "fs/read_text_file"      --> handleFileReadRequest()
  |     +-- "fs/write_text_file"     --> handleFileWriteRequest()
  |
  +-- [RESPONSE-BASED DISPATCH] if "id" in obj:
        |
        +-- Has result.messages[]    --> emitSessionUpdate for each
        +-- Has result.thoughts[]    --> emitSessionUpdate for each
        +-- Has error                --> emitError()
        +-- Pending request exists   --> resolve/reject
```

### Pattern for Adding Terminal Methods

Terminal methods follow the **request-response pattern** (like filesystem), not the notification pattern (like session/update). The agent sends a request with an `id`, and the client must respond with a result or error.

To add terminal support, new `else if` branches would be added in the method-based section:

```typescript
} else if (obj.method === "terminal/create") {
  const requestId = obj.id as number | undefined;
  const params = obj.params as Record<string, unknown> | undefined;
  if (typeof requestId !== "number") {
    this.emitError(new Error("terminal/create: missing or invalid request id"));
    return;
  }
  // Validate params.command
  this.handleTerminalCreateRequest(requestId, params);
} else if (obj.method === "terminal/output") {
  // ... similar
  this.handleTerminalOutputRequest(requestId, params);
} else if (obj.method === "terminal/wait_for_exit") {
  // ... similar
} else if (obj.method === "terminal/kill") {
  // ... similar
} else if (obj.method === "terminal/release") {
  // ... similar
}
```

---

## 4. Existing Terminal Types in `protocol/types.ts`

**File:** `packages/acp-chat-core/src/protocol/types.ts`

### Terminal Types Already Re-exported from SDK (lines 72-82)

```typescript
export type {
  // ... other types ...

  // Terminal types (lines 72-82)
  CreateTerminalRequest,
  CreateTerminalResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,

  // ... other types ...
} from "@agentclientprotocol/sdk";
```

### Terminal Methods Already in ACPMethod Type (lines 158-163)

```typescript
export type ACPMethod =
  // ... other methods ...
  // Terminal methods (if capability enabled)
  | "terminal/create"
  | "terminal/kill"
  | "terminal/output"
  | "terminal/release"
  | "terminal/wait_for_exit";
```

### SDK Types Summary

From the ACP SDK (`@agentclientprotocol/sdk` v0.18.2):

| Type | Description |
|------|-------------|
| `CreateTerminalRequest` | `{ command: string; args?: string[]; env?: Array<[string,string]>; cwd?: string; outputByteLimit?: number }` |
| `CreateTerminalResponse` | `{ terminalId: string }` |
| `TerminalOutputRequest` | `{ sessionId: string; terminalId: string }` |
| `TerminalOutputResponse` | `{ output: string; truncated?: boolean; exitStatus?: TerminalExitStatus }` |
| `WaitForTerminalExitRequest` | `{ sessionId: string; terminalId: string }` |
| `WaitForTerminalExitResponse` | `{ exitCode?: number; signal?: string }` |
| `KillTerminalRequest` | `{ sessionId: string; terminalId: string }` |
| `KillTerminalResponse` | `{}` |
| `ReleaseTerminalRequest` | `{ sessionId: string; terminalId: string }` |
| `ReleaseTerminalResponse` | `{}` |
| `TerminalExitStatus` | `{ exitCode?: number; signal?: string }` |
| `Terminal` | `{ terminalId: string }` (for content blocks) |

### ClientCapabilities in SDK

```typescript
export type ClientCapabilities = {
  _meta?: { [key: string]: unknown } | null;
  auth?: AuthCapabilities;
  elicitation?: ElicitationCapabilities | null;
  fs?: FileSystemCapabilities;       // { readTextFile?: boolean; writeTextFile?: boolean; }
  nes?: ClientNesCapabilities | null;
  positionEncodings?: Array<PositionEncodingKind>;
  terminal?: boolean;                 // <-- THIS IS THE CAPABILITY FLAG
};
```

---

## 5. What Would Need to Change to Add Terminal Support

### 5.1 Changes to `SessionController` (controller.ts)

#### A. Add Terminal Subscription Manager

Create a new `TerminalManager` class (analogous to `FileSystemSubscriptionManager`):

```
packages/acp-chat-core/src/terminal/
  types.ts              - TerminalCreateRequest, TerminalOutputResponse, etc.
  terminal-manager.ts   - TerminalManager class with subscribe pattern
```

Or simpler - inline handler storage directly in SessionController.

#### B. Add Client Capabilities to Initialize

```typescript
// Current:
async initialize(clientInfo?: { name: string; version: string }): Promise<unknown> {
  const params = {
    protocolVersion: 1,
    clientCapabilities: {},  // HARDCODED EMPTY
    ...(clientInfo ? { clientInfo } : {}),
  };

// Proposed:
interface InitializeOptions {
  clientInfo?: { name: string; version: string };
  clientCapabilities?: ClientCapabilities;  // { terminal?: boolean; fs?: {...} }
}

async initialize(options?: InitializeOptions): Promise<unknown> {
  const params = {
    protocolVersion: 1,
    clientCapabilities: options?.clientCapabilities ?? {},
    ...(options?.clientInfo ? { clientInfo: options.clientInfo } : {}),
  };
```

#### C. Add Terminal Subscription Methods

```typescript
// Pattern following filesystem:
public subscribeToTerminalCreate(handler: TerminalCreateHandler): TerminalSubscription {
  return this.terminalManager.subscribeToCreate(handler);
}

public subscribeToTerminalOutput(handler: TerminalOutputHandler): TerminalSubscription {
  return this.terminalManager.subscribeToOutput(handler);
}
// ... etc for each terminal method
```

#### D. Add Method Dispatch in handleAcpPayload

Add `else if` branches for each terminal method:
- `terminal/create`
- `terminal/output`
- `terminal/wait_for_exit`
- `terminal/kill`
- `terminal/release`

#### E. Add Terminal Handler Methods

Each terminal method needs a handler following the filesystem pattern:
- `handleTerminalCreateRequest(requestId, params)`
- `handleTerminalOutputRequest(requestId, params)`
- `handleTerminalWaitForExitRequest(requestId, params)`
- `handleTerminalKillRequest(requestId, params)`
- `handleTerminalReleaseRequest(requestId, params)`

#### F. Resolve Transport Response Limitation

The current `sendJsonRpcResponse` and `sendJsonRpcErrorResponse` methods only emit traffic but log a warning. The Transport interface needs a method to send raw JSON-RPC responses, or terminal (and filesystem) responses need a different delivery mechanism.

### 5.2 Changes to Exports (index.ts)

```typescript
// Add to packages/acp-chat-core/src/index.ts:
export type {
  TerminalCreateRequest,
  TerminalCreateResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  // ... etc
} from "./terminal/types.js";

export { TerminalManager } from "./terminal/terminal-manager.js";
```

### 5.3 Changes to Protocol Types (protocol/types.ts)

The terminal types are **already** re-exported from the SDK. No changes needed here unless custom types are required.

### 5.4 Changes to React Layer (acp-chat-react)

The React layer would need:
- New hooks for subscribing to terminal events (e.g., `useTerminalSubscription`)
- Integration with the store for terminal state management
- UI components for displaying terminal output

### 5.5 Changes to Client Capabilities Usage

Currently `clientCapabilities` is `{}`. Consumers (like acp-ws-bridge or the app) need to pass:

```typescript
await controller.initialize({
  clientInfo: { name: "acp-chat-ui", version: "0.0.1" },
  clientCapabilities: {
    terminal: true,
    fs: { readTextFile: true, writeTextFile: true },
  },
});
```

---

## Summary: Vertical Slice Comparison

| Aspect | Filesystem (existing) | Terminal (new) |
|--------|----------------------|----------------|
| **Types** | `filesystem/types.ts` (custom) | `protocol/types.ts` (from SDK, already present) |
| **Manager** | `FileSystemSubscriptionManager` | Need `TerminalManager` or equivalent |
| **Subscribe API** | `subscribeToFileReads()`, `subscribeToFileWrites()` | Need `subscribeToTerminalCreate()`, etc. |
| **Controller storage** | `private fileSystemManager` | Need `private terminalManager` |
| **Dispatch in handleAcpPayload** | `fs/read_text_file`, `fs/write_text_file` | Need `terminal/create`, `terminal/output`, etc. |
| **Handler methods** | `handleFileReadRequest()`, `handleFileWriteRequest()` | Need `handleTerminalCreateRequest()`, etc. |
| **Response delivery** | `sendJsonRpcResponse()` (known broken) | Same - transport limitation |
| **Exports in index.ts** | Types + Manager exported | Need same pattern |
| **Client capability** | `clientCapabilities.fs` | `clientCapabilities.terminal` |
| **Capability in initialize** | HARDCODED `{}` - not wired | Same issue - needs fix |

## Key Risks

1. **Transport Response Delivery is Broken**: Both filesystem and terminal responses use `sendJsonRpcResponse` which currently only emits traffic but logs a warning about missing transport support. This needs to be fixed for both capabilities to work.

2. **ClientCapabilities Not Wired**: The `initialize()` method sends `{}` for capabilities. This is a prerequisite for the agent to know terminal is available.

3. **Terminal Content Blocks**: The ACP spec mentions terminals can be embedded in tool calls as content blocks: `{ type: "terminal", terminalId: "..." }`. The normalization layer (`ContentBlockType = "text" | "resource" | "resource_link"`) would need a `"terminal"` variant added.
