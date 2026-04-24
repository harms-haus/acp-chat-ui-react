# Architecture Review: ACP Chat UI React

**Date:** April 23, 2026  
**Reviewer:** AI Assistant  
**Scope:** Package boundary isolation and replay logic placement

---

## Executive Summary

The architecture refactoring has **successfully separated** the transport layer (`acp-ws-bridge`) from the protocol layer (`acp-chat-core`). The `ReplayController` was correctly removed from TypeScript packages, and replay logic now lives exclusively in the Rust controller. Integration tests have been updated to use `WsTransport` directly.

**Status: ✅ COMPLETE** - All issues resolved.

---

## ✅ What's Working Well

### 1. `acp-ws-bridge` (TypeScript) - CLEAN
- ✅ **No imports from `acp-chat-core`** - verified via search
- ✅ **Depends only on `@agentclientprotocol/sdk`** - external dependency
- ✅ **`TransportClient` and `WsTransport` are pure transport layers** - no ACP protocol knowledge
- ✅ **No `ReplayController`** - correctly removed
- ✅ **No replay state machine** - only sends/receives messages

**File:** `packages/acp-ws-bridge/src/client.ts`
```typescript
/**
 * NO ACP PROTOCOL KNOWLEDGE: This client knows nothing about ACP sessions,
 * replay, or application semantics. It only handles bridge envelope transport.
 */
```

### 2. `acp-chat-core` - CLEAN
- ✅ **No imports from `acp-ws-bridge`** - verified via search
- ✅ **Abstract transport interface only** - no WebSocket knowledge
- ✅ **Pure protocol implementation** - SessionController, normalization, helpers
- ✅ **Capture infrastructure for recording** (not replaying) - acceptable

**File:** `packages/acp-chat-core/src/index.ts`
```typescript
/**
 * Pure ACP protocol implementation. Session control, incremental normalization.
 * NO bridge protocol - transport layer is the responsibility of acp-ws-bridge.
 */
```

### 3. `acp-chat-react` - APPROPRIATE DEPENDENCIES
- ✅ **Only imports `WsTransport` from `acp-ws-bridge`** in `index.browser.ts`
- ✅ **This is by design** - needs to instantiate transport for `SessionController`
- ✅ **No replay logic** - comments only

**File:** `packages/acp-chat-react/src/index.browser.ts`
```typescript
import { WsTransport } from "@harms-haus/acp-ws-bridge";
import { SessionController } from "@harms-haus/acp-chat-core";

function createSessionController(bridgeUrl: string): SessionController {
  const transport = new WsTransport(bridgeUrl);
  return new SessionController(transport);
}
```

### 4. `acp-harness-ui` - CORRECT LAYERING
- ✅ **Imports from both `acp-chat-core` and `acp-ws-bridge`** - expected for UI layer
- ✅ **`BridgeAdapter` correctly delegates to Rust controller**
- ✅ **No replay state machine** - only sends commands

**File:** `packages/acp-harness-ui/src/bridge-adapter/bridge-adapter.ts`
```typescript
/**
 * Key design principles:
 * - NO replay logic - replay is controlled by the Rust controller
 * - NO session management - sessions are managed by the Rust side
 * - Transport only - this is a thin adapter for UI integration
 */
```

---

## ⚠️ Issues Found

### Issue #1: Integration Tests Reference Non-Existent `ReplayController` [RESOLVED]

**Location:** `packages/integration-tests/src/long-context-replay.test.ts` and `filesystem-events.test.ts`
**Status:** ✅ **FIXED**

The integration tests previously referenced `ReplayController` which was correctly removed from `acp-ws-bridge`. Both tests have been updated:

**What was changed:**
- `long-context-replay.test.ts` - Now uses `WsTransport` from `@harms-haus/acp-ws-bridge`
- `filesystem-events.test.ts` - Now uses `SessionController` from `@harms-haus/acp-chat-core` with `subscribeToFileReads` and `subscribeToFileWrites`

**Fix applied:**
```typescript
// OLD (broken):
import type { ReplayController } from "@harms-haus/acp-ws-bridge";
const { ReplayController: RC } = await import("@harms-haus/acp-ws-bridge");
const controller = new RC({ bridgeUrl: `ws://127.0.0.1:${port}` });

// NEW (correct) - long-context-replay.test.ts:
import { WsTransport } from "@harms-haus/acp-ws-bridge";
const transport = new WsTransport(`ws://127.0.0.1:${port}`);
await transport.connect();

// NEW (correct) - filesystem-events.test.ts:
import { SessionController } from "@harms-haus/acp-chat-core";
import { WsTransport } from "@harms-haus/acp-ws-bridge";
const transport = new WsTransport(`ws://127.0.0.1:${port}`);
const controller = new SessionController(transport);
controller.subscribeToFileReads(handler);
controller.subscribeToFileWrites(handler);
```

---

### Issue #2: Minor - `BridgeAdapter` Event Emission Pattern [NOTED]

**Location:** `packages/acp-harness-ui/src/bridge-adapter/bridge-adapter.ts` (lines 60-63)

**Observation:**
```typescript
this.transport.onStatusChange((status: TransportStatus) => {
  const connectionStatus = this.mapTransportStatus(status);
  this.setState({ connectionStatus });
});
```

The `setState` method correctly calls `this.statusHandlers.forEach(...)`, so events ARE propagated. However, the pattern could be clearer by explicitly calling the handler:

**Suggested improvement:**
```typescript
this.transport.onStatusChange((status: TransportStatus) => {
  const connectionStatus = this.mapTransportStatus(status);
  const newState = { ...this.state, connectionStatus };
  this.statusHandlers.forEach(handler => handler(newState));
});
```

**Impact:** Low - current implementation works, but explicit is better than implicit.

---

## 📊 Package Dependency Graph

```
acp-chat-core          acp-ws-bridge
    ↑                       ↑
    │ (types only)          │ (WsTransport only)
    │                       │
    └──────────┬────────────┘
               │
        acp-harness-ui
               ↑
               │ (BridgeAdapter)
               │
    integration-tests (BROKEN - needs fix)
```

**Legend:**
- ✅ Clean boundary - no cross-imports
- ⚠️ Broken reference - needs update

---

## 🔍 Cross-Boundary Analysis

### Cross-Boundary Analysis

| From Package | Imports From | Status | Notes |
|--------------|--------------|--------|-------|
| `acp-chat-core` | `acp-ws-bridge` | ✅ None | Correct |
| `acp-ws-bridge` | `acp-chat-core` | ✅ None | Correct |
| `acp-chat-react` | `acp-ws-bridge` | ✅ `WsTransport` only | By design |
| `acp-chat-react` | `acp-chat-core` | ✅ Full API | By design |
| `acp-harness-ui` | `acp-ws-bridge` | ✅ `WsTransport` | Via `BridgeAdapter` |
| `acp-harness-ui` | `acp-chat-core` | ✅ Types only | For UI components |
| `integration-tests` | `acp-ws-bridge` | ✅ `WsTransport` | **FIXED** |

---

## 🎯 Replay Logic Placement

### Where Replay Logic Lives

| Component | Replay Logic? | Notes |
|-----------|---------------|-------|
| Rust Controller | ✅ YES | **Sole owner** of replay state machine |
| `acp-ws-bridge` (Rust) | ✅ YES | Part of Rust controller |
| `acp-ws-bridge` (TypeScript) | ❌ NO | Transport only |
| `acp-chat-core` | ❌ NO | Protocol only |
| `acp-chat-react` | ❌ NO | UI bindings only |
| `acp-harness-ui` | ❌ NO | Adapter only, sends commands |
| `integration-tests` | ❌ NO | Uses `WsTransport` for testing |

**Conclusion:** Replay logic is correctly isolated to the Rust controller. TypeScript packages only send control commands (e.g., `set_replay_speed`, `initialize` with replay data path).

---

## 📝 Recommendations

### Immediate Actions Required

1. **~~Fix Integration Tests~~** [DONE]
 - ✅ `long-context-replay.test.ts` - Updated to use `WsTransport`
 - ✅ `filesystem-events.test.ts` - Updated to use `SessionController` with filesystem subscriptions

2. **Optional Cleanup** [P2]
 - Consider making `BridgeAdapter` event emission more explicit
 - Add unit tests for `BridgeAdapter` (currently untested)

### Documentation Updates

The following wiki pages should be updated to reflect the new architecture:

1. `acp-chat-core-Session-Management.md` - Remove `ReplayController` references
2. `acp-chat-core-Implementation-Guide.md` - Update examples to use `BridgeAdapter`
3. `ACP-Protocol.md` - Clarify that replay is Rust-only

---

## ✅ Conclusion

The architecture refactoring has **successfully achieved** its goals:

- ✅ `acp-ws-bridge` is a pure transport layer with no ACP protocol knowledge
- ✅ `acp-chat-core` is protocol-only with no transport dependencies
- ✅ Replay logic lives exclusively in the Rust controller
- ✅ TypeScript packages only send control commands to Rust
- ✅ Integration tests updated to use `WsTransport` directly
- ✅ Filesystem events test rewritten to use `SessionController` with `subscribeToFileReads/Write`

**All critical issues have been resolved.** The architecture is now fully consistent with the stated design principles.

---

**Generated:** April 23, 2026
**Build Status:** ✅ Passing
**Test Status:** ✅ All integration tests updated and type-checking
