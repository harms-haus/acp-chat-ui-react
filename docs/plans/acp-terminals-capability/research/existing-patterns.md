# Existing Patterns and Conventions in acp-chat-core

**Package:** `@harms-haus/acp-chat-core`  
**Root:** `packages/acp-chat-core`  
**Last Updated:** 2026-04-28

---

## 1. File Organization

Each feature follows a consistent directory structure under `src/`:

```
packages/acp-chat-core/src/
  index.ts                    # Barrel exports for the entire package
  protocol/
    index.ts                  # Barrel for protocol module
    types.ts                  # All ACP type re-exports + custom types
  transport/
    index.ts                  # Barrel for transport module
    transport-interface.ts    # Abstract Transport interface
  filesystem/
    types.ts                  # Feature-specific types
    subscription-manager.ts   # Feature-specific manager class
  session/
    index.ts                  # Barrel for session module
    controller.ts             # Main SessionController class
    factory.ts                # Factory function
    capture-interceptor.ts    # Capture/intercept infrastructure
  normalization/
    index.ts                  # Barrel for normalization module
    store.ts                  # Normalization state + apply functions
  helpers/
    index.ts                  # Barrel for helpers
    composer-logic.ts
    thought-stack-logic.ts
    token-estimation.ts
  test-utils/
    index.ts                  # Barrel for test utilities
    mocks.ts                  # MockTransport, MockSessionController
  __tests__/                  # Additional integration-level tests
```

**Key convention:** Each feature domain gets its own directory with:
- `types.ts` — all interfaces and type aliases
- `subscription-manager.ts` or similar manager class (if the feature has subscription/lifecycle management)
- No barrel `index.ts` inside `filesystem/` — exports go directly through the root `src/index.ts`

**Where new terminal files go:** Create `src/terminals/` with:
- `src/terminals/types.ts`
- `src/terminals/subscription-manager.ts`

---

## 2. Naming Conventions

### Types and Interfaces
- **Request/Response pairs:** `{Feature}{Operation}Request` / `{Feature}{Operation}Response`
  - Examples: `FileReadRequest`, `FileReadResponse`, `FileWriteRequest`, `FileWriteResponse`
- **Handler function types:** `{Feature}{Operation}Handler`
  - Examples: `FileReadHandler`, `FileWriteHandler`
- **Subscription interface:** `{Feature}Subscription`
  - Example: `FileSystemSubscription`
- **Manager classes:** `{Feature}SubscriptionManager`
  - Example: `FileSystemSubscriptionManager`

### Methods
- **Subscription methods on controller:** `subscribeTo{Feature}{Operation}`
  - Examples: `subscribeToFileReads()`, `subscribeToFileWrites()`
- **Manager getter methods:** `get{Operation}Handlers()`
  - Examples: `getReadHandlers()`, `getWriteHandlers()`

### Events (SessionController.on)
- Event names use camelCase, descriptive: `"statusChange"`, `"sessionUpdate"`, `"traffic"`, `"error"`, `"sessionClearing"`, `"permissionRequest"`, `"configOptionsChange"`

---

## 3. Feature Structure Pattern (filesystem as precedent)

The filesystem feature demonstrates the full pattern for adding a new capability:

### Step 1: Define types (`src/filesystem/types.ts`)
```typescript
export interface FileReadRequest {
  path: string;
  line?: number;
  limit?: number;
}

export interface FileReadResponse {
  content: string;
}

export type FileReadHandler = (request: FileReadRequest) => Promise<FileReadResponse | null>;

export interface FileSystemSubscription {
  unsubscribe(): void;
}
```

### Step 2: Create subscription manager (`src/filesystem/subscription-manager.ts`)
```typescript
import type { FileReadHandler, FileWriteHandler, FileSystemSubscription } from "./types.js";

export class FileSystemSubscriptionManager {
  private readHandlers: Map<string, FileReadHandler> = new Map();
  private writeHandlers: Map<string, FileWriteHandler> = new Map();
  private subscriptionCounter = 0;

  subscribeToFileReads(handler: FileReadHandler): FileSystemSubscription {
    const id = `read-${this.subscriptionCounter++}`;
    this.readHandlers.set(id, handler);
    return {
      unsubscribe: () => { this.readHandlers.delete(id); },
    };
  }

  getReadHandlers(): FileReadHandler[] {
    return Array.from(this.readHandlers.values());
  }
}
```

### Step 3: Integrate into SessionController (`src/session/controller.ts`)
- Import types and manager
- Instantiate manager in constructor
- Add public `subscribeTo*` delegation methods
- Add method handlers in `handleAcpPayload()` for incoming requests
- Add validation, error response, and success response patterns

### Step 4: Export from root index (`src/index.ts`)
```typescript
// Filesystem types
export type {
  FileReadRequest,
  FileReadResponse,
  FileWriteRequest,
  FileWriteResponse,
  FileReadHandler,
  FileWriteHandler,
  FileSystemSubscription,
} from "./filesystem/types.js";

export { FileSystemSubscriptionManager } from "./filesystem/subscription-manager.js";
```

---

## 4. Error Handling Patterns

### sendJsonRpcErrorResponse (controller.ts:521-529)
```typescript
private async sendJsonRpcErrorResponse(requestId: number, error: { code: number; message: string }): Promise<void> {
  const payload = {
    jsonrpc: "2.0" as const,
    id: requestId,
    error,
  };
  this.emitTraffic("out", payload);
  console.warn("sendJsonRpcErrorResponse: Transport interface doesn't support raw JSON sending yet");
}
```

### JSON-RPC Error Codes Used
| Code | Meaning | Usage |
|------|---------|-------|
| `-32600` | Invalid Request | General protocol errors |
| `-32601` | Method Not Found | No handlers available for the operation |
| `-32602` | Invalid Params | Missing or invalid required parameters |
| `-32000` | Server Error | Operation failed (handler returned null/error) |

### Error Response Flow
1. Validate request ID exists and is a number → emit error if not
2. Validate required params exist → send `-32602` error if not
3. Check if handlers are registered → send `-32601` error if not
4. Execute handlers with `Promise.allSettled()` → send `-32000` if all fail
5. On success → send response via `sendJsonRpcResponse()`

### sendJsonRpcResponse (controller.ts:531-539)
```typescript
private async sendJsonRpcResponse(requestId: number, result: FileReadResponse | FileWriteResponse): Promise<void> {
  const payload = {
    jsonrpc: "2.0" as const,
    id: requestId,
    result,
  };
  this.emitTraffic("out", payload);
  console.warn("sendJsonRpcResponse: Transport interface doesn't support raw JSON sending yet");
}
```

**Note:** Both methods emit traffic but log a console.warn because the Transport interface doesn't currently support sending raw JSON-RPC payloads. This is a known limitation — future work should extend the Transport interface.

---

## 5. Test Patterns

### Test Framework
- **Vitest** (`vitest ^2.1.0`) with `globals: true`
- Test files: `*.test.ts` co-located with source or in `src/__tests__/`
- Pattern: `src/session/session-controller.test.ts`, `src/__tests__/filesystem-subscription.test.ts`

### Standard Test Structure
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionController } from "./controller.js";
import { MockTransport } from "../test-utils/mocks.js";

describe("SessionController", () => {
  let controller: SessionController;
  let mockTransport: MockTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport = new MockTransport();
    controller = new SessionController(mockTransport, 30000);
  });

  // Helper functions for test convenience
  function getMockTransport(): MockTransport {
    return mockTransport;
  }

  function emitNotification(notification: any) {
    getMockTransport().emitNotification(notification);
  }
```

### Testing Incoming Agent Requests (filesystem pattern)
```typescript
it("handleFileReadRequest calls subscribed handler and sends response", async () => {
  const handler = vi.fn().mockResolvedValue({ content: "file content" });
  const trafficHandler = vi.fn();
  controller.on("traffic", trafficHandler);
  controller.subscribeToFileReads(handler);

  emitNotification({
    jsonrpc: "2.0",
    id: 1,
    method: "fs/read_text_file",
    params: { path: "test.txt" }
  });

  await vi.waitFor(() => {
    expect(handler).toHaveBeenCalledWith({ path: "test.txt" });
    const responses = trafficHandler.mock.calls.filter(
      (c: any) => c[0] === "out" && c[1].result
    );
    expect(responses.length).toBeGreaterThan(0);
  });
});
```

### Testing Validation/Error Cases
```typescript
it("handleFileReadRequest validates path and rejects paths with ..", async () => {
  const trafficHandler = vi.fn();
  controller.on("traffic", trafficHandler);
  const handler = vi.fn().mockResolvedValue({ content: "test" });
  controller.subscribeToFileReads(handler);

  emitNotification({
    jsonrpc: "2.0",
    id: 1,
    method: "fs/read_text_file",
    params: { path: "../etc/passwd" }
  });

  await vi.waitFor(() => {
    const errors = trafficHandler.mock.calls.filter(
      (c: any) => c[0] === "out" && c[1].error
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

### Testing Subscription Manager (standalone)
```typescript
import { FileSystemSubscriptionManager } from "../filesystem/subscription-manager.js";

describe("FileSystemSubscriptionManager", () => {
  it("should subscribe single handler", () => {
    const manager = new FileSystemSubscriptionManager();
    const handler = async () => null;
    const subscription = manager.subscribeToFileReads(handler);
    expect(subscription.unsubscribe).toBeDefined();
    expect(typeof subscription.unsubscribe).toBe("function");
  });
  // ... more tests for unsubscribe, multiple handlers, copies, etc.
});
```

### Key Test Utilities
- `MockTransport` — implements Transport interface, supports custom request handler
- `mockTransport.emitNotification()` — simulates incoming agent notifications
- `mockTransport.setStatus()` — simulates connection status changes
- `mockTransport.lastSent` — captures last sent data as JSON string
- `vi.waitFor()` — for async operations that require waiting for traffic emissions
- `vi.fn().mockResolvedValue()` — for mocking async handler responses

---

## 6. Export Patterns

### Barrel Index Files
Each module directory has an `index.ts` that re-exports from its source files:

```typescript
// protocol/index.ts
export {
  type ACPMethod,
  type ACPUpdateType,
  type ACPRequest,
  // ...
  isSessionUpdateNotification,
  isUpdateType,
} from './types.js';
```

### Root Index (src/index.ts)
The root barrel exports everything the package consumer needs:
- Uses `export type { ... }` for type-only exports
- Uses `export { ... }` for value/class exports
- Organized by feature domain with section comments
- Uses `.js` extension in import paths (ES module convention for TypeScript)

### Terminal exports should follow:
```typescript
// In src/index.ts
export type {
  TerminalCreateRequest,
  TerminalCreateResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  TerminalCreateHandler,
  TerminalOutputHandler,
  TerminalSubscription,
} from "./terminals/types.js";

export { TerminalSubscriptionManager } from "./terminals/subscription-manager.js";
```

---

## 7. Event Handler Pattern (SessionController.on)

### Type-safe overloaded `on()` method
```typescript
on(event: "statusChange", handler: StatusHandler): () => void;
on(event: "sessionUpdate", handler: SessionUpdateHandler): () => void;
on(event: "traffic", handler: TrafficHandler): () => void;
on(event: "error", handler: ErrorHandler): () => void;
// ... more overloads
on(event: "statusChange" | "sessionUpdate" | ..., handler: unknown): () => void {
  switch (event) {
    case "statusChange":
      this.statusHandlers.add(handler as StatusHandler);
      return () => this.statusHandlers.delete(handler as StatusHandler);
    // ... more cases
  }
}
```

### Handler type aliases (private)
```typescript
type StatusHandler = (state: SessionControllerState) => void;
type SessionUpdateHandler = (params: unknown) => void;
type TrafficHandler = (direction: "in" | "out", data: unknown) => void;
type ErrorHandler = (error: Error) => void;
```

### Private emit methods
```typescript
private emitStatusChange(): void {
  this.statusHandlers.forEach((h) => { h(this.getState()); });
}
```

### Storage
Each event type gets its own `Set<HandlerType>` as a private class field:
```typescript
private statusHandlers = new Set<StatusHandler>();
private sessionUpdateHandlers = new Set<SessionUpdateHandler>();
```

---

## 8. Subscription/Manager Pattern (FileSystemSubscriptionManager)

### Key Design Decisions
1. **Map-based storage** with string keys — enables O(1) lookup and clean deletion
2. **Auto-incrementing counter** for unique subscription IDs
3. **Return a `Subscription` object** with `unsubscribe()` method — not just a function
4. **`get*Handlers()` returns a copy** (`Array.from()`) — prevents external mutation
5. **Multiple handlers supported** — `Promise.allSettled()` to run all, take first successful result

### Manager Pattern Applied to SessionController
- SessionController owns a single `FileSystemSubscriptionManager` instance
- SessionController exposes `subscribeToFileReads()` / `subscribeToFileWrites()` as public delegation methods
- Handler execution happens in the private `handleFileReadRequest()` / `handleFileWriteRequest()` methods

### Pattern for Terminals
```typescript
// TerminalSubscriptionManager would have:
// - subscribeToTerminalCreate(handler): TerminalSubscription
// - subscribeToTerminalOutput(handler): TerminalSubscription
// - subscribeToKillTerminal(handler): TerminalSubscription
// - subscribeToReleaseTerminal(handler): TerminalSubscription
// - getCreateHandlers(), getOutputHandlers(), etc.
```

---

## 9. ACP Method Names Already Defined

The `ACPMethod` type in `src/protocol/types.ts` already includes terminal methods:
```typescript
export type ACPMethod =
  // ...
  // Terminal methods (if capability enabled)
  | "terminal/create"
  | "terminal/kill"
  | "terminal/output"
  | "terminal/release"
  | "terminal/wait_for_exit";
```

The ACP SDK types are also already imported:
```typescript
// From @agentclientprotocol/sdk:
CreateTerminalRequest, CreateTerminalResponse,
KillTerminalRequest, KillTerminalResponse,
TerminalOutputRequest, TerminalOutputResponse,
ReleaseTerminalRequest, ReleaseTerminalResponse,
WaitForTerminalExitRequest, WaitForTerminalExitResponse,
```

These are re-exported from `protocol/types.ts` but NOT used anywhere yet in the controller.

---

## 10. Incoming Request Handling Flow (handleAcpPayload)

When the SessionController receives an ACP notification/request from the agent:

1. **Validate payload** — must be non-null object with `id` or `method`
2. **Check for method-based notifications** (JSON-RPC requests from agent):
   - `session/update` → emit session updates
   - `session/request_permission` → emit permission request
   - `fs/read_text_file` → route to `handleFileReadRequest()`
   - `fs/write_text_file` → route to `handleFileWriteRequest()`
   - **Terminal methods would be added here** (e.g., `terminal/create`, `terminal/output`, etc.)
3. **Check for id-based responses** — resolve pending requests

Each handler method (like `handleFileReadRequest`):
1. Validates the request ID
2. Validates required params
3. Calls subscribed handlers
4. Sends JSON-RPC response or error

---

## Summary for Terminal Feature Implementation

To add terminals capability, follow the filesystem pattern exactly:

1. **Create `src/terminals/types.ts`** — define TerminalRequest/Response interfaces, Handler types, TerminalSubscription interface
2. **Create `src/terminals/subscription-manager.ts`** — implement TerminalSubscriptionManager with subscribe/getHandlers pattern
3. **Modify `src/session/controller.ts`**:
   - Import terminal types and manager
   - Instantiate `TerminalSubscriptionManager` in constructor
   - Add `subscribeToTerminalCreate()`, `subscribeToTerminalOutput()`, etc. delegation methods
   - Add terminal method handling in `handleAcpPayload()` (switch on `terminal/create`, `terminal/output`, etc.)
   - Add `handleTerminalCreateRequest()`, `handleTerminalOutputRequest()`, etc. private methods
4. **Modify `src/index.ts`** — export terminal types and manager class
5. **Add tests**:
   - `src/__tests__/terminal-subscription.test.ts` — standalone manager tests
   - Add terminal test cases to `src/session/session-controller.test.ts`
6. **Consider extending `Transport` interface** to support raw JSON-RPC response sending (currently both `sendJsonRpcResponse` and `sendJsonRpcErrorResponse` log console.warns)
