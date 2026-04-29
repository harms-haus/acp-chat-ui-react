# ACP Terminals Capability — Detailed Implementation Plan

**Date:** 2026-04-28
**Scope:** Add terminals capability to acp-chat-core following the ACP standard
**Working Dir:** /root/acp-chat-ui-react
**Branch:** main (no worktree)
**User Decisions:** Wire up only `terminal: boolean` in initialize, fix Transport interface for raw JSON-RPC responses, test-after strategy, single commit at end

---

## Pre-flight Verification

Before starting, run:

```bash
cd /root/acp-chat-ui-react/packages/acp-chat-core
npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected output: `Test Files  X passed (X)` with 0 failures.

---

## Task 1: Define Terminal Handler Types and Subscription Interface

**File:** `packages/acp-chat-core/src/terminals/types.ts` (NEW)

Create handler type aliases wrapping the existing SDK types from `@agentclientprotocol/sdk` (already re-exported in `protocol/types.ts`), plus a `TerminalSubscription` interface. This follows the exact pattern of `src/filesystem/types.ts`.

### Complete file content:

```typescript
/**
 * Terminal types and interfaces for ACP terminal event handling.
 *
 * Request/Response types are re-exported from @agentclientprotocol/sdk
 * via protocol/types.ts. This file defines handler function type aliases
 * and the subscription interface that wrap the SDK types into the handler
 * pattern used by this codebase.
 *
 * @see https://agentclientprotocol.com/protocol/terminals
 */

import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
} from "../protocol/types.js";

export type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
} from "../protocol/types.js";

/**
 * Handler for terminal/create requests from the agent.
 * The handler should create a terminal and return its terminalId.
 */
export type TerminalCreateHandler = (
  request: CreateTerminalRequest,
) => Promise<CreateTerminalResponse | null>;

/**
 * Handler for terminal/output requests from the agent.
 * The handler should return the terminal's buffered output.
 */
export type TerminalOutputHandler = (
  request: TerminalOutputRequest,
) => Promise<TerminalOutputResponse | null>;

/**
 * Handler for terminal/wait_for_exit requests from the agent.
 * The handler should wait for the terminal to exit and return the exit status.
 */
export type TerminalWaitForExitHandler = (
  request: WaitForTerminalExitRequest,
) => Promise<WaitForTerminalExitResponse | null>;

/**
 * Handler for terminal/kill requests from the agent.
 * The handler should terminate the terminal process.
 */
export type TerminalKillHandler = (
  request: KillTerminalRequest,
) => Promise<KillTerminalResponse | null>;

/**
 * Handler for terminal/release requests from the agent.
 * The handler should clean up terminal resources.
 */
export type TerminalReleaseHandler = (
  request: ReleaseTerminalRequest,
) => Promise<ReleaseTerminalResponse | null>;

/**
 * Subscription object returned when subscribing to a terminal operation.
 * Call unsubscribe() to remove the handler.
 */
export interface TerminalSubscription {
  unsubscribe(): void;
}
```

**Key decisions:**
- Re-export SDK types with `export type { ... } from "../protocol/types.js"` — no duplication, single source of truth
- Each handler returns `Promise<ResponseType | null>` — matches filesystem pattern exactly
- `TerminalSubscription` interface matches `FileSystemSubscription` interface exactly

**Verification:**
```bash
cd /root/acp-chat-ui-react/packages/acp-chat-core
npx tsc --noEmit src/terminals/types.ts 2>&1
```
Expected: no errors.

---

## Task 2: Implement TerminalSubscriptionManager

**File:** `packages/acp-chat-core/src/terminals/subscription-manager.ts` (NEW)

Build the `TerminalSubscriptionManager` class following the exact pattern of `FileSystemSubscriptionManager`: Map-based storage, auto-incrementing IDs, subscription-return objects, and copy-returning getters.

### Complete file content:

```typescript
import type {
  TerminalCreateHandler,
  TerminalOutputHandler,
  TerminalWaitForExitHandler,
  TerminalKillHandler,
  TerminalReleaseHandler,
  TerminalSubscription,
} from "./types.js";

export class TerminalSubscriptionManager {
  private createHandlers: Map<string, TerminalCreateHandler> = new Map();
  private outputHandlers: Map<string, TerminalOutputHandler> = new Map();
  private waitForExitHandlers: Map<string, TerminalWaitForExitHandler> = new Map();
  private killHandlers: Map<string, TerminalKillHandler> = new Map();
  private releaseHandlers: Map<string, TerminalReleaseHandler> = new Map();
  private subscriptionCounter = 0;

  subscribeToCreate(handler: TerminalCreateHandler): TerminalSubscription {
    const id = `create-${this.subscriptionCounter++}`;
    this.createHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.createHandlers.delete(id);
      },
    };
  }

  subscribeToOutput(handler: TerminalOutputHandler): TerminalSubscription {
    const id = `output-${this.subscriptionCounter++}`;
    this.outputHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.outputHandlers.delete(id);
      },
    };
  }

  subscribeToWaitForExit(
    handler: TerminalWaitForExitHandler,
  ): TerminalSubscription {
    const id = `waitForExit-${this.subscriptionCounter++}`;
    this.waitForExitHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.waitForExitHandlers.delete(id);
      },
    };
  }

  subscribeToKill(handler: TerminalKillHandler): TerminalSubscription {
    const id = `kill-${this.subscriptionCounter++}`;
    this.killHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.killHandlers.delete(id);
      },
    };
  }

  subscribeToRelease(handler: TerminalReleaseHandler): TerminalSubscription {
    const id = `release-${this.subscriptionCounter++}`;
    this.releaseHandlers.set(id, handler);
    return {
      unsubscribe: () => {
        this.releaseHandlers.delete(id);
      },
    };
  }

  getCreateHandlers(): TerminalCreateHandler[] {
    return Array.from(this.createHandlers.values());
  }

  getOutputHandlers(): TerminalOutputHandler[] {
    return Array.from(this.outputHandlers.values());
  }

  getWaitForExitHandlers(): TerminalWaitForExitHandler[] {
    return Array.from(this.waitForExitHandlers.values());
  }

  getKillHandlers(): TerminalKillHandler[] {
    return Array.from(this.killHandlers.values());
  }

  getReleaseHandlers(): TerminalReleaseHandler[] {
    return Array.from(this.releaseHandlers.values());
  }
}
```

**Key decisions:**
- Five separate Maps, one per terminal operation — follows the filesystem precedent of separate Maps for read/write
- ID prefixes: `create-`, `output-`, `waitForExit-`, `kill-`, `release-` — descriptive, matches method names
- Shared `subscriptionCounter` across all handler types — ensures globally unique IDs (same as FileSystemSubscriptionManager)
- All `get*Handlers()` return `Array.from(...values())` — defensive copy, prevents external mutation

**Verification:**
```bash
cd /root/acp-chat-ui-react/packages/acp-chat-core
npx tsc --noEmit src/terminals/subscription-manager.ts 2>&1
```
Expected: no errors.

---

## Task 3: Fix Transport Interface for Raw JSON-RPC Response Sending

This task has two parts: extend the Transport interface, then update the SessionController's `sendJsonRpcResponse` and `sendJsonRpcErrorResponse` to use it.

### 3A: Extend the Transport Interface

**File:** `packages/acp-chat-core/src/transport/transport-interface.ts` (MODIFY)

Add a new method `sendRawResponse` to the Transport interface. Insert it after `sendResponse` (line 159), before the closing `}`.

**Change:** After line 159 (`sendResponse<T = unknown>(response: ACPResponse<T>): void;`), add:

```typescript

  /**
   * Send a raw JSON-RPC response or error object.
   *
   * This is used for responding to agent-initiated requests (e.g.,
   * filesystem operations, terminal operations) where the response
   * must be a raw JSON-RPC object with jsonrpc, id, and result/error fields.
   *
   * @param payload - Raw JSON-RPC response/error object to send
   */
  sendRawResponse(payload: Record<string, unknown>): void;
```

**Complete modified section** (lines 150-175 of the original file, now with the addition):

```typescript
  /**
   * Send an ACP response (for permission requests, etc.).
   *
   * Responses are sent to acknowledge requests that require a response
   * (e.g., permission requests, file operations).
   *
   * @param response - ACP response object
   */
  sendResponse<T = unknown>(response: ACPResponse<T>): void;

  /**
   * Send a raw JSON-RPC response or error object.
   *
   * This is used for responding to agent-initiated requests (e.g.,
   * filesystem operations, terminal operations) where the response
   * must be a raw JSON-RPC object with jsonrpc, id, and result/error fields.
   *
   * @param payload - Raw JSON-RPC response/error object to send
   */
  sendRawResponse(payload: Record<string, unknown>): void;
}

/**
 * Type guard to check if a status is terminal (won't recover automatically).
 */
export function isTerminalStatus(status: ConnectionStatus): boolean {
  return status === 'disconnected' || status === 'error';
}
```

### 3B: Update SessionController to use the new transport method

**File:** `packages/acp-chat-core/src/session/controller.ts` (MODIFY)

Replace the two broken `sendJsonRpc*` methods. These are currently at lines 521-539.

**Replace** the old `sendJsonRpcErrorResponse` (lines 521-529):

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

**With:**

```typescript
  private async sendJsonRpcErrorResponse(requestId: number, error: { code: number; message: string }): Promise<void> {
    const payload = {
      jsonrpc: "2.0" as const,
      id: requestId,
      error,
    };
    this.emitTraffic("out", payload);
    this.transport.sendRawResponse(payload);
  }
```

**Replace** the old `sendJsonRpcResponse` (lines 531-539):

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

**With** — also broaden the result type to `unknown` since terminal handlers will use different response shapes:

```typescript
  private async sendJsonRpcResponse(requestId: number, result: unknown): Promise<void> {
    const payload = {
      jsonrpc: "2.0" as const,
      id: requestId,
      result,
    };
    this.emitTraffic("out", payload);
    this.transport.sendRawResponse(payload);
  }
```

### 3C: Update MockTransport in test-utils

**File:** `packages/acp-chat-core/src/test-utils/mocks.ts` (MODIFY)

Add `sendRawResponse` to `MockTransport`. Insert after the existing `sendResponse` method (after line 69).

**Add after line 69** (`sendResponse<T = unknown>(response: ACPResponse<T>): void { ... }`):

```typescript

 sendRawResponse(payload: Record<string, unknown>): void {
  this.lastSent = JSON.stringify(payload);
 }
```

**Verification:**
```bash
cd /root/acp-chat-ui-react/packages/acp-chat-core
npx tsc --noEmit 2>&1
```
Expected: no errors. All existing tests should still pass:
```bash
npx vitest run 2>&1 | tail -10
```

---

## Task 4: Integrate Terminals into SessionController

**File:** `packages/acp-chat-core/src/session/controller.ts` (MODIFY — multiple changes)

This is the largest task. It has 5 sub-steps.

### 4A: Add imports for terminal types and manager

**At the top of controller.ts**, after the existing filesystem imports (line 11), add:

```typescript
import { TerminalSubscriptionManager } from "../terminals/subscription-manager.js";
import type {
  TerminalCreateHandler,
  TerminalOutputHandler,
  TerminalWaitForExitHandler,
  TerminalKillHandler,
  TerminalReleaseHandler,
  TerminalSubscription,
  CreateTerminalRequest,
  TerminalOutputRequest,
  WaitForTerminalExitRequest,
  KillTerminalRequest,
  ReleaseTerminalRequest,
} from "../terminals/types.js";
import type { ClientCapabilities } from "../protocol/types.js";
```

The updated import block at the top of the file should look like:

```typescript
import type { Transport, ConnectionStatus } from "../transport/transport-interface.js";
import { FileSystemSubscriptionManager } from "../filesystem/subscription-manager.js";
import { TerminalSubscriptionManager } from "../terminals/subscription-manager.js";
import type {
  FileReadRequest,
  FileReadResponse,
  FileWriteRequest,
  FileWriteResponse,
  FileReadHandler,
  FileWriteHandler,
  FileSystemSubscription,
} from "../filesystem/types.js";
import type {
  TerminalCreateHandler,
  TerminalOutputHandler,
  TerminalWaitForExitHandler,
  TerminalKillHandler,
  TerminalReleaseHandler,
  TerminalSubscription,
  CreateTerminalRequest,
  TerminalOutputRequest,
  WaitForTerminalExitRequest,
  KillTerminalRequest,
  ReleaseTerminalRequest,
} from "../terminals/types.js";
import type { ClientCapabilities } from "../protocol/types.js";
import type { ACPNotification, ACPResponse } from "../protocol/types.js";
```

### 4B: Add TerminalSubscriptionManager field and initialize in constructor

**Add a private field** after `fileSystemManager` (line 86):

```typescript
 private fileSystemManager: FileSystemSubscriptionManager;
 private terminalManager: TerminalSubscriptionManager;
```

**Initialize in constructor** after `this.fileSystemManager = new FileSystemSubscriptionManager();` (line 105):

```typescript
   this.fileSystemManager = new FileSystemSubscriptionManager();
   this.terminalManager = new TerminalSubscriptionManager();
```

### 4C: Add public subscribe-to-terminal delegation methods

Add these five public methods after the existing filesystem subscription methods (after line 341, `subscribeToFileWrites`):

```typescript
  public subscribeToTerminalCreate(handler: TerminalCreateHandler): TerminalSubscription {
    return this.terminalManager.subscribeToCreate(handler);
  }

  public subscribeToTerminalOutput(handler: TerminalOutputHandler): TerminalSubscription {
    return this.terminalManager.subscribeToOutput(handler);
  }

  public subscribeToTerminalWaitForExit(handler: TerminalWaitForExitHandler): TerminalSubscription {
    return this.terminalManager.subscribeToWaitForExit(handler);
  }

  public subscribeToTerminalKill(handler: TerminalKillHandler): TerminalSubscription {
    return this.terminalManager.subscribeToKill(handler);
  }

  public subscribeToTerminalRelease(handler: TerminalReleaseHandler): TerminalSubscription {
    return this.terminalManager.subscribeToRelease(handler);
  }
```

### 4D: Update initialize() to accept `terminal: boolean` option

**Replace** the current `initialize` method (lines 191-202):

```typescript
  async initialize(clientInfo?: { name: string; version: string }): Promise<unknown> {
    const params = {
      protocolVersion: 1,
      clientCapabilities: {},
      ...(clientInfo ? { clientInfo } : {}),
    };
    const result = await this.sendRequest("initialize", params);
    this.state.initialized = true;
    this.state.capabilities = result;
    this.emitStatusChange();
    return result;
  }
```

**With:**

```typescript
  async initialize(options?: {
    clientInfo?: { name: string; version: string };
    clientCapabilities?: ClientCapabilities;
  }): Promise<unknown> {
    const clientCapabilities: ClientCapabilities = options?.clientCapabilities ?? {};
    const params = {
      protocolVersion: 1,
      clientCapabilities,
      ...(options?.clientInfo ? { clientInfo: options.clientInfo } : {}),
    };
    const result = await this.sendRequest("initialize", params);
    this.state.initialized = true;
    this.state.capabilities = result;
    this.emitStatusChange();
    return result;
  }
```

**Key decision from notes.md:** Wire up only `terminal: boolean` — this means consumers will pass `{ terminal: true }` inside the `clientCapabilities` object. We do NOT build a dedicated `InitializeOptions` interface that wraps everything; we simply accept an options object with `clientInfo` and `clientCapabilities`. The `ClientCapabilities` type comes from the SDK and already has `terminal?: boolean`.

**Backward compatibility note:** The old signature was `initialize(clientInfo?: { name: string; version: string })`. The new signature is `initialize(options?: { clientInfo?; clientCapabilities? })`. Any existing caller passing `{ name, version }` directly will get a type error. Callers must be updated to:
```typescript
// Old:
await controller.initialize({ name: "app", version: "1.0" });
// New:
await controller.initialize({ clientInfo: { name: "app", version: "1.0" } });
```

This is an intentional breaking change — it's a pre-release package (0.0.1).

### 4E: Add terminal method dispatch branches in handleAcpPayload

Add five `else if` branches inside the method-based dispatch section, after the `fs/write_text_file` block (after line 410). Insert before the comment `// Don't return - let JSON-RPC responses also be processed...`:

```typescript
      } else if (obj.method === "terminal/create") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/create: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.command !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: command required" });
          return;
        }
        this.handleTerminalCreateRequest(requestId, params);
      } else if (obj.method === "terminal/output") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/output: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.sessionId !== "string" || typeof params.terminalId !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: sessionId and terminalId required" });
          return;
        }
        this.handleTerminalOutputRequest(requestId, params);
      } else if (obj.method === "terminal/wait_for_exit") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/wait_for_exit: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.sessionId !== "string" || typeof params.terminalId !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: sessionId and terminalId required" });
          return;
        }
        this.handleTerminalWaitForExitRequest(requestId, params);
      } else if (obj.method === "terminal/kill") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/kill: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.sessionId !== "string" || typeof params.terminalId !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: sessionId and terminalId required" });
          return;
        }
        this.handleTerminalKillRequest(requestId, params);
      } else if (obj.method === "terminal/release") {
        const requestId = obj.id as number | undefined;
        const params = obj.params as Record<string, unknown> | undefined;
        if (typeof requestId !== "number") {
          this.emitError(new Error("terminal/release: missing or invalid request id"));
          return;
        }
        if (!params || typeof params.sessionId !== "string" || typeof params.terminalId !== "string") {
          this.sendJsonRpcErrorResponse(requestId, { code: -32602, message: "Invalid params: sessionId and terminalId required" });
          return;
        }
        this.handleTerminalReleaseRequest(requestId, params);
      }
```

### 4F: Add private terminal handler methods

Add these five private async methods at the end of the class, after `handleFileWriteRequest` (after line 519) and before `sendJsonRpcErrorResponse`. The pattern exactly follows `handleFileReadRequest` / `handleFileWriteRequest`:

```typescript
  private async handleTerminalCreateRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: CreateTerminalRequest = {
      command: params.command as string,
    };
    if (Array.isArray(params.args)) {
      request.args = params.args as string[];
    }
    if (Array.isArray(params.env)) {
      request.env = params.env as Array<[string, string]>;
    }
    if (typeof params.cwd === "string") {
      request.cwd = params.cwd;
    }
    if (typeof params.outputByteLimit === "number") {
      request.outputByteLimit = params.outputByteLimit;
    }

    const handlers = this.terminalManager.getCreateHandlers();
    if (handlers.length === 0) {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32601,
        message: "No terminal create handlers available",
      });
      return;
    }

    const results = await Promise.allSettled(handlers.map((h) => h(request)));
    const successful = results.find(
      (r) => r.status === "fulfilled" && r.value !== null,
    ) as PromiseFulfilledResult<CreateTerminalResponse> | undefined;

    if (successful) {
      await this.sendJsonRpcResponse(requestId, successful.value);
    } else {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32000,
        message: "Failed to create terminal",
      });
    }
  }

  private async handleTerminalOutputRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: TerminalOutputRequest = {
      sessionId: params.sessionId as string,
      terminalId: params.terminalId as string,
    };

    const handlers = this.terminalManager.getOutputHandlers();
    if (handlers.length === 0) {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32601,
        message: "No terminal output handlers available",
      });
      return;
    }

    const results = await Promise.allSettled(handlers.map((h) => h(request)));
    const successful = results.find(
      (r) => r.status === "fulfilled" && r.value !== null,
    ) as PromiseFulfilledResult<TerminalOutputResponse> | undefined;

    if (successful) {
      await this.sendJsonRpcResponse(requestId, successful.value);
    } else {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32000,
        message: "Failed to get terminal output",
      });
    }
  }

  private async handleTerminalWaitForExitRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: WaitForTerminalExitRequest = {
      sessionId: params.sessionId as string,
      terminalId: params.terminalId as string,
    };

    const handlers = this.terminalManager.getWaitForExitHandlers();
    if (handlers.length === 0) {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32601,
        message: "No terminal wait_for_exit handlers available",
      });
      return;
    }

    const results = await Promise.allSettled(handlers.map((h) => h(request)));
    const successful = results.find(
      (r) => r.status === "fulfilled" && r.value !== null,
    ) as PromiseFulfilledResult<WaitForTerminalExitResponse> | undefined;

    if (successful) {
      await this.sendJsonRpcResponse(requestId, successful.value);
    } else {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32000,
        message: "Failed to wait for terminal exit",
      });
    }
  }

  private async handleTerminalKillRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: KillTerminalRequest = {
      sessionId: params.sessionId as string,
      terminalId: params.terminalId as string,
    };

    const handlers = this.terminalManager.getKillHandlers();
    if (handlers.length === 0) {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32601,
        message: "No terminal kill handlers available",
      });
      return;
    }

    const results = await Promise.allSettled(handlers.map((h) => h(request)));
    const successful = results.find(
      (r) => r.status === "fulfilled" && r.value !== null,
    ) as PromiseFulfilledResult<KillTerminalResponse> | undefined;

    if (successful) {
      await this.sendJsonRpcResponse(requestId, successful.value);
    } else {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32000,
        message: "Failed to kill terminal",
      });
    }
  }

  private async handleTerminalReleaseRequest(
    requestId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const request: ReleaseTerminalRequest = {
      sessionId: params.sessionId as string,
      terminalId: params.terminalId as string,
    };

    const handlers = this.terminalManager.getReleaseHandlers();
    if (handlers.length === 0) {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32601,
        message: "No terminal release handlers available",
      });
      return;
    }

    const results = await Promise.allSettled(handlers.map((h) => h(request)));
    const successful = results.find(
      (r) => r.status === "fulfilled" && r.value !== null,
    ) as PromiseFulfilledResult<ReleaseTerminalResponse> | undefined;

    if (successful) {
      await this.sendJsonRpcResponse(requestId, successful.value);
    } else {
      this.sendJsonRpcErrorResponse(requestId, {
        code: -32000,
        message: "Failed to release terminal",
      });
    }
  }
```

**Validation logic summary for each terminal method:**

| Method | Required params | Validation |
|--------|----------------|------------|
| `terminal/create` | `command` (string) | Check `params.command` is string; optional: `args`, `env`, `cwd`, `outputByteLimit` |
| `terminal/output` | `sessionId` (string), `terminalId` (string) | Both must be strings |
| `terminal/wait_for_exit` | `sessionId` (string), `terminalId` (string) | Both must be strings |
| `terminal/kill` | `sessionId` (string), `terminalId` (string) | Both must be strings |
| `terminal/release` | `sessionId` (string), `terminalId` (string) | Both must be strings |

Note: `terminal/create` does NOT validate `sessionId` because the ACP SDK `CreateTerminalRequest` type does not include `sessionId` — it only has `command`, `args?`, `env?`, `cwd?`, `outputByteLimit?`. The session context is implicit from the ACP session. All other terminal operations DO require `sessionId` and `terminalId`.

**Verification:**
```bash
cd /root/acp-chat-ui-react/packages/acp-chat-core
npx tsc --noEmit 2>&1
```
Expected: no errors.
```bash
npx vitest run 2>&1 | tail -10
```
Expected: all existing tests pass.

---

## Task 5: Write Terminal Tests

**Strategy:** Test-after — all implementation code is complete before these are written.

### 5A: Standalone manager tests

**File:** `packages/acp-chat-core/src/__tests__/terminal-subscription.test.ts` (NEW)

```typescript
import { describe, it, expect } from "vitest";
import { TerminalSubscriptionManager } from "../terminals/subscription-manager.js";

describe("TerminalSubscriptionManager", () => {
  it("should subscribe single create handler", () => {
    const manager = new TerminalSubscriptionManager();
    const handler = async () => null;
    const subscription = manager.subscribeToCreate(handler);

    expect(subscription.unsubscribe).toBeDefined();
    expect(typeof subscription.unsubscribe).toBe("function");
  });

  it("should subscribe multiple handlers across different operations", () => {
    const manager = new TerminalSubscriptionManager();
    const createHandler = async () => null;
    const outputHandler = async () => null;
    const killHandler = async () => null;

    manager.subscribeToCreate(createHandler);
    manager.subscribeToCreate(createHandler);
    manager.subscribeToOutput(outputHandler);
    manager.subscribeToKill(killHandler);

    expect(manager.getCreateHandlers()).toHaveLength(2);
    expect(manager.getOutputHandlers()).toHaveLength(1);
    expect(manager.getKillHandlers()).toHaveLength(1);
    expect(manager.getWaitForExitHandlers()).toHaveLength(0);
    expect(manager.getReleaseHandlers()).toHaveLength(0);
  });

  it("should unsubscribe removes correct handler", () => {
    const manager = new TerminalSubscriptionManager();
    const handler1 = async () => null;
    const handler2 = async () => null;
    const handler3 = async () => null;

    manager.subscribeToCreate(handler1);
    const sub2 = manager.subscribeToCreate(handler2);
    manager.subscribeToCreate(handler3);

    sub2.unsubscribe();

    const handlers = manager.getCreateHandlers();
    expect(handlers).toHaveLength(2);
    expect(handlers).toContain(handler1);
    expect(handlers).not.toContain(handler2);
    expect(handlers).toContain(handler3);
  });

  it("should unsubscribe twice is no-op", () => {
    const manager = new TerminalSubscriptionManager();
    const handler1 = async () => null;
    const handler2 = async () => null;

    const sub1 = manager.subscribeToCreate(handler1);
    manager.subscribeToCreate(handler2);

    sub1.unsubscribe();
    sub1.unsubscribe();

    expect(manager.getCreateHandlers()).toHaveLength(1);
    expect(manager.getCreateHandlers()).not.toContain(handler1);
    expect(manager.getCreateHandlers()).toContain(handler2);
  });

  it("should getHandlers returns copy (not reference)", () => {
    const manager = new TerminalSubscriptionManager();
    const handler = async () => null;

    manager.subscribeToCreate(handler);

    const handlers1 = manager.getCreateHandlers();
    const handlers2 = manager.getCreateHandlers();

    expect(handlers1).not.toBe(handlers2);

    handlers1.push(async () => null);

    expect(handlers1).toHaveLength(2);
    expect(handlers2).toHaveLength(1);
  });

  it("should handle all five operation types independently", () => {
    const manager = new TerminalSubscriptionManager();
    const h1 = async () => null;
    const h2 = async () => null;
    const h3 = async () => null;
    const h4 = async () => null;
    const h5 = async () => null;

    manager.subscribeToCreate(h1);
    manager.subscribeToOutput(h2);
    manager.subscribeToWaitForExit(h3);
    manager.subscribeToKill(h4);
    manager.subscribeToRelease(h5);

    expect(manager.getCreateHandlers()).toContain(h1);
    expect(manager.getOutputHandlers()).toContain(h2);
    expect(manager.getWaitForExitHandlers()).toContain(h3);
    expect(manager.getKillHandlers()).toContain(h4);
    expect(manager.getReleaseHandlers()).toContain(h5);

    // Unsubscribe one should not affect others
    const sub = manager.subscribeToOutput(async () => null);
    sub.unsubscribe();
    expect(manager.getOutputHandlers()).toHaveLength(1);
    expect(manager.getCreateHandlers()).toHaveLength(1);
  });

  it("should support multiple instances independently", () => {
    const manager1 = new TerminalSubscriptionManager();
    const manager2 = new TerminalSubscriptionManager();
    const handler = async () => null;

    manager1.subscribeToCreate(handler);
    manager2.subscribeToCreate(handler);

    expect(manager1.getCreateHandlers()).toHaveLength(1);
    expect(manager2.getCreateHandlers()).toHaveLength(1);
  });
});
```

### 5B: Integration tests in session-controller.test.ts

**File:** `packages/acp-chat-core/src/session/session-controller.test.ts` (MODIFY)

Add a new `describe` block at the end of the file, before the final `});` (before line 429). Insert a new `describe("terminal operations", ...)` block:

```typescript
  describe("terminal operations", () => {
    it("subscribeToTerminalCreate returns subscription", () => {
      const handler = vi.fn().mockResolvedValue({ terminalId: "term-1" });
      const subscription = controller.subscribeToTerminalCreate(handler);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("subscribeToTerminalOutput returns subscription", () => {
      const handler = vi.fn().mockResolvedValue({ output: "test output" });
      const subscription = controller.subscribeToTerminalOutput(handler);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("subscribeToTerminalWaitForExit returns subscription", () => {
      const handler = vi.fn().mockResolvedValue({ exitCode: 0 });
      const subscription = controller.subscribeToTerminalWaitForExit(handler);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("subscribeToTerminalKill returns subscription", () => {
      const handler = vi.fn().mockResolvedValue({});
      const subscription = controller.subscribeToTerminalKill(handler);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("subscribeToTerminalRelease returns subscription", () => {
      const handler = vi.fn().mockResolvedValue({});
      const subscription = controller.subscribeToTerminalRelease(handler);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("handleTerminalCreateRequest calls subscribed handler and sends response", async () => {
      const handler = vi.fn().mockResolvedValue({ terminalId: "term-123" });
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      controller.subscribeToTerminalCreate(handler);

      emitNotification({
        jsonrpc: "2.0",
        id: 1,
        method: "terminal/create",
        params: { command: "bash", args: ["-c", "echo hello"] },
      });

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith({
          command: "bash",
          args: ["-c", "echo hello"],
        });
        const responses = trafficHandler.mock.calls.filter(
          (c: any) => c[0] === "out" && c[1].result,
        );
        expect(responses.length).toBeGreaterThan(0);
        expect(responses[0][1].result).toEqual({ terminalId: "term-123" });
      });
    });

    it("handleTerminalCreateRequest validates command is required", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      const handler = vi.fn().mockResolvedValue({ terminalId: "term-1" });
      controller.subscribeToTerminalCreate(handler);

      emitNotification({
        jsonrpc: "2.0",
        id: 1,
        method: "terminal/create",
        params: {},
      });

      await vi.waitFor(() => {
        const errors = trafficHandler.mock.calls.filter(
          (c: any) => c[0] === "out" && c[1].error,
        );
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0][1].error.code).toBe(-32602);
      });
    });

    it("handleTerminalOutputRequest calls subscribed handler", async () => {
      const handler = vi.fn().mockResolvedValue({
        output: "hello world",
        truncated: false,
      });
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      controller.subscribeToTerminalOutput(handler);

      emitNotification({
        jsonrpc: "2.0",
        id: 2,
        method: "terminal/output",
        params: { sessionId: "sess-1", terminalId: "term-1" },
      });

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith({
          sessionId: "sess-1",
          terminalId: "term-1",
        });
        const responses = trafficHandler.mock.calls.filter(
          (c: any) => c[0] === "out" && c[1].result,
        );
        expect(responses.length).toBeGreaterThan(0);
      });
    });

    it("handleTerminalOutputRequest validates sessionId and terminalId", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      emitNotification({
        jsonrpc: "2.0",
        id: 2,
        method: "terminal/output",
        params: { sessionId: "sess-1" },
      });

      await vi.waitFor(() => {
        const errors = trafficHandler.mock.calls.filter(
          (c: any) => c[0] === "out" && c[1].error,
        );
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0][1].error.code).toBe(-32602);
      });
    });

    it("handleTerminalWaitForExitRequest calls subscribed handler", async () => {
      const handler = vi.fn().mockResolvedValue({ exitCode: 0 });
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      controller.subscribeToTerminalWaitForExit(handler);

      emitNotification({
        jsonrpc: "2.0",
        id: 3,
        method: "terminal/wait_for_exit",
        params: { sessionId: "sess-1", terminalId: "term-1" },
      });

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith({
          sessionId: "sess-1",
          terminalId: "term-1",
        });
      });
    });

    it("handleTerminalKillRequest calls subscribed handler", async () => {
      const handler = vi.fn().mockResolvedValue({});
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      controller.subscribeToTerminalKill(handler);

      emitNotification({
        jsonrpc: "2.0",
        id: 4,
        method: "terminal/kill",
        params: { sessionId: "sess-1", terminalId: "term-1" },
      });

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith({
          sessionId: "sess-1",
          terminalId: "term-1",
        });
      });
    });

    it("handleTerminalReleaseRequest calls subscribed handler", async () => {
      const handler = vi.fn().mockResolvedValue({});
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      controller.subscribeToTerminalRelease(handler);

      emitNotification({
        jsonrpc: "2.0",
        id: 5,
        method: "terminal/release",
        params: { sessionId: "sess-1", terminalId: "term-1" },
      });

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith({
          sessionId: "sess-1",
          terminalId: "term-1",
        });
      });
    });

    it("terminal methods return error when no handlers registered", async () => {
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      emitNotification({
        jsonrpc: "2.0",
        id: 1,
        method: "terminal/create",
        params: { command: "bash" },
      });

      await vi.waitFor(() => {
        const errors = trafficHandler.mock.calls.filter(
          (c: any) => c[0] === "out" && c[1].error,
        );
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0][1].error.code).toBe(-32601);
        expect(errors[0][1].error.message).toContain(
          "No terminal create handlers available",
        );
      });
    });

    it("terminal handlers returning null triggers error response", async () => {
      const handler = vi.fn().mockResolvedValue(null);
      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);
      controller.subscribeToTerminalCreate(handler);

      emitNotification({
        jsonrpc: "2.0",
        id: 1,
        method: "terminal/create",
        params: { command: "bash" },
      });

      await vi.waitFor(() => {
        const errors = trafficHandler.mock.calls.filter(
          (c: any) => c[0] === "out" && c[1].error,
        );
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0][1].error.code).toBe(-32000);
      });
    });

    it("unsubscribe terminal handler prevents it from being called", async () => {
      const handler = vi.fn().mockResolvedValue({ terminalId: "term-1" });
      const subscription = controller.subscribeToTerminalCreate(handler);
      subscription.unsubscribe();

      const trafficHandler = vi.fn();
      controller.on("traffic", trafficHandler);

      emitNotification({
        jsonrpc: "2.0",
        id: 1,
        method: "terminal/create",
        params: { command: "bash" },
      });

      await vi.waitFor(() => {
        expect(handler).not.toHaveBeenCalled();
        const errors = trafficHandler.mock.calls.filter(
          (c: any) => c[0] === "out" && c[1].error,
        );
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0][1].error.code).toBe(-32601);
      });
    });
  });
```

### 5C: Update existing initialize tests for new signature

The existing `initialize` tests in `session-controller.test.ts` pass `{ name, version }` directly. These must be updated to use the new `{ clientInfo: { name, version } }` format.

**Find and replace** in `session-controller.test.ts`:

1. Line 62: `controller.initialize({ name: "test", version: "1.0" })` → `controller.initialize({ clientInfo: { name: "test", version: "1.0" } })`
2. Line 129: `controller.initialize({ name: "test", version: "1.0" })` → `controller.initialize({ clientInfo: { name: "test", version: "1.0" } })`
3. Line 135: `controller.initialize()` → `controller.initialize()` (no change needed — still works with undefined)
4. Line 142: `controller.initialize({ name: "test", version: "1.0" })` → `controller.initialize({ clientInfo: { name: "test", version: "1.0" } })`
5. Line 149: `controller.initialize({ name: "test", version: "1.0" })` → `controller.initialize({ clientInfo: { name: "test", version: "1.0" } })`
6. Line 155: `controller.initialize({ name: "test", version: "1.0" })` → `controller.initialize({ clientInfo: { name: "test", version: "1.0" } })`
7. Line 376: `controller.initialize({ name: "test", version: "1.0" })` → `controller.initialize({ clientInfo: { name: "test", version: "1.0" } })`
8. Line 387: `controller.initialize({ name: "test", version: "1.0" })` → `controller.initialize({ clientInfo: { name: "test", version: "1.0" } })`
9. Line 395: `controllerWithTimeout.initialize({ name: "test", version: "1.0" })` → `controllerWithTimeout.initialize({ clientInfo: { name: "test", version: "1.0" } })`
10. Line 410: `controller.initialize({ name: "test", version: "1.0" })` → `controller.initialize({ clientInfo: { name: "test", version: "1.0" } })`

### 5D: Add initialize with clientCapabilities test

Also in `session-controller.test.ts`, add a new test inside the "initialization with connection" describe block (after line 157):

```typescript
    it("initialize sends clientCapabilities when provided", async () => {
      let capturedParams: any;
      mockTransport = new MockTransport(async (req) => {
        capturedParams = req.params;
        return {};
      });
      controller = new SessionController(mockTransport, 30000);
      await controller.initialize({
        clientInfo: { name: "test", version: "1.0" },
        clientCapabilities: { terminal: true },
      });
      expect(capturedParams.clientCapabilities).toEqual({ terminal: true });
    });

    it("initialize sends empty clientCapabilities when not provided", async () => {
      let capturedParams: any;
      mockTransport = new MockTransport(async (req) => {
        capturedParams = req.params;
        return {};
      });
      controller = new SessionController(mockTransport, 30000);
      await controller.initialize({
        clientInfo: { name: "test", version: "1.0" },
      });
      expect(capturedParams.clientCapabilities).toEqual({});
    });
```

**Verification:**
```bash
cd /root/acp-chat-ui-react/packages/acp-chat-core
npx vitest run --reporter=verbose 2>&1
```
Expected: all tests pass including the new terminal tests.

---

## Task 6: Update Package Exports

**File:** `packages/acp-chat-core/src/index.ts` (MODIFY)

Add terminal exports at the end of the file, after the filesystem exports (after line 161). Add a terminal section following the exact filesystem export pattern:

```typescript
// Terminal types
export type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  TerminalCreateHandler,
  TerminalOutputHandler,
  TerminalWaitForExitHandler,
  TerminalKillHandler,
  TerminalReleaseHandler,
  TerminalSubscription,
} from "./terminals/types.js";

export { TerminalSubscriptionManager } from "./terminals/subscription-manager.js";
```

The complete end of `src/index.ts` should look like:

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

// Terminal types
export type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  TerminalCreateHandler,
  TerminalOutputHandler,
  TerminalWaitForExitHandler,
  TerminalKillHandler,
  TerminalReleaseHandler,
  TerminalSubscription,
} from "./terminals/types.js";

export { TerminalSubscriptionManager } from "./terminals/subscription-manager.js";
```

**Verification:**
```bash
cd /root/acp-chat-ui-react/packages/acp-chat-core
npx tsc --noEmit 2>&1
```
Expected: no errors.
```bash
npx vitest run 2>&1 | tail -10
```
Expected: all tests pass.

Also verify the exports are reachable:
```bash
cd /root/acp-chat-ui-react/packages/acp-chat-core
node -e "
const mod = await import('./src/index.js');
console.log('TerminalSubscriptionManager:', typeof mod.TerminalSubscriptionManager);
console.log('TerminalCreateHandler:', typeof mod.TerminalCreateHandler);
console.log('TerminalSubscription:', typeof mod.TerminalSubscription);
" 2>&1
```
Expected: `TerminalSubscriptionManager: function` (the rest are types, so they won't appear at runtime — that's expected for `export type`).

---

## Post-Implementation: Single Commit

After all tasks are complete and verified:

```bash
cd /root/acp-chat-ui-react
git add -A
git status
```

Verify the changed files list includes:
- `packages/acp-chat-core/src/terminals/types.ts` (new)
- `packages/acp-chat-core/src/terminals/subscription-manager.ts` (new)
- `packages/acp-chat-core/src/transport/transport-interface.ts` (modified)
- `packages/acp-chat-core/src/session/controller.ts` (modified)
- `packages/acp-chat-core/src/test-utils/mocks.ts` (modified)
- `packages/acp-chat-core/src/index.ts` (modified)
- `packages/acp-chat-core/src/__tests__/terminal-subscription.test.ts` (new)
- `packages/acp-chat-core/src/session/session-controller.test.ts` (modified)

```bash
git commit -m "feat(acp-chat-core): add ACP terminals capability

- Add TerminalSubscriptionManager with subscribe/getHandlers for all 5 terminal operations
- Wire terminal dispatch into SessionController handleAcpPayload
- Fix Transport interface: add sendRawResponse for JSON-RPC response delivery
- Update initialize() to accept clientCapabilities (terminal: boolean)
- Add terminal type exports to barrel index
- Add comprehensive tests for manager and controller integration"
```

---

## Complete File Change Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/terminals/types.ts` | NEW | ~60 lines |
| `src/terminals/subscription-manager.ts` | NEW | ~90 lines |
| `src/transport/transport-interface.ts` | MODIFY | +12 lines (add sendRawResponse) |
| `src/session/controller.ts` | MODIFY | +200 lines (imports, field, methods, dispatch, handlers) |
| `src/test-utils/mocks.ts` | MODIFY | +4 lines (sendRawResponse) |
| `src/index.ts` | MODIFY | +22 lines (terminal exports) |
| `src/__tests__/terminal-subscription.test.ts` | NEW | ~120 lines |
| `src/session/session-controller.test.ts` | MODIFY | +180 lines (terminal tests + initialize signature updates) |

---

## Dependency Graph

```
Task 1 (Types)  ──┐
                   ├──→ Task 2 (Manager) ──┐
Task 3 (Transport) ─┘                       │
                                            ├──→ Task 4 (Controller Integration) ──┐
                                                                                    ├──→ Task 5 (Tests)
                                                                                    │
Task 1 (Types) ─────────────────────────────┘                                   └──→ Task 6 (Exports)
Task 2 (Manager) ──────────────────────────────┘
```

## Parallelism Summary

| Parallel Group | Tasks | Notes |
|---|---|---|
| Group A (start immediately) | Task 1, Task 3 | Fully independent — define types and fix transport simultaneously |
| Group B | Task 2 | Blocks on Task 1 only |
| Group C | Task 4 | Blocks on Tasks 1, 2, 3 — largest integration task |
| Group D | Task 5 | Blocks on Task 4 — test-after strategy |
| Group E | Task 6 | Blocks on Tasks 1, 2, 4 — can proceed in parallel with Task 5 after Task 4 is done |
