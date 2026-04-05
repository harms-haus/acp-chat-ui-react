# Harness Preview System Rebuild: Replay + Live Only

## TL;DR

> **Quick Summary**: Rebuild the harness preview system from 8 demo modes down to exactly 2 modes: Replay (hybrid Rust bridge + UI with token-count based 65 tps streaming) and Live (conditional via Vite env var). Add session capture/export from live sessions and structured replay data folders with 3 demo types.
> 
> **Deliverables**:
> - New Rust bridge replay mode with token-count based 65 tps timing
> - ReplayController in harness core that sends prompts and receives streamed events
> - Simplified harness UI with Replay tab (demo type selector + session selector) and Live tab (conditional)
> - Controller-level session capture interceptor with export button
> - Structured replay data folders: `fixtures/replay-data/{demo-type}/{session-id}/`
> - Sample replay data for 3 demo types (2+ sessions each)
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: T1 (types/schema) → T4 (Rust bridge) → T5 (ReplayController) → T7 (UI rebuild) → T9 (sample data)

---

## Context

### Original Request
Plan to rebuild the "preview" system from the harness/harness ui. TWO MODES ONLY: Replay and Live. Live mode only with a flag. Replay system on harness core side, replaying REALISTIC ACP events. Each replay type has a folder of session data. Harness UI has button to convert live session to replay files. Replay mode has many options: Tool calling/thinking blocks demo, long context demo, tool calling permission request demo. Every replay type supports multiple modes/models (fake) and multiple sessions. Replay runs at ~65 tps. Each demo selectable via select in replay UI. Replay data replays JUST LIKE REAL ACP SESSION EVENTS.

### Interview Summary
**Key Discussions**:
- **Replay Architecture**: HYBRID — Rust bridge runs replay script that RESPONDS to prompts from harness UI. UI sends prompt, bridge streams replay events at 65 tps.
- **65 TPS**: Token-count based timing — count tokens in content chunks, emit at 65 tokens/second.
- **Live Mode Flag**: Vite env var (VITE_ENABLE_LIVE_MODE) — set by `pnpm debug`, absent in production builds.
- **Session Capture**: Controller-level interceptor — wrap SessionController to record all events, export button in UI.
- **Demo Types**: Exactly 3 — Tool Calling/Thinking, Long Context, Permission Request.
- **Replay Data**: Each session file contains pre-existing session data (loaded at session start) + replay events (sent after prompt).

**Research Findings**:
- Current App.tsx has 8 tabs, ~1700 lines, multiple demo controllers (createDemoController, createThoughtToolDemoController, createPermissionDemoController).
- Current replay.rs is 114 lines, simple file reader with fixed 50ms delay.
- SessionController interface in packages/acp-chat-core/src/session/controller.ts.
- Normalization store expects specific update shapes: user_message, agent_message_chunk, agent_thought_chunk, tool_call, tool_call_update, permission_request.
- BridgeEnvelope format with acp_payload, bridge_status, stderr, process_exit, replay_metadata, start_agent.

### Metis Review
**Identified Gaps** (addressed):
- **Token timing for zero-token events**: Resolved — use fixed 15ms delay for status/error events.
- **Capture boundaries**: Resolved — start = session creation, end = capture button click. Partial sessions flagged.
- **Demo data creation**: Resolved — creating sample replay data IS in scope, 2+ sessions per demo type.
- **Bridge version mismatch**: Resolved — add version check in bridge handshake.
- **Malformed replay data**: Resolved — fail fast with UI error message, don't try to fix.

---

## Work Objectives

### Core Objective
Replace the current 8-tab preview system with a clean 2-mode architecture: Replay (realistic ACP event streaming at 65 tps via Rust bridge) and Live (real ACP connection, conditional via env var).

### Concrete Deliverables
- `crates/acp-bridge/src/modes/replay_v2.rs` — New Rust bridge replay mode with token-count based timing
- `packages/acp-chat-core/src/session/replay-controller.ts` — ReplayController implementing SessionController
- `packages/acp-chat-core/src/session/capture-interceptor.ts` — Session capture interceptor
- `apps/harness/src/App.tsx` — Simplified to Replay + Live tabs only
- `apps/harness/src/components/ReplayPanel.tsx` — Replay mode UI with demo type + session selectors
- `apps/harness/src/components/LivePanel.tsx` — Live mode UI (conditional)
- `fixtures/replay-data/` — Structured replay data folders with sample data
- `package.json` — Updated debug script with VITE_ENABLE_LIVE_MODE=true

### Definition of Done
- [ ] `pnpm debug` starts harness with Replay + Live tabs, bridge in replay mode
- [ ] Replay mode: select demo type → select session → send prompt → events stream at ~65 tps
- [ ] Live mode: only visible when VITE_ENABLE_LIVE_MODE=true
- [ ] Live mode: capture button exports session to fixtures/replay-data/captured/
- [ ] All 3 demo types have 2+ sample sessions with realistic data
- [ ] `pnpm build` produces bundle without Live mode code (tree-shaken)
- [ ] `pnpm test:visual` passes with updated snapshots

### Must Have
- Token-count based timing at 65 tps (±5%)
- Replay events match live event format exactly (byte-for-byte BridgeEnvelope structure)
- Live tab hidden when VITE_ENABLE_LIVE_MODE is not set
- Session capture includes all events from session start to capture moment
- Each demo type has multiple fake modes/models and multiple sessions
- Replay data replays real ACP session events — no fakery

### Must NOT Have (Guardrails)
- No replay speed controls (fixed 65 tps)
- No replay editing or manipulation
- No multi-session simultaneous replay
- No UI for managing replay files (delete/rename)
- No analytics/telemetry collection
- No compression or encryption of replay data
- No support for importing external replay formats
- No modification to SessionController interface (wrap only)
- No modification to BridgeEnvelope format
- No modification to normalization store update shapes
- No demo modes beyond the 3 specified

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest, Playwright visual tests)
- **Automated tests**: Tests-after (implement first, then add unit tests)
- **Framework**: vitest for unit tests, Playwright for visual/E2E
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Playwright — navigate, interact, assert DOM, screenshot
- **Rust Bridge**: Bash — cargo build, cargo run, curl WebSocket, validate timing
- **TypeScript**: Bash — vitest run, tsc --noEmit

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — types, schema, config):
├── T1: Replay data schema + TypeScript types [quick]
├── T2: Replay data folder structure + sample data scaffolding [quick]
├── T3: Vite env var config + pnpm debug script update [quick]
└── T4: Capture interceptor types + interfaces [quick]

Wave 2 (After Wave 1 — Rust bridge + capture impl, parallel):
├── T5: Rust bridge replay_v2 mode with 65 tps timing [deep]
├── T6: Controller-level capture interceptor implementation [unspecified-high]
└── T7: ReplayController in harness core [deep]

Wave 3 (After Wave 2 — UI components, parallel):
├── T8: ReplayPanel component with demo type + session selectors [visual-engineering]
├── T9: LivePanel component (conditional rendering) [visual-engineering]
└── T10: App.tsx simplification — remove 6 old tabs, wire new components [quick]

Wave 4 (After Wave 3 — sample data + integration):
├── T11: Sample replay data — Tool Calling/Thinking (2 sessions) [unspecified-high]
├── T12: Sample replay data — Long Context (2 sessions) [unspecified-high]
├── T13: Sample replay data — Permission Request (2 sessions) [unspecified-high]
└── T14: Integration wiring — ReplayController ↔ Rust bridge ↔ UI [deep]

Wave 5 (After Wave 4 — tests + polish):
├── T15: Unit tests — ReplayController, capture interceptor, timing [quick]
├── T16: Visual test updates — updated snapshots for 2-tab UI [quick]
└── T17: End-to-end QA — full replay flow + live capture flow [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T5 → T7 → T8 → T14 → T17 → F1-F4 → user okay
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 4 (Waves 1, 2, 3, 4)
```

### Dependency Matrix
- **T1**: — — T5, T6, T7, T11-T13
- **T2**: — — T11-T13
- **T3**: — — T10
- **T4**: — — T6
- **T5**: T1 — T14
- **T6**: T1, T4 — T17
- **T7**: T1 — T8, T14
- **T8**: T7 — T10, T14
- **T9**: T3 — T10
- **T10**: T3, T8, T9 — T17
- **T11**: T1, T2 — T14
- **T12**: T1, T2 — T14
- **T13**: T1, T2 — T14
- **T14**: T5, T7, T8, T11-T13 — T17
- **T15**: T6, T7 — T17
- **T16**: T10 — T17
- **T17**: T6, T10, T14, T15, T16 — F1-F4

### Agent Dispatch Summary
- **Wave 1**: **4** — T1-T4 → `quick`
- **Wave 2**: **3** — T5 → `deep`, T6 → `unspecified-high`, T7 → `deep`
- **Wave 3**: **3** — T8 → `visual-engineering`, T9 → `visual-engineering`, T10 → `quick`
- **Wave 4**: **4** — T11-T13 → `unspecified-high`, T14 → `deep`
- **Wave 5**: **3** — T15-T16 → `quick`, T17 → `unspecified-high`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Replay Data Schema + TypeScript Types

  **What to do**:
  - Define TypeScript types for replay data schema in `packages/acp-chat-core/src/replay/types.ts`
  - `ReplaySessionMetadata`: demoType, sessionId, modes[], models[], capturedAt, tokenCount, eventCount
  - `ReplaySessionData`: pre-existing session state (messages, thoughts, tool calls loaded at session start)
  - `ReplayEvent`: BridgeEnvelope wrapper with pre-computed `tokenCount` field, event type discriminator
  - `ReplayManifest`: index of all available replay sessions per demo type
  - Token counting utility: `estimateTokenCount(text: string): number` (characters / 4 approximation)
  - Export all types from `@acp/chat-core`

  **Must NOT do**:
  - Modify existing BridgeEnvelope type
  - Modify normalization store types
  - Add any runtime logic — types only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definitions, no complex logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T3, T4)
  - **Blocks**: T5, T6, T7, T11-T13
  - **Blocked By**: None (can start immediately)

  **References**:
  - `packages/acp-chat-core/src/generated/BridgeEnvelope.ts` — Existing envelope types to extend/wrap
  - `packages/acp-chat-core/src/normalization/store.ts` — Update shapes that replay events must match
  - `fixtures/sample-replay.jsonl` — Current replay format for reference

  **Acceptance Criteria**:
  - [ ] `packages/acp-chat-core/src/replay/types.ts` created with all types
  - [ ] `tsc --noEmit` passes with no new errors
  - [ ] Types exported from `packages/acp-chat-core/src/index.ts`

  **QA Scenarios**:
  ```
  Scenario: Types compile cleanly
    Tool: Bash
    Steps:
      1. Run `cd packages/acp-chat-core && npx tsc --noEmit`
      2. Verify exit code 0
    Expected Result: No TypeScript errors
    Evidence: .sisyphus/evidence/task-1-types-compile.txt
  ```

  **Commit**: YES (groups with T2-T4)
  - Message: `feat(harness): add replay data schema and TypeScript types`
  - Files: `packages/acp-chat-core/src/replay/types.ts`

- [x] 2. Replay Data Folder Structure + Sample Data Scaffolding

  **What to do**:
  - Create folder structure: `fixtures/replay-data/{demo-type}/{session-id}/`
  - Three demo type folders: `tool-calling-thinking/`, `long-context/`, `permission-request/`
  - Each session folder contains:
    - `session-data.json` — pre-existing session state (messages, thoughts, etc. loaded at session start)
    - `replay-events.jsonl` — events streamed after user prompt, each line is a BridgeEnvelope with tokenCount
    - `manifest.json` — session metadata (modes, models, description, token count, event count)
  - Create empty placeholder files for each demo type (2 sessions each = 6 session folders total)
  - Create `fixtures/replay-data/captured/` folder for live session exports

  **Must NOT do**:
  - Populate actual replay data (that's T11-T13)
  - Modify existing fixtures/ files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File/folder creation with placeholder content
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3, T4)
  - **Blocks**: T11-T13
  - **Blocked By**: None

  **References**:
  - `fixtures/sample-replay.jsonl` — Current replay format reference
  - `fixtures/thought-tool-replay.jsonl` — Existing thought/tool replay for structure reference

  **Acceptance Criteria**:
  - [ ] 6 session folders created (2 per demo type)
  - [ ] Each folder has session-data.json, replay-events.jsonl, manifest.json
  - [ ] captured/ folder exists

  **QA Scenarios**:
  ```
  Scenario: Folder structure exists
    Tool: Bash
    Steps:
      1. Run `find fixtures/replay-data -type f | sort`
      2. Verify 18 files (3 files × 6 sessions)
    Expected Result: All expected files present
    Evidence: .sisyphus/evidence/task-2-folder-structure.txt
  ```

  **Commit**: YES (groups with T1, T3, T4)
  - Message: `feat(harness): create replay data folder structure`
  - Files: `fixtures/replay-data/**/*`

- [x] 3. Vite Env Var Config + pnpm Debug Script Update

  **What to do**:
  - Create `.env.development` in `apps/harness/` with `VITE_ENABLE_LIVE_MODE=true`
  - Update root `package.json` `debug` script to ensure VITE_ENABLE_LIVE_MODE is set
  - Update `apps/harness/vite.config.ts` if needed to properly expose the env var
  - Verify `pnpm build` does NOT include the env var (production builds exclude Live mode)
  - Add `import.meta.env.VITE_ENABLE_LIVE_MODE` type declaration in `apps/harness/src/env.d.ts`

  **Must NOT do**:
  - Modify production build scripts
  - Add any other env vars

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Config changes only, no logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T4)
  - **Blocks**: T9, T10
  - **Blocked By**: None

  **References**:
  - `package.json` — Current debug script
  - `apps/harness/vite.config.ts` — Vite config
  - `apps/harness/package.json` — Harness scripts

  **Acceptance Criteria**:
  - [ ] `.env.development` exists with VITE_ENABLE_LIVE_MODE=true
  - [ ] `pnpm debug` starts with Live mode available
  - [ ] `pnpm build` produces bundle without Live mode (verify via grep for "LivePanel" in output)

  **QA Scenarios**:
  ```
  Scenario: Env var is set in development
    Tool: Bash
    Steps:
      1. Run `cat apps/harness/.env.development`
      2. Verify VITE_ENABLE_LIVE_MODE=true present
    Expected Result: File contains the env var
    Evidence: .sisyphus/evidence/task-3-env-dev.txt

  Scenario: Production build excludes Live mode
    Tool: Bash
    Steps:
      1. Run `pnpm build`
      2. Run `grep -r "LivePanel" apps/harness/dist/ || echo "NOT FOUND"`
      3. Verify "NOT FOUND" output (Live mode code tree-shaken)
    Expected Result: No LivePanel references in production build
    Evidence: .sisyphus/evidence/task-3-build-check.txt
  ```

  **Commit**: YES (groups with T1, T2, T4)
  - Message: `feat(harness): add VITE_ENABLE_LIVE_MODE env var for conditional Live mode`
  - Files: `apps/harness/.env.development`, `package.json`, `apps/harness/src/env.d.ts`

- [x] 4. Capture Interceptor Types + Interfaces

  **What to do**:
  - Define `SessionCaptureInterceptor` interface in `packages/acp-chat-core/src/session/capture-interceptor.ts`
  - Interface: wraps a SessionController, records all events (sessionUpdate, statusChange, permission events)
  - `startCapture(sessionId: string): void` — begin recording
  - `stopCapture(): CapturedSession` — stop and return captured data
  - `exportCapturedSession(captured: CapturedSession, demoType: string): { sessionDataPath: string, replayEventsPath: string }` — write to fixtures/replay-data/captured/
  - `CapturedSession` type: sessionId, startTime, endTime, events[], preExistingState, modes[], models[]
  - Event serialization: convert sessionUpdate params to replay-event format with token counts

  **Must NOT do**:
  - Implement the actual interceptor logic (that's T6)
  - Modify SessionController interface

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type/interface definitions only
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3)
  - **Blocks**: T6
  - **Blocked By**: None

  **References**:
  - `packages/acp-chat-core/src/session/controller.ts` — SessionController interface to wrap
  - `packages/acp-chat-core/src/replay/types.ts` (T1 output) — Replay types to use

  **Acceptance Criteria**:
  - [ ] Interface defined with all methods
  - [ ] `tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Interface compiles cleanly
    Tool: Bash
    Steps:
      1. Run `cd packages/acp-chat-core && npx tsc --noEmit`
    Expected Result: No TypeScript errors
    Evidence: .sisyphus/evidence/task-4-interface-compile.txt
  ```

  **Commit**: YES (groups with T1, T2, T3)
  - Message: `feat(harness): add capture interceptor types and interfaces`
  - Files: `packages/acp-chat-core/src/session/capture-interceptor.ts`

- [x] 5. Rust Bridge Replay v2 Mode with 65 TPS Token Timing

  **What to do**:
  - Create `crates/acp-bridge/src/modes/replay_v2.rs` — new replay mode
  - Read replay data from `fixtures/replay-data/{demo-type}/{session-id}/`
  - On WebSocket connect: send session-data.json as initial state (batched session/update with all pre-existing messages)
  - On receiving a "session/prompt" JSON-RPC request from client: start streaming replay-events.jsonl
  - Token-count based timing: each event has `tokenCount` field; delay = (tokenCount / 65) * 1000ms
  - Zero-token events (status, errors): fixed 15ms delay
  - Large token bursts (single event > 100 tokens): split into sub-chunks of ~10 tokens each, spaced at 65 tps
  - Send replay_metadata envelope before streaming starts
  - After all events streamed: send bridge_status "ready" and keep connection open
  - Update `crates/acp-bridge/src/modes/mod.rs` to export replay_v2
  - Update `crates/acp-bridge/src/main.rs` to add `replay-v2` subcommand with `--demo-type` and `--session-id` args
  - Add version check in bridge handshake (reject if client version mismatch)

  **Must NOT do**:
  - Modify existing replay.rs (keep it for backward compat)
  - Change BridgeEnvelope format
  - Add replay speed controls

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex Rust implementation with WebSocket streaming, timing logic, and JSON parsing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6, T7)
  - **Blocks**: T14
  - **Blocked By**: T1

  **References**:
  - `crates/acp-bridge/src/modes/replay.rs` — Current replay mode to replace/enhance
  - `crates/acp-bridge/src/contract/envelope.rs` — BridgeEnvelope structure
  - `crates/acp-bridge/src/main.rs` — CLI subcommand registration
  - `packages/acp-chat-core/src/replay/types.ts` (T1 output) — Data schema

  **Acceptance Criteria**:
  - [ ] `cargo build --manifest-path crates/acp-bridge/Cargo.toml` succeeds
  - [ ] Bridge starts with `replay-v2` subcommand
  - [ ] WebSocket connection sends initial session state
  - [ ] Events stream at ~65 tps (±5%) based on token counts
  - [ ] Zero-token events use 15ms delay

  **QA Scenarios**:
  ```
  Scenario: Bridge compiles and starts
    Tool: Bash
    Steps:
      1. Run `cargo build --manifest-path crates/acp-bridge/Cargo.toml --release`
      2. Verify exit code 0
    Expected Result: Clean compilation
    Evidence: .sisyphus/evidence/task-5-cargo-build.txt

  Scenario: Replay streams at correct timing
    Tool: Bash
    Steps:
      1. Start bridge: `cargo run --manifest-path crates/acp-bridge/Cargo.toml -- replay-v2 --demo-type tool-calling-thinking --session-id session-1`
      2. Connect via websocat: `websocat ws://127.0.0.1:8765`
      3. Record timestamps of first 10 events
      4. Calculate tokens per second from event token counts
      5. Verify rate is 65 ± 5% tps
    Expected Result: Streaming rate within tolerance
    Evidence: .sisyphus/evidence/task-5-timing-test.json
  ```

  **Commit**: YES
  - Message: `feat(bridge): add replay-v2 mode with token-count based 65 tps timing`
  - Files: `crates/acp-bridge/src/modes/replay_v2.rs`, `crates/acp-bridge/src/modes/mod.rs`, `crates/acp-bridge/src/main.rs`
  - Pre-commit: `cargo build --manifest-path crates/acp-bridge/Cargo.toml`

- [x] 6. Controller-Level Capture Interceptor Implementation

  **What to do**:
  - Implement `SessionCaptureInterceptor` class in `packages/acp-chat-core/src/session/capture-interceptor.ts`
  - Wraps an existing SessionController, delegates all calls through
  - Intercepts: sendPrompt (records user message), sessionUpdate events (records all agent events), permission events
  - Maintains event log with timestamps and token counts
  - `exportCapturedSession()`: writes session-data.json + replay-events.jsonl to fixtures/replay-data/captured/{timestamp}/
  - Token counting: use `estimateTokenCount()` from T1 for each content chunk
  - Export includes: pre-existing session state, replay events, metadata (modes, models, timestamps)
  - Export button integration: expose `isCapturing`, `startCapture()`, `stopCaptureAndExport()` methods

  **Must NOT do**:
  - Modify SessionController interface
  - Modify normalization store
  - Add UI components (that's T9)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex wrapper pattern with event interception, serialization, and file export
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T5, T7)
  - **Blocks**: T17
  - **Blocked By**: T1, T4

  **References**:
  - `packages/acp-chat-core/src/session/controller.ts` — SessionController to wrap
  - `packages/acp-chat-core/src/replay/types.ts` (T1 output) — Types to use
  - `packages/acp-chat-core/src/session/capture-interceptor.ts` (T4 output) — Interface to implement

  **Acceptance Criteria**:
  - [ ] Interceptor wraps SessionController without modifying its behavior
  - [ ] All session events captured with token counts
  - [ ] Export produces valid session-data.json + replay-events.jsonl
  - [ ] Exported files match replay data schema from T1

  **QA Scenarios**:
  ```
  Scenario: Capture interceptor records events
    Tool: Bash (node REPL)
    Steps:
      1. Create mock SessionController
      2. Wrap with SessionCaptureInterceptor
      3. Call sendPrompt("test prompt")
      4. Trigger mock sessionUpdate events
      5. Call stopCaptureAndExport()
      6. Verify captured session has correct event count
    Expected Result: All events captured with token counts
    Evidence: .sisyphus/evidence/task-6-capture-test.json

  Scenario: Export produces valid replay files
    Tool: Bash
    Steps:
      1. Run capture test from above
      2. Verify session-data.json exists and is valid JSON
      3. Verify replay-events.jsonl exists and each line is valid JSON
      4. Validate against replay schema
    Expected Result: Valid replay files in fixtures/replay-data/captured/
    Evidence: .sisyphus/evidence/task-6-export-validation.txt
  ```

  **Commit**: YES
  - Message: `feat(chat-core): implement session capture interceptor`
  - Files: `packages/acp-chat-core/src/session/capture-interceptor.ts`
  - Pre-commit: `cd packages/acp-chat-core && npx tsc --noEmit`

- [x] 7. ReplayController in Harness Core

  **What to do**:
  - Create `packages/acp-chat-core/src/session/replay-controller.ts`
  - Implements SessionController interface (full implementation, not mock)
  - Connects to Rust bridge replay-v2 mode via WebSocket
  - On `connect()`: establish WebSocket connection to bridge
  - On `initialize()`: send initialize JSON-RPC
  - On `createSession()`: send session/new with demoType and sessionId params
  - On `sendPrompt()`: send session/prompt JSON-RPC — bridge responds with replay events
  - On `loadSession()`: load pre-existing session state from session-data.json, then wait for prompt
  - Manages fake modes/models: provides configurable list of modes/models for SettingsPanel
  - Emits sessionUpdate events from bridge responses (BridgeEnvelope → normalization format)
  - Handles cancelPrompt: sends session/cancel, bridge stops streaming
  - Handles permission responses: respondToPermission, cancelPermission

  **Must NOT do**:
  - Create UI components
  - Modify existing SessionController
  - Add replay speed controls

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Full SessionController implementation with WebSocket communication, event parsing, and state management
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T5, T6)
  - **Blocks**: T8, T14
  - **Blocked By**: T1

  **References**:
  - `packages/acp-chat-core/src/session/controller.ts` — SessionController interface + real implementation pattern
  - `packages/acp-chat-core/src/transport/client.ts` — TransportClient for WebSocket
  - `packages/acp-chat-core/src/normalization/store.ts` — Event shapes to emit
  - `packages/acp-chat-core/src/generated/BridgeEnvelope.ts` — Envelope parsing
  - `apps/harness/src/App.tsx:56-209` — createDemoController pattern for reference

  **Acceptance Criteria**:
  - [ ] ReplayController implements full SessionController interface
  - [ ] Connects to Rust bridge and receives replay events
  - [ ] Fake modes/models configurable and exposed via getState
  - [ ] Events normalized correctly for AcpStore consumption
  - [ ] `tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: ReplayController connects and receives events
    Tool: Bash
    Steps:
      1. Start Rust bridge in replay-v2 mode with sample data
      2. Create ReplayController pointing to bridge WebSocket
      3. Call connect(), initialize(), createSession()
      4. Call sendPrompt("test")
      5. Listen for sessionUpdate events
      6. Verify events match expected replay data
    Expected Result: Events stream at 65 tps, match replay data exactly
    Evidence: .sisyphus/evidence/task-7-replay-controller-test.json

  Scenario: Fake modes/models exposed
    Tool: Bash (node REPL)
    Steps:
      1. Create ReplayController with modes=["mode-a", "mode-b"], models=["model-x", "model-y"]
      2. Call getState()
      3. Verify modes and models are present in state
    Expected Result: Fake modes/models correctly exposed
    Evidence: .sisyphus/evidence/task-7-modes-models.txt
  ```

  **Commit**: YES
  - Message: `feat(chat-core): implement ReplayController for replay mode`
  - Files: `packages/acp-chat-core/src/session/replay-controller.ts`
  - Pre-commit: `cd packages/acp-chat-core && npx tsc --noEmit`

- [x] 8. ReplayPanel Component with Demo Type + Session Selectors

  **What to do**:
  - Create `apps/harness/src/components/ReplayPanel.tsx`
  - UI components:
    - Demo type dropdown: "Tool Calling/Thinking", "Long Context", "Permission Request"
    - Session dropdown: populated based on selected demo type (reads manifest.json from each session folder)
    - Fake mode selector: dropdown with fake modes for the selected demo type
    - Fake model selector: dropdown with fake models for the selected demo type
    - "Start Replay" button: creates ReplayController, connects to bridge, sends initial prompt
    - Connection status indicator
  - On demo type change: fetch available sessions from fixtures/replay-data/{demo-type}/
  - On session change: read manifest.json for modes/models, populate selectors
  - On "Start Replay": create ReplayController, connect to bridge at ws://127.0.0.1:8765, initialize, createSession, sendPrompt with pre-defined prompt from session data
  - Display streaming status: "Replaying...", "Complete", "Disconnected"
  - Use existing harness styling variables (--harness-accent, --harness-border, etc.)

  **Must NOT do**:
  - Modify existing demo panels
  - Add replay speed controls
  - Add session management UI

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend component with polished UI, dropdowns, state management
  - **Skills**: [`frontend-design`]
    - `frontend-design`: Domain overlap — creating distinctive, production-grade frontend interfaces with high design quality

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T9, T10)
  - **Blocks**: T10, T14
  - **Blocked By**: T7

  **References**:
  - `apps/harness/src/App.tsx:790-1118` — SessionSourceSelector component for UI patterns
  - `apps/harness/src/App.tsx:56-209` — createDemoController for reference
  - `packages/acp-chat-react/src/settings/index.tsx` — SettingsSelect component for dropdown patterns
  - `apps/harness/src/App.tsx:741-788` — ThreadPanel for layout patterns

  **Acceptance Criteria**:
  - [ ] ReplayPanel renders with demo type dropdown, session dropdown, mode/model selectors
  - [ ] Session dropdown populates based on selected demo type
  - [ ] "Start Replay" button creates ReplayController and starts streaming
  - [ ] Connection status displayed correctly
  - [ ] Component uses existing harness styling

  **QA Scenarios**:
  ```
  Scenario: ReplayPanel renders and populates selectors
    Tool: Playwright
    Steps:
      1. Navigate to harness UI with Replay tab active
      2. Verify demo type dropdown shows 3 options
      3. Select "Tool Calling/Thinking"
      4. Verify session dropdown populates with 2 sessions
      5. Select "Session 1"
      6. Verify mode/model selectors populate with fake options
    Expected Result: All selectors populated correctly
    Evidence: .sisyphus/evidence/task-8-replay-panel-render.png

  Scenario: Start Replay initiates streaming
    Tool: Playwright
    Steps:
      1. Select demo type and session
      2. Click "Start Replay"
      3. Verify connection status changes to "Connected"
      4. Verify Thread shows streaming messages
      5. Wait for replay to complete
      6. Verify status changes to "Complete"
    Expected Result: Full replay flow works end-to-end
    Evidence: .sisyphus/evidence/task-8-start-replay.png
  ```

  **Commit**: YES
  - Message: `feat(harness): add ReplayPanel component with demo type and session selectors`
  - Files: `apps/harness/src/components/ReplayPanel.tsx`
  - Pre-commit: `cd apps/harness && npx tsc --noEmit`

- [x] 9. LivePanel Component (Conditional Rendering)

  **What to do**:
  - Create `apps/harness/src/components/LivePanel.tsx`
  - Same UI as current Live tab in App.tsx (lines 907-1018): bridge URL, command, args, cwd inputs
  - Add "Capture Session" button that appears only during active live sessions
  - "Capture Session" button: calls SessionCaptureInterceptor.stopCaptureAndExport()
  - Export confirmation: shows toast/notification with exported session path
  - Component only renders when `import.meta.env.VITE_ENABLE_LIVE_MODE === 'true'`
  - When env var is not set: component returns null (tree-shakeable)
  - Use existing harness styling variables

  **Must NOT do**:
  - Modify existing live connection logic
  - Add capture UI outside of LivePanel
  - Add replay management features

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend component with conditional rendering and capture UI
  - **Skills**: [`frontend-design`]
    - `frontend-design`: Domain overlap — polished UI components

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T8, T10)
  - **Blocks**: T10
  - **Blocked By**: T3

  **References**:
  - `apps/harness/src/App.tsx:907-1018` — Current Live tab UI
  - `packages/acp-chat-core/src/session/capture-interceptor.ts` (T6 output) — Capture methods

  **Acceptance Criteria**:
  - [ ] LivePanel renders with same inputs as current Live tab
  - [ ] "Capture Session" button appears during active sessions
  - [ ] Clicking capture exports session to fixtures/replay-data/captured/
  - [ ] Component returns null when VITE_ENABLE_LIVE_MODE is not set
  - [ ] `pnpm build` tree-shakes LivePanel when env var is absent

  **QA Scenarios**:
  ```
  Scenario: LivePanel renders with env var
    Tool: Bash
    Steps:
      1. Set VITE_ENABLE_LIVE_MODE=true
      2. Start harness dev server
      3. Verify LivePanel renders
    Expected Result: LivePanel visible and functional
    Evidence: .sisyphus/evidence/task-9-live-panel-visible.png

  Scenario: LivePanel hidden without env var
    Tool: Bash
    Steps:
      1. Unset VITE_ENABLE_LIVE_MODE
      2. Start harness dev server
      3. Verify LivePanel does not render
    Expected Result: LivePanel not visible, no errors
    Evidence: .sisyphus/evidence/task-9-live-panel-hidden.png
  ```

  **Commit**: YES
  - Message: `feat(harness): add LivePanel component with session capture`
  - Files: `apps/harness/src/components/LivePanel.tsx`
  - Pre-commit: `cd apps/harness && npx tsc --noEmit`

- [x] 10. App.tsx Simplification — Remove Old Tabs, Wire New Components

  **What to do**:
  - Remove 6 old demo tabs from App.tsx: demo, thought-tool, standalone-session-list, settings-panel, slash-actions, permission
  - Keep only: Replay tab and Live tab (conditional)
  - Remove old demo controller functions: createDemoController, createThoughtToolDemoController, createPermissionDemoController
  - Wire ReplayPanel component as Replay tab content
  - Wire LivePanel component as Live tab content (conditionally rendered based on env var)
  - Update SessionSource type to only "replay" | "live"
  - Update SessionSourceSelector to only show Replay and Live tabs
  - Keep DiagnosticsPanel, PerfDisplay, ThreadPanel, ShellHeader unchanged
  - Keep SessionsSidebar unchanged
  - Update state management to work with ReplayController and Live connection

  **Must NOT do**:
  - Modify DiagnosticsPanel, PerfDisplay, ThreadPanel, ShellHeader, SessionsSidebar
  - Add new features beyond the 2-tab simplification
  - Change existing harness styling

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Cleanup and wiring task, removing old code and connecting new components
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T8, T9)
  - **Blocks**: T17, T16
  - **Blocked By**: T3, T8, T9

  **References**:
  - `apps/harness/src/App.tsx` — Full file, especially lines 32 (SessionSource type), 832-1118 (SessionSourceSelector)
  - `apps/harness/src/components/ReplayPanel.tsx` (T8 output) — New component to wire
  - `apps/harness/src/components/LivePanel.tsx` (T9 output) — New component to wire

  **Acceptance Criteria**:
  - [ ] App.tsx has only Replay and Live tabs
  - [ ] Old demo controllers removed
  - [ ] SessionSource type is "replay" | "live"
  - [ ] `pnpm dev:harness` starts without errors
  - [ ] `tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: App.tsx compiles and renders
    Tool: Bash
    Steps:
      1. Run `cd apps/harness && npx tsc --noEmit`
      2. Verify exit code 0
      3. Start dev server: `pnpm dev:harness`
      4. Verify no runtime errors in console
    Expected Result: Clean compilation and startup
    Evidence: .sisyphus/evidence/task-10-app-compile.txt

  Scenario: Only 2 tabs visible
    Tool: Playwright
    Steps:
      1. Navigate to harness UI
      2. Count visible tabs
      3. Verify exactly 2 tabs: "Replay" and "Live"
    Expected Result: Only Replay and Live tabs visible
    Evidence: .sisyphus/evidence/task-10-tabs-count.png
  ```

  **Commit**: YES
  - Message: `refactor(harness): simplify App.tsx to Replay + Live tabs only`
  - Files: `apps/harness/src/App.tsx`
  - Pre-commit: `cd apps/harness && npx tsc --noEmit`

- [x] 11. Sample Replay Data — Tool Calling/Thinking (2 Sessions)

  **What to do**:
  - Populate `fixtures/replay-data/tool-calling-thinking/session-1/` with realistic data
  - Populate `fixtures/replay-data/tool-calling-thinking/session-2/` with realistic data
  - Each session contains:
    - `session-data.json`: Pre-existing session state (empty for new sessions, or with conversation history)
    - `replay-events.jsonl`: Realistic ACP events — user_message → agent_thought_chunk → tool_call → tool_call_update → agent_thought_chunk → tool_call → tool_call_update → agent_message_chunk (done)
    - `manifest.json`: demoType="tool-calling-thinking", modes=["code-review", "debug", "explain"], models=["claude-sonnet-4", "gpt-4o", "gemini-2.5-pro"], description, tokenCount, eventCount
  - Events must match real ACP session format exactly (byte-for-byte BridgeEnvelope structure)
  - Each event must have accurate `tokenCount` field
  - Session 1: Code review scenario — reads files, finds bugs, suggests fixes
  - Session 2: Debug scenario — analyzes error, traces through code, identifies root cause
  - Pre-defined prompts for each session (sent by UI on "Start Replay")

  **Must NOT do**:
  - Modify replay data schema
  - Create events that don't match real ACP format
  - Use fake/placeholder content — must be realistic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Creating realistic, production-quality replay data requires understanding of ACP event format
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T12, T13, T14)
  - **Blocks**: T14
  - **Blocked By**: T1, T2

  **References**:
  - `fixtures/thought-tool-replay.jsonl` — Existing thought/tool replay for event format reference
  - `packages/acp-chat-core/src/normalization/store.ts` — Event shapes to match
  - `packages/acp-chat-core/src/replay/types.ts` (T1 output) — Data schema
  - `fixtures/replay-data/tool-calling-thinking/` (T2 output) — Folder structure

  **Acceptance Criteria**:
  - [ ] 2 session folders populated with realistic data
  - [ ] Each session has session-data.json, replay-events.jsonl, manifest.json
  - [ ] Events match real ACP format (validate against normalization store)
  - [ ] Token counts accurate for each event
  - [ ] Each session has 3+ fake modes and 3+ fake models

  **QA Scenarios**:
  ```
  Scenario: Session data validates against schema
    Tool: Bash (node REPL)
    Steps:
      1. Load session-data.json and validate against ReplaySessionData type
      2. Load replay-events.jsonl and validate each line against ReplayEvent type
      3. Load manifest.json and validate against ReplayManifest type
    Expected Result: All files valid against schema
    Evidence: .sisyphus/evidence/task-11-schema-validation.txt

  Scenario: Replay events match ACP format
    Tool: Bash (node REPL)
    Steps:
      1. Load replay-events.jsonl
      2. Parse each event as BridgeEnvelope
      3. Verify acp_payload events have correct update shapes
      4. Verify tokenCount field present on each event
    Expected Result: All events match ACP format
    Evidence: .sisyphus/evidence/task-11-acp-format-validation.txt
  ```

  **Commit**: YES
  - Message: `feat(harness): add Tool Calling/Thinking sample replay data (2 sessions)`
  - Files: `fixtures/replay-data/tool-calling-thinking/**/*`

- [x] 12. Sample Replay Data — Long Context (2 Sessions)

  **What to do**:
  - Populate `fixtures/replay-data/long-context/session-1/` with realistic data
  - Populate `fixtures/replay-data/long-context/session-2/` with realistic data
  - Each session contains session-data.json, replay-events.jsonl, manifest.json
  - manifest.json: demoType="long-context", modes=["analyze", "summarize", "extract"], models=["claude-sonnet-4", "gpt-4o", "gemini-2.5-pro"]
  - Session 1: Large codebase analysis — agent reads multiple files, provides comprehensive analysis
  - Session 2: Documentation generation — agent reads source files, generates detailed documentation
  - Events should include many agent_thought_chunk events (simulating long reasoning), multiple tool calls, and substantial agent_message_chunk content
  - Higher token counts per event to demonstrate long context handling

  **Must NOT do**:
  - Modify replay data schema
  - Use unrealistic or trivial content

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Creating realistic long-context replay data
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T11, T13, T14)
  - **Blocks**: T14
  - **Blocked By**: T1, T2

  **References**:
  - `fixtures/replay-data/long-context/` (T2 output) — Folder structure
  - `fixtures/replay-data/tool-calling-thinking/` (T11 output) — Reference for event format

  **Acceptance Criteria**:
  - [ ] 2 session folders populated with realistic long-context data
  - [ ] Events demonstrate extended reasoning (many thought chunks)
  - [ ] Higher token counts per event than tool-calling sessions
  - [ ] Each session has 3+ fake modes and 3+ fake models

  **QA Scenarios**:
  ```
  Scenario: Long context session validates
    Tool: Bash (node REPL)
    Steps:
      1. Load and validate all files against schema
      2. Verify token counts are higher than tool-calling sessions
      3. Verify event count reflects long context (many thought chunks)
    Expected Result: Valid long-context replay data
    Evidence: .sisyphus/evidence/task-12-validation.txt
  ```

  **Commit**: YES
  - Message: `feat(harness): add Long Context sample replay data (2 sessions)`
  - Files: `fixtures/replay-data/long-context/**/*`

- [x] 13. Sample Replay Data — Permission Request (2 Sessions)

  **What to do**:
  - Populate `fixtures/replay-data/permission-request/session-1/` with realistic data
  - Populate `fixtures/replay-data/permission-request/session-2/` with realistic data
  - Each session contains session-data.json, replay-events.jsonl, manifest.json
  - manifest.json: demoType="permission-request", modes=["write", "execute", "network"], models=["claude-sonnet-4", "gpt-4o", "gemini-2.5-pro"]
  - Session 1: File write permission — agent wants to modify a file, requests permission, user allows, agent proceeds
  - Session 2: Network access permission — agent wants to make HTTP request, requests permission, user denies, agent handles gracefully
  - Events must include: agent_thought_chunk → tool_call (status: "pending_permission") → permission_request → (allow/deny) → tool_call_update → agent_message_chunk
  - Both allow and deny flows demonstrated across the 2 sessions

  **Must NOT do**:
  - Modify replay data schema
  - Skip permission events — must demonstrate full permission flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Creating realistic permission flow replay data
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T11, T12, T14)
  - **Blocks**: T14
  - **Blocked By**: T1, T2

  **References**:
  - `fixtures/replay-data/permission-request/` (T2 output) — Folder structure
  - `apps/harness/src/App.tsx:393-646` — createPermissionDemoController for event flow reference
  - `packages/acp-chat-core/src/normalization/store.ts` — Permission request event shapes

  **Acceptance Criteria**:
  - [ ] 2 session folders populated with realistic permission flow data
  - [ ] Session 1 demonstrates allow flow, Session 2 demonstrates deny flow
  - [ ] Permission events match real ACP format
  - [ ] Each session has 3+ fake modes and 3+ fake models

  **QA Scenarios**:
  ```
  Scenario: Permission flow validates
    Tool: Bash (node REPL)
    Steps:
      1. Load and validate all files against schema
      2. Verify permission_request events present
      3. Verify tool_call has status "pending_permission"
      4. Verify both allow and deny flows demonstrated
    Expected Result: Valid permission flow replay data
    Evidence: .sisyphus/evidence/task-13-validation.txt
  ```

  **Commit**: YES
  - Message: `feat(harness): add Permission Request sample replay data (2 sessions)`
  - Files: `fixtures/replay-data/permission-request/**/*`

- [x] 14. Integration Wiring — ReplayController ↔ Rust Bridge ↔ UI

  **What to do**:
  - Wire ReplayController to Rust bridge replay-v2 mode
  - Update `pnpm debug` script to start bridge in replay-v2 mode by default (instead of dynamic)
  - Ensure ReplayPanel's "Start Replay" button correctly triggers the full flow:
    1. User selects demo type + session
    2. ReplayController connects to bridge at ws://127.0.0.1:8765
    3. Bridge reads session data from fixtures/replay-data/{demo-type}/{session-id}/
    4. Bridge sends initial session state on connect
    5. UI sends prompt (from session manifest)
    6. Bridge streams replay events at 65 tps
    7. UI displays streaming messages in Thread
  - Test full end-to-end flow with all 3 demo types
  - Verify token timing is accurate (65 ± 5% tps)
  - Verify fake modes/models appear correctly in SettingsPanel

  **Must NOT do**:
  - Add new features
  - Modify replay data
  - Change UI components

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex integration task requiring understanding of full stack (Rust bridge, TypeScript controller, React UI)
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T5, T7, T8, T11-T13)
  - **Parallel Group**: Wave 4 (sequential after parallel tasks)
  - **Blocks**: T17
  - **Blocked By**: T5, T7, T8, T11, T12, T13

  **References**:
  - All previous task outputs
  - `package.json` — debug script to update
  - `crates/acp-bridge/src/main.rs` — Bridge CLI entry point

  **Acceptance Criteria**:
  - [ ] Full replay flow works: select demo → select session → start replay → events stream at 65 tps
  - [ ] All 3 demo types work end-to-end
  - [ ] Fake modes/models appear in SettingsPanel
  - [ ] `pnpm debug` starts bridge in replay-v2 mode
  - [ ] Token timing accurate (65 ± 5% tps)

  **QA Scenarios**:
  ```
  Scenario: Full replay flow — Tool Calling/Thinking
    Tool: Playwright
    Steps:
      1. Start `pnpm debug`
      2. Navigate to harness UI
      3. Select "Tool Calling/Thinking" demo type
      4. Select "Session 1"
      5. Click "Start Replay"
      6. Verify Thread shows user message, thought chunks, tool calls, tool results, agent message
      7. Verify streaming completes
      8. Screenshot final state
    Expected Result: Full replay flow works with correct event types
    Evidence: .sisyphus/evidence/task-14-tool-calling-replay.png

  Scenario: Full replay flow — Permission Request (allow)
    Tool: Playwright
    Steps:
      1. Select "Permission Request" demo type
      2. Select "Session 1" (allow flow)
      3. Click "Start Replay"
      4. Verify permission request appears in Thread
      5. Verify tool call executes after permission
      6. Verify agent message completes
    Expected Result: Permission allow flow works
    Evidence: .sisyphus/evidence/task-14-permission-allow.png

  Scenario: Token timing accuracy
    Tool: Bash
    Steps:
      1. Start replay with known token counts
      2. Record event timestamps
      3. Calculate actual tps
      4. Verify 65 ± 5%
    Expected Result: Timing within tolerance
    Evidence: .sisyphus/evidence/task-14-timing-accuracy.json
  ```

  **Commit**: YES
  - Message: `feat(harness): wire ReplayController to Rust bridge and UI`
  - Files: `package.json`, `apps/harness/src/App.tsx`, `apps/harness/src/components/ReplayPanel.tsx`
  - Pre-commit: `pnpm test`

- [x] 15. Unit Tests — ReplayController, Capture Interceptor, Timing

  **What to do**:
  - Create unit tests for ReplayController: connection, session lifecycle, event handling, cancel
  - Create unit tests for SessionCaptureInterceptor: event recording, export, token counting
  - Create unit tests for token timing utility: estimateTokenCount, delay calculation
  - Tests use vitest framework
  - Mock WebSocket connections for ReplayController tests
  - Mock SessionController for capture interceptor tests
  - Test edge cases: zero-token events, large token bursts, empty sessions

  **Must NOT do**:
  - Add E2E tests (that's T17)
  - Modify implementation code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard unit test writing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T16, T17)
  - **Blocks**: T17
  - **Blocked By**: T6, T7

  **References**:
  - `packages/acp-chat-core/src/session/replay-controller.ts` (T7 output)
  - `packages/acp-chat-core/src/session/capture-interceptor.ts` (T6 output)
  - `packages/acp-chat-core/src/replay/types.ts` (T1 output)
  - `vitest.config.ts` — Vitest configuration
  - Existing test files for patterns

  **Acceptance Criteria**:
  - [ ] ReplayController unit tests: 80%+ coverage
  - [ ] CaptureInterceptor unit tests: 80%+ coverage
  - [ ] Token timing tests: 100% coverage
  - [ ] `pnpm test` passes

  **QA Scenarios**:
  ```
  Scenario: All unit tests pass
    Tool: Bash
    Steps:
      1. Run `pnpm test`
      2. Verify all tests pass
      3. Check coverage report
    Expected Result: All tests pass, coverage thresholds met
    Evidence: .sisyphus/evidence/task-15-test-output.txt
  ```

  **Commit**: YES (groups with T16)
  - Message: `test(chat-core): add unit tests for replay controller and capture interceptor`
  - Files: `packages/acp-chat-core/src/__tests__/replay-controller.test.ts`, `packages/acp-chat-core/src/__tests__/capture-interceptor.test.ts`
  - Pre-commit: `pnpm test`

- [x] 16. Visual Test Updates — Updated Snapshots for 2-Tab UI

  **What to do**:
  - Update Playwright visual tests to reflect new 2-tab UI
  - Remove visual tests for old demo tabs (demo, thought-tool, standalone-session-list, settings-panel, slash-actions, permission)
  - Add visual tests for ReplayPanel: default state, demo type selected, session selected, streaming in progress, complete
  - Add visual tests for LivePanel: default state, connected, capturing
  - Update baseline snapshots
  - Run `pnpm test:visual:update` to generate new baselines

  **Must NOT do**:
  - Modify test infrastructure
  - Add new test categories

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Visual test maintenance task
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T15, T17)
  - **Blocks**: T17
  - **Blocked By**: T10

  **References**:
  - Existing Playwright visual test files in apps/harness/
  - `apps/harness/package.json` — test:visual script
  - `apps/harness/src/App.tsx` (T10 output) — Simplified 2-tab UI

  **Acceptance Criteria**:
  - [ ] Visual tests pass with new baselines
  - [ ] No references to old demo tabs in tests
  - [ ] New ReplayPanel and LivePanel visual tests added

  **QA Scenarios**:
  ```
  Scenario: Visual tests pass
    Tool: Bash
    Steps:
      1. Run `pnpm test:visual`
      2. Verify all tests pass
    Expected Result: All visual tests pass
    Evidence: .sisyphus/evidence/task-16-visual-tests.txt
  ```

  **Commit**: YES (groups with T15)
  - Message: `test(harness): update visual tests for 2-tab UI`
  - Files: `apps/harness/tests/**/*.spec.ts`, `apps/harness/tests/snapshots/**/*`
  - Pre-commit: `pnpm test:visual`

- [x] 17. End-to-End QA — Full Replay Flow + Live Capture Flow

  **What to do**:
  - Manual end-to-end testing of complete replay flow:
    1. Start `pnpm debug`
    2. Test all 3 demo types with both sessions each
    3. Verify token timing visually (streaming feels right)
    4. Verify fake modes/models work in SettingsPanel
    5. Verify connection status updates correctly
  - Manual end-to-end testing of live capture flow (if VITE_ENABLE_LIVE_MODE=true):
    1. Connect to live ACP agent
    2. Send prompts, receive responses
    3. Click "Capture Session"
    4. Verify exported files in fixtures/replay-data/captured/
    5. Switch to Replay tab, verify captured session appears
    6. Replay captured session, verify it works
  - Test edge cases: rapid tab switching, disconnect during replay, missing replay data
  - Document any issues found

  **Must NOT do**:
  - Fix implementation bugs (report them instead)
  - Modify code

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive manual QA requiring full stack understanding
  - **Skills**: [`playwright`] (if available)
    - `playwright`: Domain overlap — browser automation for QA scenarios

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all previous tasks)
  - **Parallel Group**: Wave 5 (runs after T15, T16)
  - **Blocks**: F1-F4
  - **Blocked By**: T6, T10, T14, T15, T16

  **References**:
  - All previous task outputs
  - QA scenarios from all tasks

  **Acceptance Criteria**:
  - [ ] All 6 replay sessions (2 per demo type) work end-to-end
  - [ ] Live capture flow works (if env var set)
  - [ ] Captured sessions replay correctly
  - [ ] Edge cases handled gracefully
  - [ ] No console errors during any flow

  **QA Scenarios**:
  ```
  Scenario: Complete replay flow — all demo types
    Tool: Playwright
    Steps:
      1. Start `pnpm debug`
      2. For each demo type (tool-calling-thinking, long-context, permission-request):
         a. Select demo type
         b. For each session (session-1, session-2):
            i. Select session
            ii. Click "Start Replay"
            iii. Verify streaming starts
            iv. Wait for completion
            v. Screenshot final state
            vi. Disconnect
    Expected Result: All 6 sessions replay correctly
    Evidence: .sisyphus/evidence/task-17-all-replays/ (6 screenshots)

  Scenario: Live capture and replay
    Tool: Playwright
    Steps:
      1. Start `pnpm debug` (with VITE_ENABLE_LIVE_MODE=true)
      2. Switch to Live tab
      3. Connect to live agent (or mock)
      4. Send 2 prompts
      5. Click "Capture Session"
      6. Switch to Replay tab
      7. Select "captured" demo type
      8. Select captured session
      9. Click "Start Replay"
      10. Verify replay works
    Expected Result: Captured session replays correctly
    Evidence: .sisyphus/evidence/task-17-capture-replay.png

  Scenario: Edge case — rapid tab switching during replay
    Tool: Playwright
    Steps:
      1. Start replay
      2. Rapidly switch between Replay and Live tabs
      3. Verify no errors, replay continues or pauses gracefully
    Expected Result: No crashes, graceful handling
    Evidence: .sisyphus/evidence/task-17-edge-rapid-switch.txt
  ```

  **Commit**: NO (QA task only)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1 (T1-T4)**: `feat(harness): add replay data schema, folder structure, env var, and capture types`
  - Files: `packages/acp-chat-core/src/replay/types.ts`, `fixtures/replay-data/**/*`, `apps/harness/.env.development`, `package.json`, `apps/harness/src/env.d.ts`, `packages/acp-chat-core/src/session/capture-interceptor.ts`
  - Pre-commit: `cd packages/acp-chat-core && npx tsc --noEmit`

- **Wave 2 (T5-T7)**: Separate commits per task
  - T5: `feat(bridge): add replay-v2 mode with token-count based 65 tps timing`
  - T6: `feat(chat-core): implement session capture interceptor`
  - T7: `feat(chat-core): implement ReplayController for replay mode`

- **Wave 3 (T8-T10)**: Separate commits per task
  - T8: `feat(harness): add ReplayPanel component with demo type and session selectors`
  - T9: `feat(harness): add LivePanel component with session capture`
  - T10: `refactor(harness): simplify App.tsx to Replay + Live tabs only`

- **Wave 4 (T11-T14)**: Separate commits per task
  - T11: `feat(harness): add Tool Calling/Thinking sample replay data (2 sessions)`
  - T12: `feat(harness): add Long Context sample replay data (2 sessions)`
  - T13: `feat(harness): add Permission Request sample replay data (2 sessions)`
  - T14: `feat(harness): wire ReplayController to Rust bridge and UI`

- **Wave 5 (T15-T16)**: `test: add unit tests and update visual tests for replay system`

---

## Success Criteria

### Verification Commands
```bash
cd packages/acp-chat-core && npx tsc --noEmit  # Expected: no errors
cargo build --manifest-path crates/acp-bridge/Cargo.toml  # Expected: clean build
pnpm test  # Expected: all tests pass
pnpm test:visual  # Expected: all visual tests pass
pnpm debug  # Expected: harness starts with Replay + Live tabs, bridge in replay-v2 mode
pnpm build  # Expected: production build without Live mode code
```

### Final Checklist
- [ ] All "Must Have" present (token timing, live mode flag, session capture, 3 demo types, fake modes/models)
- [ ] All "Must NOT Have" absent (no speed controls, no replay editing, no multi-session, no analytics)
- [ ] All tests pass (unit + visual)
- [ ] Replay streams at 65 ± 5% tps
- [ ] Live mode only visible with VITE_ENABLE_LIVE_MODE=true
- [ ] Session capture exports valid replay files
- [ ] All 6 sample sessions replay correctly
- [ ] Production build tree-shakes Live mode
