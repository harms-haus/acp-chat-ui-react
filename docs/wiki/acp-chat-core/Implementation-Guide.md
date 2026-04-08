# Implementation Guide: Building ACP Chat UIs

A framework-agnostic guide for building ACP-powered chat interfaces using `@acp/chat-core`. This document extracts the patterns from `@acp/chat-react` and presents them as reusable abstractions you can implement in React, Vue, Svelte, Angular, Vanilla JS, or any other framework.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [1. Core Patterns](#1-core-patterns)
  - [1.1 State Subscription Pattern](#11-state-subscription-pattern)
  - [1.2 Event Handling Pattern](#12-event-handling-pattern)
  - [1.3 Timeline Rendering](#13-timeline-rendering)
- [2. Component Patterns](#2-component-patterns)
  - [2.1 Message List](#21-message-list)
  - [2.2 Composer](#22-composer)
  - [2.3 Status and Loading Indicators](#23-status-and-loading-indicators)
  - [2.4 Error Handling](#24-error-handling)
- [3. Advanced Patterns](#3-advanced-patterns)
  - [3.1 Permission Requests](#31-permission-requests)
  - [3.2 Thought Stack](#32-thought-stack)
  - [3.3 Connection Management](#33-connection-management)
- [4. Framework-Agnostic Abstractions](#4-framework-agnostic-abstractions)
  - [4.1 Pure Logic Functions](#41-pure-logic-functions)
  - [4.2 Type-Based Rendering](#42-type-based-rendering)
  - [4.3 Event Subscription Manager](#43-event-subscription-manager)
  - [4.4 Snapshot Management](#44-snapshot-management)
- [5. CSS Variable Theming](#5-css-variable-theming)
- [6. Implementation Checklist](#6-implementation-checklist)
- [7. Framework Translation Table](#7-framework-translation-table)

---

## Architecture Overview

The ACP chat system has three layers:

```
┌──────────────────────────────────────────┐
│           Framework UI Layer              │  Your code: components, hooks, reactivity
├──────────────────────────────────────────┤
│           Store Adapter Layer             │  Reactive wrapper around core (framework-specific)
├──────────────────────────────────────────┤
│           @acp/chat-core                  │  Framework-agnostic: transport, session, normalization
└──────────────────────────────────────────┘
```

**`@acp/chat-core`** provides:
- **TransportClient** — WebSocket communication with the ACP bridge
- **SessionController** — JSON-RPC session management (connect, send prompts, handle permissions)
- **NormalizedState** — Immutable state with pure update/select functions
- **Pure logic** — Composer validation, thought grouping, timeline rendering

Your **framework UI layer** provides:
- Reactive bindings (signals, stores, observables, state)
- Components (message cards, composer, thought stacks)
- Lifecycle management (mount/unmount subscriptions)

### Data Flow

```
WebSocket → TransportClient → SessionController → Store Adapter → UI Components
                                   │
                                   ├── sessionUpdate events → applySessionUpdate() → NormalizedState
                                   ├── statusChange events → SessionControllerState
                                   ├── permissionRequest events → Permission request UI
                                   └── sessionClearing events → State reset
```

---

## 1. Core Patterns

### 1.1 State Subscription Pattern

The core state model uses **immutable snapshots with pure functions**. There is no class-based store in `@acp/chat-core` — instead, you get a `NormalizedState` and a family of pure functions to update and query it.

#### NormalizedState Structure

```typescript
import type {
  NormalizedState,
  NormalizedMessage,
  NormalizedThought,
  NormalizedToolCall,
  NormalizedPermissionRequest,
} from "@acp/chat-core";

// The core state is a collection of Maps with a timeline ordering array
interface NormalizedState {
  messages: Map<string, NormalizedMessage>;
  thoughts: Map<string, NormalizedThought>;
  toolCalls: Map<string, NormalizedToolCall>;
  permissionRequests: Map<number, NormalizedPermissionRequest>;
  timelineOrder: Array<{
    type: "message" | "thought" | "tool_call" | "permission_request";
    id: string | number;
  }>;
  turnIdToMessageId: Map<string, string>;
}
```

#### Creating and Updating State

```typescript
import {
  createNormalizedState,
  applySessionUpdate,
} from "@acp/chat-core";

// Create empty state
const state = createNormalizedState();

// Apply updates from session events (mutates state in place)
// Returns the created/updated entity, or null for unrecognized updates
const result = applySessionUpdate(state, {
  sessionId: "sess_123",
  update: { type: "agent_message_chunk", /* ... */ },
});
```

**Key design decision**: `applySessionUpdate` mutates the state object directly. The Map objects and timelineOrder array are modified in place. This is intentional for performance — ACP updates can arrive at high frequency during streaming.

#### Selectors

```typescript
import {
  getMessages,
  getMessage,
  getMessagesByTurn,
  getThoughts,
  getToolCalls,
  getToolCall,
  getTimeline,
  getPermissionRequests,
  getPendingPermissionRequests,
  getPermissionRequest,
} from "@acp/chat-core";

// Get ordered messages (filters timelineOrder for type "message")
const messages: NormalizedMessage[] = getMessages(state);

// Get single message by ID
const msg: NormalizedMessage | undefined = getMessage(state, "msg_123");

// Get message by turn ID (useful for matching streaming chunks)
const msgByTurn: NormalizedMessage | undefined = getMessagesByTurn(state, "turn_456");

// Get full timeline (all item types in order)
const timeline: TimelineItem[] = getTimeline(state);

// Get only pending permission requests
const pending: NormalizedPermissionRequest[] = getPendingPermissionRequests(state);
```

#### Building a Store Adapter

The React implementation (`AcpStore`) demonstrates the adapter pattern: it wraps `NormalizedState` + `SessionController` and adds **batched notifications** for framework reactivity.

```typescript
// Framework-agnostic store adapter pattern
class ChatStore {
  private normalizedState = createNormalizedState();
  private sessionState: SessionControllerState;
  private version = 0;
  private unsubscribes: Array<() => void> = [];

  constructor(private controller: SessionController) {
    this.sessionState = controller.getState();

    // Subscribe to controller events — updates applied IMMEDIATELY
    this.unsubscribes.push(
      controller.on("statusChange", (state) => {
        this.sessionState = state;
        this.notifySubscribers();
      }),
      controller.on("sessionUpdate", (params) => {
        applySessionUpdate(this.normalizedState, params as SessionUpdateParams);
        this.version++;
        this.notifySubscribers();
      }),
      controller.on("sessionClearing", () => {
        this.normalizedState = createNormalizedState();
        this.version++;
        this.notifySubscribers();
      })
    );
  }

  // Framework-specific: schedule batched notification
  private pendingNotification = false;
  private notificationTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly CADENCE_MS = 16; // Aligns to one animation frame

  private scheduleNotification(): void {
    if (this.pendingNotification) return;
    this.pendingNotification = true;
    this.notificationTimeout = setTimeout(() => {
      this.flushNotifications();
    }, this.CADENCE_MS);
  }

  private flushNotifications(): void {
    this.pendingNotification = false;
    this.notificationTimeout = null;
    // Notify all framework subscribers
    this.subscribers.forEach((cb) => { try { cb(); } catch {} });
  }

  // Snapshot for equality-checking frameworks
  getSnapshot(): Snapshot {
    return {
      session: { ...this.sessionState },
      messages: new Map(this.normalizedState.messages),
      thoughts: new Map(this.normalizedState.thoughts),
      toolCalls: new Map(this.normalizedState.toolCalls),
      permissionRequests: new Map(this.normalizedState.permissionRequests),
      timelineOrder: [...this.normalizedState.timelineOrder],
      turnIdToMessageId: new Map(this.normalizedState.turnIdToMessageId),
      version: this.version,
    };
  }

  destroy(): void {
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.unsubscribes.forEach((unsub) => unsub());
    this.subscribers.clear();
  }
}
```

**Critical principle**: ACP updates are processed **immediately** in `applySessionUpdate`. Only the framework notification (which triggers re-renders) is batched. No events are dropped or throttled.

### 1.2 Event Handling Pattern

`SessionController` uses a **Set-based handler pattern** with typed event names and unsubscribe functions.

#### Event Types

| Event | Payload | When Fired |
|-------|---------|------------|
| `"statusChange"` | `SessionControllerState` | Connection status, initialization, session ID changes |
| `"sessionUpdate"` | `{ sessionId, update }` | Every ACP update (messages, thoughts, tool calls, permissions) |
| `"traffic"` | `(direction, data)` | Raw JSON-RPC traffic (in/out) for debugging |
| `"error"` | `Error` | Transport errors, parsing failures |
| `"sessionClearing"` | `void` | Before loading a new session (state should be reset) |
| `"permissionRequest"` | `PermissionRequestParams & { requestId }` | Server requests user approval |

#### Subscription Pattern

```typescript
import { SessionController } from "@acp/chat-core";

const controller = new SessionController("ws://localhost:8080");

// Subscribe — returns unsubscribe function
const unsub = controller.on("sessionUpdate", (params) => {
  console.log("Got update:", params);
});

// Later: clean up
unsub();
```

The controller manages handler sets internally:

```typescript
// Internal implementation (simplified)
private handlers = new Set<Handler>();

on(event: string, handler: Handler): () => void {
  this.handlers.add(handler);
  return () => this.handlers.delete(handler); // Idempotent unsubscribe
}

private emit(payload: unknown): void {
  this.handlers.forEach((h) => h(payload));
}
```

#### Batched Session Updates

The server can send multiple updates in a single `session/update` message:

```typescript
// The controller handles this internally — it unpacks batched updates
// and emits individual sessionUpdate events for each one:
if (params.batched === true && Array.isArray(params.updates)) {
  for (const item of params.updates) {
    this.emitSessionUpdate({ sessionId: item.sessionId, update: item.update });
  }
}
```

This means your `sessionUpdate` handler always receives a **single update**, never a batch. The controller handles unbatching for you.

### 1.3 Timeline Rendering

The timeline is the ordered sequence of all chat items. Rendering it correctly requires processing the `timelineOrder` array and handling different item types.

#### Getting the Timeline

```typescript
import { getTimeline, type TimelineItem } from "@acp/chat-core";

const timeline: TimelineItem[] = getTimeline(state);

// Each item is a discriminated union:
// { type: "message", id: string, data: NormalizedMessage }
// { type: "thought", id: string, data: NormalizedThought }
// { type: "tool_call", id: string, data: NormalizedToolCall }
// { type: "permission_request", id: number, data: NormalizedPermissionRequest }
```

#### Timeline Processing Pipeline

To render a chat thread, you typically:

1. **Get the raw timeline** from `getTimeline()`
2. **Group consecutive thoughts and tool calls** into "thought groups"
3. **Filter permission requests** (show only pending ones, or show all with status)
4. **Render each item** based on its type

```typescript
import { createGroupedTimeline, type GroupedTimelineItem } from "@acp/chat-core";

const grouped: GroupedTimelineItem[] = createGroupedTimeline(timeline);

// Result contains two types:
// { type: "message", id: string, data: NormalizedMessage }
// { type: "thought_group", id: string, data: ThoughtGroup }

// ThoughtGroup contains:
// { id: string, items: ThoughtItem[], startTime: number, endTime: number }
// Where ThoughtItem = { type: "thought" | "tool_call", id: string, data: ... }
```

The grouping algorithm:
- Consecutive `thought` and `tool_call` items are collected into a `ThoughtGroup`
- A `message` item closes the current group and starts a new segment
- `permission_request` items pass through ungrouped (you filter them separately)

#### Rendering Logic (Pseudocode)

```
for each item in groupedTimeline:
  if item.type == "message":
    render MessageCard(item.data)
  if item.type == "thought_group":
    render ThoughtStack(item.data)  // Collapsible group

for each request in pendingPermissionRequests:
  render PermissionRequestCard(request)
```

---

## 2. Component Patterns

### 2.1 Message List

The message list renders the grouped timeline. Each message needs role-based styling and status handling.

#### Message Data Model

```typescript
interface NormalizedMessage {
  id: string;
  role: "user" | "agent";           // Determines styling (left/right, colors)
  status: "streaming" | "complete" | "cancelled" | "error";
  content: string;                   // Concatenated text from all text blocks
  contentBlocks: ContentBlock[];     // Structured content (text, resources, links)
  createdAt?: number;
  updatedAt?: number;
  parentMessageId?: string;
  turnId?: string;                   // Links streaming chunks to the same turn
}
```

#### Content Block Rendering

Messages contain an array of `ContentBlock` items. Each block has a type discriminator:

```typescript
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string; blob?: string } }
  | { type: "resource_link"; resourceLink: { uri: string; mimeType?: string } };
```

**Rendering strategy** — iterate blocks and dispatch by type:

```
for each block in message.contentBlocks:
  if block.type == "text":
    render Markdown(block.text)       // Use your preferred markdown renderer
  if block.type == "resource":
    render ResourceCard(block.resource)  // File display with mime type
  if block.type == "resource_link":
    render Link(block.resourceLink)      // Clickable resource link
```

**Text streaming**: During streaming, the `content` field grows as chunks arrive. The `contentBlocks` array is merged — consecutive text blocks are concatenated. This means your renderer should handle incrementally growing text without re-rendering from scratch.

#### Message Card Pattern

```
┌─────────────────────────────────────┐
│ [Avatar] Agent          ● streaming │  ← Header: role + status
│                                     │
│ Here is the response text with      │  ← Content blocks
│ **markdown** support...             │
│                                     │
│ [Resource: config.json]             │  ← Resource block
│                                     │
│ [Copy] [Menu ▾]                     │  ← Action bar (on hover)
└─────────────────────────────────────┘
```

**Data attributes** for test targeting:
- `data-acp-message` on the card root
- `data-acp-message-role="user" | "agent"`
- `data-acp-message-status="streaming" | "complete" | "cancelled" | "error"`
- `data-acp-message-id="<id>"`

### 2.2 Composer

The composer handles text input, send/stop logic, and keyboard events.

#### Composer State

```typescript
interface ComposerState {
  value: string;        // Current textarea content
  disabled: boolean;    // Prevent input (e.g., during initialization)
  isStreaming: boolean; // An agent message is currently streaming
  isComposing: boolean; // IME composition in progress (CJK input)
}
```

#### Pure Logic Functions (from `@acp/chat-core`)

These functions contain zero framework code and can be called from anywhere:

```typescript
import {
  shouldSendOnKeydown,
  canSend,
  canStop,
  getButtonState,
  getSendText,
  isSendButtonDisabled,
  shouldShowStopButton,
} from "@acp/chat-core";

// Keyboard: Enter sends, Shift+Enter is newline, blocked during IME
shouldSendOnKeydown("Enter", false, false);  // → true
shouldSendOnKeydown("Enter", true, false);   // → false (shift held)
shouldSendOnKeydown("Enter", false, true);   // → false (IME active)

// Validation: can we send right now?
canSend({ value: "hello", disabled: false, isStreaming: false, isComposing: false }); // → true
canSend({ value: "", disabled: false, isStreaming: false, isComposing: false });      // → false
canSend({ value: "hello", disabled: true, isStreaming: false, isComposing: false });  // → false

// Button state: toggle between Send and Stop
getButtonState(false);  // → "send"
getButtonState(true);   // → "stop"

// Trim whitespace before sending
getSendText("  hello world  "); // → "hello world"

// Streaming detection: show stop button when prompt is active or message is streaming
shouldShowStopButton(
  { phase: "active", turnId: "turn_1" },  // lifecycle state
  { type: "message", status: "streaming" } // last timeline item
); // → true
```

#### Prompt Lifecycle Tracking

```typescript
import {
  startPrompt,
  completePrompt,
  cancelPrompt,
  failPrompt,
  isPromptActive,
  type PromptLifecycleState,
} from "@acp/chat-core";

// Lifecycle transitions
let lifecycle: PromptLifecycleState = { phase: "idle" };

lifecycle = startPrompt("turn_123");  // { phase: "active", turnId: "turn_123" }
isPromptActive(lifecycle);            // → true

lifecycle = completePrompt();         // { phase: "complete" }
lifecycle = cancelPrompt();           // { phase: "cancelled" }
lifecycle = failPrompt();             // { phase: "error" }
```

#### Send Flow

```
User presses Enter
  └─ shouldSendOnKeydown() → true
      └─ canSend(state) → true
          └─ getSendText(value) → trimmed text
              └─ controller.sendPrompt(sessionId, text)
                  ├─ On success: clear textarea, notify parent
                  └─ On error: log/display error, keep textarea content
```

#### Stop Flow

```
User clicks Stop button
  └─ canStop(isStreaming) → true
      └─ controller.cancelPrompt(sessionId)
          └─ Server stops generating, final chunk arrives with status "cancelled"
```

### 2.3 Status and Loading Indicators

Status is tracked at multiple levels:

#### Connection Status

```typescript
// From SessionControllerState
interface SessionControllerState {
  connectionStatus: "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
  bridgeStatus: string;
  sessionId: string | null;
  initialized: boolean;
  capabilities: unknown | null;
}
```

**UI mapping**:
| `connectionStatus` | Display |
|---|---|
| `"disconnected"` | "Connect to a session to view messages" |
| `"connecting"` | Spinner with "Connecting..." |
| `"connected"` | Normal chat view |
| `"reconnecting"` | Warning banner "Reconnecting..." |
| `"error"` | Error banner with retry button |

#### Message Status

```typescript
// NormalizedMessage.status
"streaming"  → Pulsing dot indicator ●, show "Thinking..." or streaming text
"complete"   → Checkmark ✓
"cancelled"  → Hollow circle ○ with "Cancelled" label
"error"      → X mark ✕ with "Error" label
```

#### Streaming Detection

Find the currently streaming message to determine composer state:

```typescript
function getActiveStreamingMessage(messages: Map<string, NormalizedMessage>): NormalizedMessage | undefined {
  for (const msg of messages.values()) {
    if (msg.status === "streaming") return msg;
  }
  return undefined;
}

const isStreaming = !!getActiveStreamingMessage(state.messages);
```

#### Thought Activity

Track which thoughts and tool calls are currently "active" (in progress):

```typescript
class ActiveItemTracker {
  private activeThoughts = new Set<string>();
  private activeToolCalls = new Set<string>();

  handleUpdate(params: unknown): void {
    const update = (params as any).update;
    const updateType = update?.type ?? update?.sessionUpdate;

    // Thought lifecycle
    if (updateType === "agent_thought_chunk") {
      if (update.status === "completed" || update.status === "done") {
        this.activeThoughts.delete(update.thoughtId);
      } else {
        this.activeThoughts.add(update.thoughtId);
      }
    }

    // Tool call lifecycle
    if (updateType === "tool_call" || updateType === "tool_call_update") {
      if (update.status === "completed" || update.status === "done") {
        this.activeToolCalls.delete(update.toolCallId);
      } else {
        this.activeToolCalls.add(update.toolCallId);
      }
    }
  }

  getActiveItems() {
    return {
      activeThoughts: Array.from(this.activeThoughts),
      activeToolCalls: Array.from(this.activeToolCalls),
    };
  }

  clear(): void {
    this.activeThoughts.clear();
    this.activeToolCalls.clear();
  }
}
```

### 2.4 Error Handling

Errors occur at three layers, each requiring different UI treatment:

#### Layer 1: Transport Errors

```typescript
controller.on("error", (error: Error) => {
  // WebSocket failures, connection drops, message parsing errors
  // Display: Global error banner or toast
  showError(error.message);
});
```

#### Layer 2: Request Errors

```typescript
try {
  await controller.sendPrompt(sessionId, text);
} catch (error) {
  // JSON-RPC timeout (default 30s), method-specific errors
  // Display: Inline error near the composer
  logger.error("Failed to send prompt:", error);
}
```

#### Layer 3: Message-Level Errors

```typescript
// NormalizedMessage.status === "error"
// Display: Error styling on the message card itself
if (message.status === "error") {
  renderErrorMessage(message);
}
```

#### Error Display Pattern

```
┌─────────────────────────────────────────────┐
│ ⚠ Connection lost. Reconnecting...          │  ← Transport error banner
├─────────────────────────────────────────────┤
│                                             │
│ [User] Run the analysis                     │
│                                             │
│ [Agent] ✕ Error: Request timed out          │  ← Message-level error
│                                             │
├─────────────────────────────────────────────┤
│ Type a message...                    [Send] │  ← Composer (may show inline error)
└─────────────────────────────────────────────┘
```

---

## 3. Advanced Patterns

### 3.1 Permission Requests

When the agent wants to perform a potentially sensitive action (file write, command execution), the server sends a `session/request_permission` message that requires user approval.

#### Permission Data Model

```typescript
interface NormalizedPermissionRequest {
  requestId: number;
  sessionId: string;
  toolCallId: string;              // Links to the tool call that triggered this
  options: Array<{
    optionId: string;              // e.g., "allow_once", "allow_always", "deny"
    name: string;                  // Human-readable: "Allow Once", "Allow Always"
    kind: string;                  // Classification
  }>;
  status: "pending" | "approved" | "denied" | "cancelled";
  selectedOptionId?: string;       // Set after user responds
  createdAt: number;
}
```

#### Optimistic Update Pattern

The React implementation uses optimistic updates: the UI state is updated **immediately** when the user clicks an option, before the server confirms. This prevents the UI from flickering back to "pending" while waiting for network round-trip.

```typescript
// 1. Optimistically update local state
store.respondToPermission(requestId, optionId);
// Internally: updatePermissionRequestStatus(state, requestId, "approved", optionId)

// 2. Send to server
controller.respondToPermission(requestId, optionId);
```

Both calls happen together — the store update is synchronous, the server call is async. If the server call fails, the error handler can revert the state.

#### Permission UI Pattern

```
┌─────────────────────────────────────────────┐
│ 🔧 Write File                               │  ← Tool kind with icon
│                                             │
│ src/config.json                             │  ← File path / command / pattern
│                                             │
│ [Allow Once]  [Allow Always]  [Deny]        │  ← Options from server
│                                [Cancel]     │
└─────────────────────────────────────────────┘
```

**Tool kind icons** (from `NormalizedToolCall.kind`):
| Kind | Icon | Label |
|------|------|-------|
| `read` | 📖 | Read |
| `write` | ✏️ | Write |
| `edit` | ✏️ | Edit |
| `execute` | ⚡ | Execute |
| `search` | 🔍 | Search |
| `glob` | 📁 | Glob |
| `grep` | 🔍 | Grep |
| `unknown` | 🔧 | Tool |

#### Permission Response Hook Pattern

```typescript
function createPermissionResponder(store: ChatStore, controller: SessionController) {
  return {
    respond(requestId: number, optionId: string) {
      store.respondToPermission(requestId, optionId);     // Optimistic local update
      controller.respondToPermission(requestId, optionId); // Send to server
    },
    cancel(requestId: number) {
      controller.cancelPermission(requestId);
    },
  };
}
```

### 3.2 Thought Stack

Thoughts and tool calls are intermediate steps the agent takes between messages. They should be grouped and displayed as collapsible "thinking" sections.

#### Thought Grouping Logic (from `@acp/chat-core`)

```typescript
import {
  groupThoughtItems,
  createGroupedTimeline,
  isThoughtGroupActive,
  shouldThoughtGroupBeOpen,
  type ThoughtGroup,
} from "@acp/chat-core";
```

The `createGroupedTimeline` function produces a flat array where:
- Consecutive `thought` + `tool_call` items are merged into a `ThoughtGroup`
- `message` items break the current group
- Each group has `startTime`, `endTime`, and an `items` array

#### Group Active State

A group is "active" if the agent is currently typing or the last item in the group was created within 5 seconds:

```typescript
isThoughtGroupActive(groups, isAgentTyping);
// → true if last group's most recent item < 5s old, or if agent is typing
```

#### Auto-Expand/Collapse Logic

```typescript
shouldThoughtGroupBeOpen(
  isActive,            // Is this group currently receiving updates?
  wasActive,           // Was it active on the previous render?
  hasBeenActive,       // Has it ever been active since creation?
  defaultOpen,         // Default open state (false)
  defaultOpenWhenActive,   // Open when active (true)
  defaultOpenWhenIdle,     // Open after becoming idle (false)
);
```

**Behavior**:
1. When a thought group first appears and starts receiving items → **auto-expand** (`defaultOpenWhenActive = true`)
2. When the group finishes (agent moves on) → **auto-collapse** (`defaultOpenWhenIdle = false`)
3. If the user manually expands/collapses → **respect user choice** (override auto behavior)

#### Rendering Pattern

```
▼ Thinking...                    ← Collapsed: "Thinking..." with item count
  💭 Analyzing the codebase...
  🔧 grep("pattern", src/)       ← Individual items in the group
  🔧 read("src/index.ts")
  ✅ Complete                     ← Last item status

▲ Thinking... (3 items)          ← Expanded: shows items
```

### 3.3 Connection Management

#### Connection Lifecycle

```typescript
import { SessionController, TransportClient } from "@acp/chat-core";

// 1. Create controller with bridge URL
const controller = new SessionController("ws://localhost:8080");

// 2. Connect the WebSocket
controller.connect();
// Status: disconnected → connecting → connected

// 3. Initialize the ACP session (JSON-RPC handshake)
await controller.initialize({ name: "my-chat-ui", version: "1.0.0" });

// 4. Create or load a session
await controller.createSession("/working/directory");
// or: await controller.loadSession("existing-session-id", "/working/directory");

// 5. Send prompts
await controller.sendPrompt(sessionId, "Hello, agent!");

// 6. Clean up
controller.disconnect();
```

#### Auto-Reconnect

`TransportClient` supports automatic reconnection with exponential backoff:

```typescript
// Internal to TransportClient:
// - Default: up to 10 reconnection attempts
// - Base delay: 1000ms, max delay: 30000ms
// - Delay formula: min(baseDelay * 2^(attempt-1), maxDelay)
//   Attempt 1: 1000ms, Attempt 2: 2000ms, Attempt 3: 4000ms, etc.

// Connection status transitions:
// connected → handleClose() → reconnecting → connecting → connected
// Or after max attempts: → disconnected
```

#### Session Clearing

When loading a different session, the controller emits `"sessionClearing"` **before** the load request. This gives you a chance to reset state:

```typescript
controller.on("sessionClearing", () => {
  // Reset all normalized state
  this.normalizedState = createNormalizedState();
  // Clear active item tracking
  this.activeItemTracker.clear();
});
```

#### Cleanup Pattern

```typescript
// When your UI component unmounts:
function cleanup() {
  // 1. Unsubscribe from all controller events
  unsubscribes.forEach((unsub) => unsub());

  // 2. Destroy the store adapter (clears timers)
  store.destroy();

  // 3. Disconnect the transport
  controller.disconnect();
}
```

---

## 4. Framework-Agnostic Abstractions

### 4.1 Pure Logic Functions

These functions from `@acp/chat-core` have **zero framework dependencies** and work identically everywhere:

#### Composer Logic

| Function | Signature | Purpose |
|----------|-----------|---------|
| `shouldSendOnKeydown` | `(key, shiftKey, isComposing) → boolean` | Should Enter key trigger send? |
| `canSend` | `(ComposerState) → boolean` | Is sending currently allowed? |
| `canStop` | `(isStreaming) → boolean` | Can we cancel the current prompt? |
| `getButtonState` | `(isStreaming) → "send" \| "stop"` | Which button to show? |
| `getSendText` | `(value) → string` | Trim whitespace for sending |
| `isSendButtonDisabled` | `(value, disabled) → boolean` | Disable send button? |
| `startPrompt` | `(turnId?) → PromptLifecycleState` | Begin prompt tracking |
| `completePrompt` | `() → PromptLifecycleState` | Mark prompt as complete |
| `cancelPrompt` | `() → PromptLifecycleState` | Mark prompt as cancelled |
| `failPrompt` | `() → PromptLifecycleState` | Mark prompt as failed |
| `isPromptActive` | `(PromptLifecycleState) → boolean` | Is a prompt in progress? |
| `shouldShowStopButton` | `(lifecycle, lastItem?) → boolean` | Show stop button? |

#### Thought Stack Logic

| Function | Signature | Purpose |
|----------|-----------|---------|
| `groupThoughtItems` | `(TimelineItem[]) → ThoughtGroup[]` | Extract thought groups |
| `createGroupedTimeline` | `(TimelineItem[]) → GroupedTimelineItem[]` | Full grouped timeline |
| `isThoughtGroupActive` | `(ThoughtGroup[], isTyping) → boolean` | Is any group active? |
| `shouldThoughtGroupBeOpen` | `(isActive, wasActive, ...) → boolean` | Auto-expand/collapse |

### 4.2 Type-Based Rendering

The discriminated union pattern enables clean type-based rendering without instanceof checks:

```typescript
// Timeline items — switch on the type field
function renderTimelineItem(item: TimelineItem): VNode {
  switch (item.type) {
    case "message":
      return renderMessage(item.data);
    case "thought":
      return renderThought(item.data);
    case "tool_call":
      return renderToolCall(item.data);
    case "permission_request":
      return renderPermissionRequest(item.data);
  }
}

// Content blocks — switch on the type field
function renderContentBlock(block: ContentBlock): VNode {
  switch (block.type) {
    case "text":
      return renderMarkdown(block.text);
    case "resource":
      return renderResource(block.resource);
    case "resource_link":
      return renderResourceLink(block.resourceLink);
  }
}

// Grouped timeline — only two types after grouping
function renderGroupedItem(item: GroupedTimelineItem): VNode {
  switch (item.type) {
    case "message":
      return renderMessage(item.data);
    case "thought_group":
      return renderThoughtStack(item.data);
  }
}
```

### 4.3 Event Subscription Manager

For frameworks that need fine-grained event tracking (active items, thought lifecycle), implement a subscription manager:

```typescript
import type { SessionController } from "@acp/chat-core";

interface EventEntry {
  type: string;
  params: unknown;
  timestamp: number;
}

class EventSubscriptionManager {
  private events = new Map<string, EventEntry[]>(); // type → events
  private maxPerType = 100;
  private subscribers = new Set<() => void>();

  constructor(private controller: SessionController) {}

  subscribe(eventType: string, onStoreChange: () => void): () => void {
    // Register handler on the controller for this event type
    const unsub = this.controller.on(eventType as any, (params: unknown) => {
      const event: EventEntry = {
        type: eventType,
        params,
        timestamp: Date.now(),
      };

      const events = this.events.get(eventType) ?? [];
      events.push(event);
      if (events.length > this.maxPerType) events.shift();
      this.events.set(eventType, events);

      onStoreChange();
    });

    return unsub;
  }

  getEvents(eventType: string): EventEntry[] {
    return this.events.get(eventType) ?? [];
  }

  getLatestEvent(eventType: string): EventEntry | undefined {
    const events = this.events.get(eventType) ?? [];
    return events[events.length - 1];
  }
}
```

### 4.4 Snapshot Management

For frameworks that use reference equality to detect changes (React's `useSyncExternalStore`, Vue's shallow refs), implement snapshot caching:

```typescript
interface Snapshot {
  session: SessionControllerState;
  messages: Map<string, NormalizedMessage>;
  thoughts: Map<string, NormalizedThought>;
  toolCalls: Map<string, NormalizedToolCall>;
  permissionRequests: Map<number, NormalizedPermissionRequest>;
  timelineOrder: Array<{ type: string; id: string | number }>;
  turnIdToMessageId: Map<string, string>;
  version: number;
}

class SnapshotManager {
  private cachedSnapshot: Snapshot | null = null;
  private cachedVersion = -1;

  getSnapshot(state: NormalizedState, session: SessionControllerState, version: number): Snapshot {
    // Return cached snapshot if version hasn't changed
    if (this.cachedSnapshot && this.cachedVersion === version) {
      return this.cachedSnapshot;
    }

    // Create new snapshot (shallow copies of Maps for stability)
    this.cachedSnapshot = {
      session: { ...session },
      messages: new Map(state.messages),
      thoughts: new Map(state.thoughts),
      toolCalls: new Map(state.toolCalls),
      permissionRequests: new Map(state.permissionRequests),
      timelineOrder: [...state.timelineOrder],
      turnIdToMessageId: new Map(state.turnIdToMessageId),
      version,
    };
    this.cachedVersion = version;

    return this.cachedSnapshot;
  }

  invalidate(): void {
    this.cachedSnapshot = null;
    this.cachedVersion = -1;
  }
}
```

**Why shallow-copy Maps?** The core `applySessionUpdate` mutates Maps in place. If your framework holds a reference to the same Map instance, it won't detect changes. Shallow-copying creates a new object identity that triggers reactivity.

---

## 5. CSS Variable Theming

All ACP UI components use a CSS variable system with `--acp-*` prefix. Override these in your application's CSS to customize appearance.

### Color Variables

```css
:root {
  --acp-bg: #fff;              /* Primary background */
  --acp-bg-hover: #f0f0f0;     /* Hover state */
  --acp-color-user-bg: #e3f2fd;  /* User message bubble */
  --acp-color-agent-bg: #f5f5f5; /* Agent message bubble */
  --acp-text: #000;            /* Primary text */
  --acp-text-muted: #666;      /* Secondary text */
  --acp-border: #ccc;          /* Borders */
  --acp-accent: #0066cc;       /* Interactive elements */
}
```

### Spacing Variables

```css
:root {
  --acp-spacing-xs: 2px;    /* Minimal gaps */
  --acp-spacing-sm: 4px;    /* Small gaps */
  --acp-spacing-md: 8px;    /* Medium gaps */
  --acp-spacing-lg: 12px;   /* Large gaps */
  --acp-spacing-xl: 16px;   /* Extra-large gaps */
}
```

### Typography Variables

```css
:root {
  --acp-font-size-xs: 11px;   /* Timestamps */
  --acp-font-size-sm: 12px;   /* Labels */
  --acp-font-size-md: 13px;   /* UI text */
  --acp-font-size-lg: 14px;   /* Content */
  --acp-line-height: 1.5;     /* Standard */
  --acp-line-height-condensed: 1.4; /* Compact */
}
```

### Layout Variables

```css
:root {
  --acp-radius-sm: 3px;     /* Checkboxes */
  --acp-radius-md: 4px;     /* Buttons, inputs */
  --acp-radius-lg: 6px;     /* List rows */
  --acp-radius-xl: 8px;     /* Panels, textareas */
  --acp-radius-full: 12px;  /* Pills, toggles */
}
```

### Naming Conventions

- **CSS classes**: `acp-component__element--modifier` (BEM-ish)
  - `acp-message`, `acp-message--user`, `acp-message--agent`
  - `acp-composer`, `acp-composer__textarea`
  - `acp-settings`, `acp-settings__error`
- **Data attributes**: `data-acp-*` for test targeting
  - `data-acp-message`, `data-acp-message-role`, `data-acp-message-id`
  - `data-acp-composer`, `data-acp-send`, `data-acp-input`
  - `data-acp-thought-root`, `data-acp-thought-active`

---

## 6. Implementation Checklist

Use this checklist when building an ACP chat UI in any framework:

### Connection & Session

- [ ] Create `SessionController` with bridge URL
- [ ] Call `controller.connect()` to establish WebSocket
- [ ] Call `controller.initialize()` for ACP handshake
- [ ] Create or load a session via `createSession()` / `loadSession()`
- [ ] Handle `statusChange` events for connection status display
- [ ] Handle `sessionClearing` events to reset state on session switch
- [ ] Implement cleanup: unsubscribe all handlers + `controller.disconnect()`

### State Management

- [ ] Create store adapter wrapping `NormalizedState` + `SessionController`
- [ ] Call `createNormalizedState()` for initial state
- [ ] Subscribe to `sessionUpdate` events → call `applySessionUpdate()`
- [ ] Implement batched notification (16ms cadence) for UI updates
- [ ] Implement snapshot caching with version-based equality
- [ ] Expose selectors (getMessages, getTimeline, etc.) to UI

### Timeline & Messages

- [ ] Render timeline via `getTimeline()` or `createGroupedTimeline()`
- [ ] Handle all 4 timeline item types (message, thought, tool_call, permission_request)
- [ ] Render content blocks by type (text, resource, resource_link)
- [ ] Display message status indicators (streaming, complete, cancelled, error)
- [ ] Detect streaming state via message status
- [ ] Auto-scroll to bottom during streaming (with "scroll to bottom" affordance)

### Composer

- [ ] Use `shouldSendOnKeydown()` for keyboard handling (Enter/Shift+Enter)
- [ ] Use `canSend()` / `canStop()` for button state
- [ ] Use `getButtonState()` to toggle Send/Stop button
- [ ] Handle IME composition (set `isComposing` flag)
- [ ] Call `controller.sendPrompt()` / `controller.cancelPrompt()`
- [ ] Trim input with `getSendText()` before sending

### Thought Stack

- [ ] Use `createGroupedTimeline()` to group consecutive thoughts/tool calls
- [ ] Render thought groups as collapsible sections
- [ ] Track active items (thoughts/tool calls in progress)
- [ ] Implement auto-expand on creation, auto-collapse on completion
- [ ] Respect user manual expand/collapse preferences

### Permission Requests

- [ ] Handle `permissionRequest` events from controller
- [ ] Store permission requests in `NormalizedState`
- [ ] Render pending permission requests with option buttons
- [ ] Implement optimistic update on user response
- [ ] Call both `store.respondToPermission()` AND `controller.respondToPermission()`
- [ ] Display tool call details (kind icon, file path, command)

### Error Handling

- [ ] Subscribe to `error` events from controller
- [ ] Display transport errors in a global banner
- [ ] Wrap `sendPrompt()` / `cancelPrompt()` in try-catch
- [ ] Handle message-level errors (status = "error")
- [ ] Provide retry mechanisms where appropriate

### Styling & Testing

- [ ] Use `--acp-*` CSS variables for theming (or define equivalents)
- [ ] Add `data-acp-*` attributes for test selectors
- [ ] Test: connection lifecycle (connect, disconnect, reconnect)
- [ ] Test: message streaming (incremental content updates)
- [ ] Test: permission request flow (approve, deny, cancel)
- [ ] Test: session switching (state reset)

---

## 7. Framework Translation Table

Map React patterns to equivalent patterns in other frameworks.

### State Subscription

| React | Vanilla JS | Svelte | Vue 3 | Angular |
|-------|-----------|--------|-------|---------|
| `useSyncExternalStore(store.subscribe, store.getSnapshot)` | `store.subscribe(() => render())` | `$store` (writable store via `subscribe`) | `shallowRef(store.getSnapshot())` + `watchEffect` | `Signal<Snapshot>` |

**Vanilla JS:**
```javascript
const snapshot = store.getSnapshot();
const unsub = store.subscribe(() => {
  const newSnapshot = store.getSnapshot();
  if (newSnapshot.version !== snapshot.version) {
    Object.assign(snapshot, newSnapshot);
    render();
  }
});
```

**Svelte:**
```typescript
import { writable, derived } from "svelte/store";

const storeState = writable(store.getSnapshot());
store.subscribe(() => storeState.set(store.getSnapshot()));

const messages = derived(storeState, ($s) => Array.from($s.messages.values()));
```

**Vue 3:**
```typescript
import { shallowRef, watchEffect } from "vue";

const snapshot = shallowRef(store.getSnapshot());
store.subscribe(() => {
  snapshot.value = store.getSnapshot(); // shallowRef triggers on ref change
});
```

**Angular:**
```typescript
import { signal } from "@angular/core";

const snapshot = signal(store.getSnapshot());
store.subscribe(() => snapshot.set(store.getSnapshot()));
```

### Event Subscription

| React | Vanilla JS | Svelte | Vue 3 | Angular |
|-------|-----------|--------|-------|---------|
| `useSyncExternalStore` + `ChatEventSubscription` | `controller.on("event", handler)` | `onMount(() => controller.on(...))` | `onMounted/onUnmounted` | `ngOnInit` + `ngOnDestroy` |

**Vanilla JS:**
```javascript
const unsub = controller.on("sessionUpdate", (params) => {
  applySessionUpdate(normalizedState, params);
  render();
});
// Later: unsub();
```

**Svelte:**
```typescript
import { onMount } from "svelte";

onMount(() => {
  const unsub = controller.on("sessionUpdate", handler);
  return unsub; // Svelte calls this on unmount
});
```

**Vue 3:**
```typescript
import { onMounted, onUnmounted } from "vue";

const unsubRef = ref<() => void>();
onMounted(() => { unsubRef.value = controller.on("sessionUpdate", handler); });
onUnmounted(() => { unsubRef.value?.(); });
```

**Angular:**
```typescript
export class ChatComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject();
  private unsubs: (() => void)[] = [];

  ngOnInit() {
    this.unsubs.push(
      this.controller.on("sessionUpdate", this.handler.bind(this))
    );
  }

  ngOnDestroy() {
    this.unsubs.forEach(u => u());
  }
}
```

### Batched Notifications

| React | Vanilla JS | Svelte | Vue 3 | Angular |
|-------|-----------|--------|-------|---------|
| `setTimeout(16ms)` in AcpStore | `requestAnimationFrame` or `setTimeout(16ms)` | Svelte's batched updates (automatic) | `nextTick()` | `NgZone.run()` or `ChangeDetectorRef.detectChanges()` |

**Vanilla JS:**
```javascript
let pending = false;
function scheduleRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    render();
  });
}
```

**Vue 3:**
```typescript
import { nextTick } from "vue";

let pending = false;
function scheduleUpdate() {
  if (pending) return;
  pending = true;
  nextTick(() => {
    pending = false;
    // Vue reactivity handles the rest
  });
}
```

### Component Rendering

| React | Vanilla JS | Svelte | Vue 3 | Angular |
|-------|-----------|--------|-------|---------|
| JSX conditional render | `if/else` + DOM manipulation | `{#if}` blocks | `v-if` / `v-for` | `*ngIf` / `*ngFor` |
| `key={item.id}` | Manual DOM diffing | `{#each items as item (item.id)}` | `:key="item.id"` | `*ngFor="trackBy"` |
| `useRef` for imperative handles | Direct DOM references | `bind:this` | `ref="el"` | `@ViewChild` |

### Lifecycle

| React | Vanilla JS | Svelte | Vue 3 | Angular |
|-------|-----------|--------|-------|---------|
| `useEffect(() => { ...; return cleanup; }, [])` | `addEventListener` + `removeEventListener` | `onMount(() => { ...; return cleanup; })` | `onMounted` + `onUnmounted` | `ngOnInit` + `ngOnDestroy` |
| `useCallback` | Direct function reference | Auto-optimized | `computed` / regular functions | Regular methods |

---

## Quick Start: Minimal Implementation

Here is a complete minimal chat UI in framework-agnostic pseudocode:

```typescript
import {
  SessionController,
  createNormalizedState,
  applySessionUpdate,
  getTimeline,
  createGroupedTimeline,
  shouldSendOnKeydown,
  canSend,
  getSendText,
  getButtonState,
  getPendingPermissionRequests,
  updatePermissionRequestStatus,
} from "@acp/chat-core";
import type {
  SessionUpdateParams,
  NormalizedState,
  SessionControllerState,
} from "@acp/chat-core";

// 1. Setup
const controller = new SessionController("ws://localhost:8080");
let state = createNormalizedState();
let sessionState: SessionControllerState;
let composerValue = "";

// 2. Subscribe
controller.on("statusChange", (s) => { sessionState = s; scheduleRender(); });
controller.on("sessionUpdate", (params) => {
  applySessionUpdate(state, params as SessionUpdateParams);
  scheduleRender();
});
controller.on("sessionClearing", () => {
  state = createNormalizedState();
  scheduleRender();
});

// 3. Connect
controller.connect();
await controller.initialize({ name: "my-app", version: "1.0" });
await controller.createSession(process.cwd());

// 4. Render function (call on every state change)
function render() {
  const timeline = getTimeline(state);
  const grouped = createGroupedTimeline(timeline);
  const permissions = getPendingPermissionRequests(state);
  const isStreaming = /* check for streaming message */;

  // Render grouped timeline
  for (const item of grouped) {
    if (item.type === "message") renderMessageCard(item.data);
    if (item.type === "thought_group") renderThoughtStack(item.data);
  }

  // Render pending permission requests
  for (const req of permissions) {
    renderPermissionCard(req);
  }

  // Render composer
  renderComposer({
    value: composerValue,
    isStreaming,
    onSend: () => {
      const text = getSendText(composerValue);
      controller.sendPrompt(sessionState.sessionId!, text);
      composerValue = "";
    },
    onStop: () => {
      controller.cancelPrompt(sessionState.sessionId!);
    },
    onKeyDown: (key, shiftKey, isComposing) => {
      if (shouldSendOnKeydown(key, shiftKey, isComposing)) {
        handleSend();
      }
    },
  });
}

// 5. Batched rendering
let renderPending = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  setTimeout(() => { renderPending = false; render(); }, 16);
}

// 6. Cleanup (on app shutdown)
function destroy() {
  controller.disconnect();
}
```

This is the foundation. Add your framework's reactivity system, component model, and styling layer on top.

---

## Summary

| What | Where | Framework-Agnostic? |
|------|-------|---------------------|
| Transport (WebSocket) | `TransportClient` in `@acp/chat-core` | ✅ Yes |
| Session management | `SessionController` in `@acp/chat-core` | ✅ Yes |
| State normalization | `NormalizedState` + `applySessionUpdate` in `@acp/chat-core` | ✅ Yes |
| Selectors | `getMessages`, `getTimeline`, etc. in `@acp/chat-core` | ✅ Yes |
| Composer logic | `shouldSendOnKeydown`, `canSend`, etc. in `@acp/chat-core` | ✅ Yes |
| Thought grouping | `createGroupedTimeline`, etc. in `@acp/chat-core` | ✅ Yes |
| Store adapter (batching) | `AcpStore` in `@acp/chat-react` | ❌ React-specific — re-implement pattern |
| Event subscriptions | `ChatEventSubscription` in `@acp/chat-react` | ❌ React-specific — re-implement pattern |
| Active item tracking | `ActiveItemsSubscription` in `@acp/chat-react` | ❌ React-specific — re-implement pattern |
| UI Components | `MessageCard`, `Composer`, etc. in `@acp/chat-react` | ❌ React-specific — build your own |
| CSS Variables | `--acp-*` system in `@acp/chat-react` | ✅ Reuse the variable contract |
