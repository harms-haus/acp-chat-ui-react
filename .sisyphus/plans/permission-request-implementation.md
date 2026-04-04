# Permission Request Implementation Plan (v2 - Momus Reviewed)

## Overview
Implement ACP protocol `session/request_permission` handling across acp-chat-core, acp-chat-react, and harness projects. When an agent requests permission before executing a tool call, show an inline UI element in the thread with tool call summary and allow/deny buttons.

## Protocol Reference
From https://agentclientprotocol.com/protocol/tool-calls#requesting-permission:

**Request** (Agent → Client):
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "toolCall": { "toolCallId": "call_001" },
    "options": [
      { "optionId": "allow-once", "name": "Allow once", "kind": "allow_once" },
      { "optionId": "reject-once", "name": "Reject", "kind": "reject_once" }
    ]
  }
}
```

**Response** (Client → Agent):
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "outcome": {
      "outcome": "selected",
      "optionId": "allow-once"
    }
  }
}
```

**Cancelled** (Client → Agent, when prompt turn cancelled):
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "outcome": {
      "outcome": "cancelled"
    }
  }
}
```

## Key Protocol Insight
`session/request_permission` is a **JSON-RPC request** (has `id` field), not a notification. The client MUST respond with a JSON-RPC response using the same `id`. This is different from `session/update` which is a notification (no `id`).

The SessionController's `handleAcpPayload()` currently handles:
- Responses with `id` → matches pending requests (line 245)
- `session/update` notifications → emits sessionUpdate events (line 302)

We need to add a third branch: requests with `method === "session/request_permission"` → emit permissionRequest event.

## Implementation Layers

### Layer 1: acp-chat-core - Session Controller

**File**: `packages/acp-chat-core/src/session/controller.ts`

**Changes**:

1. **Add new types** (before line 42):
```typescript
export interface PermissionOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
}

export interface PermissionRequestParams {
  sessionId: string;
  toolCall: { toolCallId: string };
  options: PermissionOption[];
}

type PermissionRequestHandler = (params: PermissionRequestParams, requestId: number) => void;
```

2. **Add handler set** (after line 55):
```typescript
private permissionRequestHandlers = new Set<PermissionRequestHandler>();
```

3. **Add event type** (in `on()` method, after line 77):
```typescript
on(event: "permissionRequest", handler: PermissionRequestHandler): () => void;
```
Update the union type in the overload signature.

4. **Add emit method** (after line 116):
```typescript
private emitPermissionRequest(params: PermissionRequestParams, requestId: number): void {
  this.permissionRequestHandlers.forEach((h) => { h(params, requestId); });
}
```

5. **Handle incoming request** (in `handleAcpPayload()`, after the `session/update` block at line 324, before the closing brace):
```typescript
} else if ("method" in obj && obj.method === "session/request_permission") {
  const params = obj.params as Record<string, unknown> | undefined;
  if (params && typeof obj.id === "number") {
    const permissionParams: PermissionRequestParams = {
      sessionId: params.sessionId as string,
      toolCall: params.toolCall as { toolCallId: string },
      options: params.options as PermissionOption[],
    };
    this.emitPermissionRequest(permissionParams, obj.id);
  }
}
```

6. **Add `sendResponse()` private method** (after `sendNotification()` at line 203):
```typescript
private sendResponse(id: number, result: unknown): void {
  const response = { jsonrpc: "2.0" as const, id, result };
  const json = JSON.stringify(response);
  this.transport.send(json);
  this.emitTraffic("out", response);
}
```

7. **Add public response methods** (after `cancelPrompt()` at line 180):
```typescript
async respondToPermission(requestId: number, optionId: string): Promise<void> {
  this.sendResponse(requestId, {
    outcome: { outcome: "selected", optionId },
  });
}

async cancelPermission(requestId: number): Promise<void> {
  this.sendResponse(requestId, {
    outcome: { outcome: "cancelled" },
  });
}
```

### Layer 2: acp-chat-core - Normalization Store

**File**: `packages/acp-chat-core/src/normalization/store.ts`

**Changes**:

1. **Add `NormalizedPermissionRequest` interface** (after `NormalizedToolCall` at line 77):
```typescript
export type PermissionRequestStatus = "pending" | "approved" | "denied" | "cancelled";

export interface NormalizedPermissionRequest {
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

2. **Update `TimelineItem` union** (at line 79):
```typescript
export type TimelineItem =
  | { type: "message"; id: string; data: NormalizedMessage }
  | { type: "thought"; id: string; data: NormalizedThought }
  | { type: "tool_call"; id: string; data: NormalizedToolCall }
  | { type: "permission_request"; id: string; data: NormalizedPermissionRequest };
```

3. **Update `TimelineItemType`** (at line 84):
```typescript
export type TimelineItemType = "message" | "thought" | "tool_call" | "permission_request";
```

4. **Add to `NormalizedState`** (at line 86):
```typescript
export interface NormalizedState {
  messages: Map<string, NormalizedMessage>;
  thoughts: Map<string, NormalizedThought>;
  toolCalls: Map<string, NormalizedToolCall>;
  permissionRequests: Map<string, NormalizedPermissionRequest>;
  timelineOrder: Array<{ type: TimelineItemType; id: string }>;
  turnIdToMessageId: Map<string, string>;
}
```

5. **Update `createNormalizedState()`** (at line 149):
```typescript
export function createNormalizedState(): NormalizedState {
  return {
    messages: new Map(),
    thoughts: new Map(),
    toolCalls: new Map(),
    permissionRequests: new Map(),
    timelineOrder: [],
    turnIdToMessageId: new Map(),
  };
}
```

6. **Add `PermissionRequestUpdate` interface** (after `ToolCallUpdate` at line 145):
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

7. **Add case in `applySessionUpdate()`** (in the switch at line 173, after `tool_call_update`):
```typescript
case "permission_request": {
  console.log("[applySessionUpdate] Handling permission_request");
  return applyPermissionRequest(state, update as PermissionRequestUpdate);
}
```

8. **Add `applyPermissionRequest()` function** (after `applyToolCallUpdate()` at line 537):
```typescript
function applyPermissionRequest(state: NormalizedState, update: PermissionRequestUpdate): NormalizedPermissionRequest | null {
  if (!update.requestId || !update.toolCallId || !update.options) {
    console.warn("[applyPermissionRequest] Missing required fields:", update);
    return null;
  }

  const id = `perm_${update.requestId}`;
  const existing = state.permissionRequests.get(id);
  if (existing) {
    return existing; // Already exists, don't duplicate
  }

  const permissionRequest: NormalizedPermissionRequest = {
    requestId: update.requestId,
    sessionId: update.sessionId ?? "",
    toolCallId: update.toolCallId,
    options: update.options,
    status: "pending",
    createdAt: update.timestamp ?? Date.now(),
  };

  state.permissionRequests.set(id, permissionRequest);
  state.timelineOrder.push({ type: "permission_request", id });
  return permissionRequest;
}
```

9. **Add selectors** (after `getTimeline()` at line 567):
```typescript
export function getPermissionRequests(state: NormalizedState): NormalizedPermissionRequest[] {
  return Array.from(state.permissionRequests.values());
}

export function getPendingPermissionRequests(state: NormalizedState): NormalizedPermissionRequest[] {
  return Array.from(state.permissionRequests.values()).filter(r => r.status === "pending");
}

export function getPermissionRequest(state: NormalizedState, requestId: number): NormalizedPermissionRequest | undefined {
  return state.permissionRequests.get(`perm_${requestId}`);
}
```

10. **Add `updatePermissionRequestStatus()` function** for updating status when user responds:
```typescript
export function updatePermissionRequestStatus(state: NormalizedState, requestId: number, status: PermissionRequestStatus, selectedOptionId?: string): void {
  const id = `perm_${requestId}`;
  const existing = state.permissionRequests.get(id);
  if (existing) {
    state.permissionRequests.set(id, { ...existing, status, selectedOptionId });
  }
}
```

### Layer 3: acp-chat-core - Exports

**File**: `packages/acp-chat-core/src/normalization/index.ts`

**Add exports**:
```typescript
export type { NormalizedPermissionRequest, PermissionRequestStatus } from "./store.js";
export { getPermissionRequests, getPendingPermissionRequests, getPermissionRequest, updatePermissionRequestStatus } from "./store.js";
```

**File**: `packages/acp-chat-core/src/index.ts`

**Add to type exports** (in the normalization block):
```typescript
export type {
  // ... existing types
  NormalizedPermissionRequest,
  PermissionRequestStatus,
} from "./normalization/index.js";
```

**Add to function exports**:
```typescript
export {
  // ... existing exports
  getPermissionRequests,
  getPendingPermissionRequests,
  getPermissionRequest,
  updatePermissionRequestStatus,
} from "./normalization/index.js";
```

**Also export from session**:
```typescript
export type { PermissionRequestParams, PermissionOption } from "./session/index.js";
```

**File**: `packages/acp-chat-core/src/session/index.ts`

**Add exports**:
```typescript
export type { PermissionRequestParams, PermissionOption } from "./controller.js";
```

### Layer 4: acp-chat-react - Store Extension

**File**: `packages/acp-chat-react/src/store/acp-store.ts`

**Changes**:

1. **Add imports**:
```typescript
import type { NormalizedPermissionRequest, PermissionRequestStatus } from "@acp/chat-core";
import { getPermissionRequests, getPendingPermissionRequests, updatePermissionRequestStatus } from "@acp/chat-core";
```

2. **Update `AcpStoreSnapshot`** (add to snapshot interface):
```typescript
export interface AcpStoreSnapshot {
  // ... existing fields
  permissionRequests: Map<string, NormalizedPermissionRequest>;
}
```

3. **Update `getSnapshot()`** (add to snapshot construction):
```typescript
permissionRequests: new Map(this.normalizedState.permissionRequests),
```

4. **Update `getServerSnapshot()`** (add to server snapshot):
```typescript
permissionRequests: new Map(),
```

5. **Add convenience methods**:
```typescript
getPermissionRequests(): NormalizedPermissionRequest[] {
  return getPermissionRequests(this.normalizedState);
}

getPendingPermissionRequests(): NormalizedPermissionRequest[] {
  return getPendingPermissionRequests(this.normalizedState);
}

respondToPermission(requestId: number, optionId: string): void {
  updatePermissionRequestStatus(this.normalizedState, requestId, "approved", optionId);
  this.version++;
  this.scheduleNotification();
  // The SessionController method will be called via the hook
}

denyPermission(requestId: number, optionId: string): void {
  updatePermissionRequestStatus(this.normalizedState, requestId, "denied", optionId);
  this.version++;
  this.scheduleNotification();
}
```

### Layer 5: acp-chat-react - Hooks

**File**: `packages/acp-chat-react/src/hooks/use-acp-store.ts`

**Add hooks**:
```typescript
export function usePermissionRequests(store: AcpStore): NormalizedPermissionRequest[] {
  const snapshot = useAcpStoreSnapshot(store);
  return Array.from(snapshot.permissionRequests.values());
}

export function usePendingPermissionRequests(store: AcpStore): NormalizedPermissionRequest[] {
  const snapshot = useAcpStoreSnapshot(store);
  return Array.from(snapshot.permissionRequests.values()).filter(
    r => r.status === "pending"
  );
}
```

**File**: New `packages/acp-chat-react/src/hooks/use-permission-response.ts`

```typescript
import { useCallback } from "react";
import type { AcpStore } from "../store/index.js";
import type { SessionController } from "@acp/chat-core";

export function usePermissionResponse(store: AcpStore, controller: SessionController) {
  const respond = useCallback(
    (requestId: number, optionId: string) => {
      store.respondToPermission(requestId, optionId);
      controller.respondToPermission(requestId, optionId);
    },
    [store, controller]
  );

  const cancel = useCallback(
    (requestId: number) => {
      store.denyPermission(requestId, "cancelled");
      controller.cancelPermission(requestId);
    },
    [store, controller]
  );

  return { respond, cancel };
}
```

### Layer 6: acp-chat-react - Permission Request UI Component

**File**: New `packages/acp-chat-react/src/permission-request/PermissionRequestCard.tsx`

**Component spec**:
- Receives `NormalizedPermissionRequest` and `onRespond`/`onCancel` callbacks
- Shows tool call summary (toolCallId, options)
- Renders buttons for each option, styled by kind:
  - `allow_once` / `allow_always` → primary/positive button
  - `reject_once` / `reject_always` → secondary/negative button
- Uses CSS variables for theming
- `data-acp-permission-request` and `data-acp-permission-status` attributes

```tsx
interface PermissionRequestCardProps {
  request: NormalizedPermissionRequest;
  onRespond: (optionId: string) => void;
  onCancel?: () => void;
  className?: string;
}
```

**File**: New `packages/acp-chat-react/src/permission-request/index.ts`

**Exports**: `PermissionRequestCard` component and `PermissionRequestCardProps` type

### Layer 7: acp-chat-react - Thread Integration

**File**: `packages/acp-chat-react/src/thread/types.ts`

**Update `ThreadItemType`** (line 10):
```typescript
export type ThreadItemType = "message" | "thought_group" | "permission_request";
```

**Update `ThreadItem`** (line 15):
```typescript
export interface ThreadItem {
  type: ThreadItemType;
  id: string;
  data: NormalizedMessage | ThoughtGroupWithState | NormalizedPermissionRequest;
}
```

**Add import**:
```typescript
import type { NormalizedPermissionRequest } from "@acp/chat-core";
```

**File**: `packages/acp-chat-react/src/thread/Thread.tsx`

**Changes in the `useMemo` that builds `threadItems`** (line 49-102):

The current logic groups consecutive thoughts/tool_calls into thought_groups. Permission requests should be handled similarly - they should appear inline. Update the loop to handle `permission_request` items:

```typescript
for (const item of timelineItems) {
  if (item.type === "thought" || item.type === "tool_call") {
    // ... existing thought grouping logic
  } else if (item.type === "permission_request") {
    // Flush any pending thought group
    if (currentThoughtGroup) {
      // ... flush logic (same as existing)
    }
    // Add permission request as its own thread item
    result.push({
      type: "permission_request",
      id: item.id,
      data: item.data as NormalizedPermissionRequest,
    });
  } else {
    // ... existing message handling
  }
}
```

**Add import**:
```typescript
import type { NormalizedPermissionRequest } from "@acp/chat-core";
```

**File**: `packages/acp-chat-react/src/thread/ThreadItemRenderer.tsx`

**Add case for permission_request**:
```typescript
import { PermissionRequestCard } from "../permission-request/index.js";
import type { NormalizedPermissionRequest } from "@acp/chat-core";

// In the switch statement:
case "permission_request": {
  const request = item.data as NormalizedPermissionRequest;
  return (
    <PermissionRequestCard
      request={request}
      onRespond={(optionId) => {
        // This will be wired through context or props
      }}
    />
  );
}
```

**Note**: The `onRespond` callback needs to be passed through props. Add to `ThreadItemRendererProps`:
```typescript
onPermissionRespond?: (requestId: number, optionId: string) => void;
```

### Layer 8: acp-chat-react - Exports

**File**: `packages/acp-chat-react/src/index.ts`

**Add exports**:
```typescript
export { PermissionRequestCard } from "./permission-request/index.js";
export type { PermissionRequestCardProps } from "./permission-request/index.js";
export { usePermissionResponse } from "./hooks/use-permission-response.js";
export { usePermissionRequests, usePendingPermissionRequests } from "./hooks/use-acp-store.js";
```

### Layer 9: harness - Demo Integration

**File**: `apps/harness/src/App.tsx`

**Changes**:
1. Add "Permission Demo" tab to session source selector
2. Create `createPermissionDemoController()` mock that:
   - Emits `permissionRequest` event after a short delay when prompt is sent
   - Simulates the full flow: prompt → permission request → tool call → response
3. Wire up `usePermissionResponse` hook in the demo

**Mock controller pattern** (follows existing demo controllers):
```typescript
function createPermissionDemoController(): SessionController {
  // Similar to createDemoController but adds:
  // 1. After receiving prompt, emit permissionRequest event
  // 2. When respondToPermission is called, continue with tool call simulation
}
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `acp-chat-core/src/session/controller.ts` | Modify | Add permission request event handling + response methods |
| `acp-chat-core/src/session/index.ts` | Modify | Export new types |
| `acp-chat-core/src/normalization/store.ts` | Modify | Add permission request state + apply function + selectors |
| `acp-chat-core/src/normalization/index.ts` | Modify | Export new types + functions |
| `acp-chat-core/src/index.ts` | Modify | Export new types + functions |
| `acp-chat-react/src/store/acp-store.ts` | Modify | Subscribe to permission events + add convenience methods |
| `acp-chat-react/src/hooks/use-acp-store.ts` | Modify | Add permission request hooks |
| `acp-chat-react/src/hooks/use-permission-response.ts` | Create | Permission response hook |
| `acp-chat-react/src/permission-request/PermissionRequestCard.tsx` | Create | UI component |
| `acp-chat-react/src/permission-request/index.ts` | Create | Exports |
| `acp-chat-react/src/thread/types.ts` | Modify | Add permission_request to ThreadItemType |
| `acp-chat-react/src/thread/Thread.tsx` | Modify | Handle permission_request in timeline |
| `acp-chat-react/src/thread/ThreadItemRenderer.tsx` | Modify | Render permission_request items |
| `acp-chat-react/src/index.ts` | Modify | Export new components + hooks |
| `apps/harness/src/App.tsx` | Modify | Add permission demo tab |

## Dependencies & Ordering

1. **acp-chat-core** changes first (controller + normalization + exports)
2. **acp-chat-react** store + hooks second
3. **acp-chat-react** UI components third
4. **acp-chat-react** thread integration fourth
5. **harness** demo last

## Testing Strategy

1. Unit tests for `applyPermissionRequest()` in normalization store
2. Unit tests for `updatePermissionRequestStatus()` 
3. Integration test for permission request → response flow in SessionController
4. Visual test for PermissionRequestCard component
5. Manual test via harness demo mode

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Protocol mismatch | Follow exact JSON-RPC structure from spec |
| Race conditions | Use request ID tracking for pending requests |
| UI blocking | Permission requests are non-blocking, user can interact |
| Cancelled turns | Handle `cancelled` outcome per spec |
| Multiple concurrent requests | Each request has unique ID, stored in Map |
| JSON-RPC response format | Use `sendResponse()` private method with exact format |
