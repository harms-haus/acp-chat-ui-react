# ACP Terminals Capability — Implementation Outline

**Date:** 2026-04-28
**Scope:** Add terminals capability to acp-chat-core following the ACP standard
**User Decisions:** Wire up only `terminal: boolean` in initialize, fix Transport interface for raw JSON-RPC responses, test-after strategy, single commit at end, no git worktree

---

## Tasks

### Task 1: Define Terminal Handler Types and Subscription Interface

Create the type definitions for terminal operations, including request/response interfaces for each terminal method (create, output, wait_for_exit, kill, release), handler function type aliases, and a TerminalSubscription interface with an unsubscribe method. These types wrap the existing SDK types from @agentclientprotocol/sdk into the handler pattern used by this codebase.

**Dependencies:** None
**Parallel with:** Task 3

---

### Task 2: Implement TerminalSubscriptionManager

Build the TerminalSubscriptionManager class that stores and manages handler subscriptions for each terminal operation. It follows the same Map-based storage, auto-incrementing ID, and subscription-return pattern as FileSystemSubscriptionManager. Provides subscribe methods for each terminal operation and getter methods that return copies of registered handler arrays.

**Dependencies:** Task 1 (needs the types defined)
**Parallel with:** None (blocks on Task 1)

---

### Task 3: Fix Transport Interface for Raw JSON-RPC Response Sending

Extend the Transport interface and its implementations to support sending raw JSON-RPC response and error objects. This is a prerequisite for both terminal and existing filesystem capability response delivery to work correctly. The current sendJsonRpcResponse and sendJsonRpcErrorResponse methods only emit traffic events and log warnings without actually transmitting data.

**Dependencies:** None
**Parallel with:** Task 1

---

### Task 4: Integrate Terminals into SessionController

Wire terminal support into SessionController: instantiate the TerminalSubscriptionManager in the constructor, add public subscribe-to-terminal-operation delegation methods, add dispatch branches in handleAcpPayload for each terminal method (terminal/create, terminal/output, terminal/wait_for_exit, terminal/kill, terminal/release), and implement the private handler methods that validate requests, execute subscribed handlers, and send responses. Also update the initialize() method to accept a `terminal: boolean` option and include it in the clientCapabilities sent to the agent.

**Dependencies:** Task 1 (types), Task 2 (manager), Task 3 (transport fix)
**Parallel with:** None (blocks on Tasks 1, 2, and 3)

---

### Task 5: Write Terminal Tests

Write tests for the TerminalSubscriptionManager (standalone unit tests covering subscribe, unsubscribe, multiple handlers, and handler getter behavior) and integration tests for the SessionController terminal handling (covering each terminal method dispatch, handler execution, validation/error cases, and the terminal capability wire-up in initialize). Follow the test-after strategy — implementation is complete before these are written.

**Dependencies:** Task 4 (all terminal code must be implemented)
**Parallel with:** None (blocks on Task 4)

---

### Task 6: Update Package Exports

Add terminal type and TerminalSubscriptionManager exports to the root src/index.ts barrel file. Follow the existing filesystem export pattern: type-only exports for all interfaces and handler types, value export for the manager class, organized under a terminal section comment with .js extension in import paths.

**Dependencies:** Task 1 (types), Task 2 (manager), Task 4 (integration confirms everything works)
**Parallel with:** None (blocks on Tasks 1, 2, and 4)

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
