# Draft: Event Stream System + Follow Feature Fix

## Date: 2026-04-07

---

## Current Architecture Understanding

### Core Data Types (from store.ts)

**NormalizedMessage** (HAS status):
```typescript
interface NormalizedMessage {
  id: string;
  role: "user" | "agent";
  status: "streaming" | "complete" | "cancelled" | "error";
  content: string;
  // ...
}
```

**NormalizedThought** (NO status - PROBLEM):
```typescript
interface NormalizedThought {
  id: string;
  content: string;
  turnId?: string;
  createdAt?: number;
  updatedAt?: number;
}
// No status field - "active" inferred by position
```

**NormalizedToolCall** (HAS status):
```typescript
interface NormalizedToolCall {
  toolCallId: string;
  kind: ToolCallKind;
  status: "pending" | "completed";  // Has explicit status
  // ...
}
```

### Current "Follow" Feature (Broken)

**Location**: ThoughtStack.tsx (lines 389-561)

**Current isActive Logic**:
- Thoughts: "completed" when not the last item in group
- Tool calls: "completed" when status === "done" || "completed"
- Thought groups: "active" based on `isThoughtGroupActive()` helper (5-second window)

**Why It's Broken**:
1. Thoughts don't have explicit status - relies on position heuristics
2. Race conditions: completion detected after next item arrives
3. No event-driven state transitions - all reactive/polling
4. Tool call responses can arrive out of order - not handled
5. Cross-component state management is complex

---

## Required Event Types (from user request)

1. **New User Message submitted** - data: full text, time, etc
2. **User cancel** - user stopped/cancelled
3. **New thought started** - First stream data arrived for a thought
4. **Thought update** - New stream data arrived for existing thought
5. **Thought ended** - Stream data stopped / next event arrived
6. **Tool Use Request** - Tool call initiated
7. **Tool Use Permission request** - Permission needed
8. **User's Tool Use Permission response** - User granted/denied permission
9. **Tool Response arrives** - Tool call completed (can arrive out of order!)
10. **Message start** - Streaming message began
11. **Message update** - Streamed updated data
12. **Message Complete** - Message status is "completed"
13. **Progress update** - "Working on it..." type message

---

## Event Stream Design Patterns (Research Findings)

### Recommended Architecture

1. **Event Bus Pattern** (RxJS-based):
   - Use `ReplaySubject` for event buffering
   - Type-safe event envelopes with metadata
   - Sequence numbers for ordering

2. **Event Ordering**:
   - Assign sequence numbers per entity type
   - Buffer out-of-order events (especially tool responses)
   - Drain buffer when gaps are filled

3. **React Integration**:
   - Observable hooks pattern
   - Context provider for event bus
   - Batched updates (16ms default)

4. **Thought Status Tracking**:
   - Add explicit "status" field to NormalizedThought
   - Emit events: thought:start, thought:update, thought:end
   - Derived state from event stream

---

## Research Findings: Why "Follow" Is Broken

### Problem Analysis (from deep investigation)

**Problem A**: `isActive` only updates when `timelineItems` array changes reference. Once a thought group's items are complete and no new items arrive, `isActive` never transitions from `true → false`.

**Problem B**: Thoughts have no status field. Unlike `NormalizedToolCall` which has `status: "pending" | "completed"`, thoughts can only be inferred as "done" by position.

**Problem C**: The follow auto-open/auto-collapse logic fights itself. `isActive` may never become `false`, and when it does flip, it's often too late.

**Problem D**: Item creation detection is based on `useRef` tracking inside `useEffect`, firing **after render** — always one frame behind.

**Problem E**: `hasEmittedCreated` flag prevents re-triggering. If component re-mounts (virtualization), the flag resets but the thought is no longer "new".

**Problem F**: `isThoughtGroupActive()` helper exists but is **unused**. Thread.tsx reimplements logic inline.

### What Event System Needs to Provide

1. **Per-thought streaming events**: `thought:start`, `thought:chunk`, `thought:complete`
2. **Per-tool-call lifecycle events**: `tool_call:start`, `tool_call:complete`
3. **Group-level active state**: Computed from whether any item in group is streaming
4. **Reactive state**: Push-based instead of pull-based from timeline array

---

## Requirements Confirmed

1. **Thought Status**: ADD `status: "streaming" | "complete"` to `NormalizedThought`
2. **Event System**: REPLACE existing SessionController events with new event stream
3. **Out-of-order**: NO special buffering - emit as-is, consumers handle ordering
4. **Follow Behavior**: Auto-expand thought stack when active, auto-expand individual items when active, auto-collapse when inactive (unless user interacted)

## Technical Decisions Made

- Event stream will be the single source of truth for state transitions
- Thoughts will have explicit status tracking
- Tool responses emitted immediately regardless of order
- React components will subscribe to event stream for real-time updates
- Follow feature will use event-based active detection instead of heuristics

---

## Scope Boundaries

**INCLUDE**:
- Event stream system in acp-chat-core
- Event types and event bus implementation
- React hooks for consuming events
- Updated ThoughtStack to use event-based active state
- Follow feature fix using event stream

**EXCLUDE** (for now):
- UI styling changes
- Message component updates (unless necessary)
- Major refactoring of normalization layer

