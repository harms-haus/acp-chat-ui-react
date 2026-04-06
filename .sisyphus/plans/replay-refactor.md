# Replay System Refactoring: v1 Deletion & v2 Consolidation

## TL;DR

> **Quick Summary**: Delete dead v1 replay code and consolidate the Rust bridge server to support only two modes: **replay-only** (default) or **replay + live** (with `--live` flag). Implement WebSocket initialization protocol where clients send an init payload to select mode after connection.
> 
> **Deliverables**:
> - v1 replay code completely removed from Rust bridge
> - Unified server mode with `--live` flag support
> - WebSocket init/disconnect protocol implemented
> - Updated frontend (ReplayPanel + LivePanel) for new protocol
> - `pnpm debug` configured with `--live` flag
> 
> **Estimated Effort**: Medium-Large (refactoring + protocol change)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Delete v1 → Refactor modes → WebSocket protocol → Frontend updates

---

## Context

### Original Request
User wants to clean up the replay system by:
1. Deleting v1 replay code (dead code)
2. Refactoring v2 replay to be the only replay implementation
3. Consolidating server to two modes: replay-only (default) or replay+live (--live flag)
4. Implementing WebSocket initialization protocol
5. Updating UI to work with new protocol

### Interview Summary
**Key Decisions**:
- **Server Mode A (Neutral)**: Server waits for init payload to determine mode
- **Live Security**: Live mode only enabled with `--live` flag; reject live init otherwise
- **Replay Selection**: Script name + session ID (e.g., "tool-calling-thinking/session-1")
- **UI**: Keep existing Replay and Live tabs
- **Live Params**: Only command, args, cwd (minimal for testing)

**Research Findings**:
- v1 replay: `/home/blake/Documents/software/acp-react-chat-ui/crates/acp-bridge/src/modes/replay.rs` (114 lines, simple delay-based)
- v2 replay: `/home/blake/Documents/software/acp-react-chat-ui/crates/acp-bridge/src/modes/replay_v2.rs` (674 lines, 65 TPS token-based)
- Current modes: dynamic, proxy, replay (v1), replay-v2 (v2)
- 3 existing replay scripts: tool-calling-thinking, long-context, permission-request
- WebSocket uses JSON-RPC protocol over tokio-tungstenite

### Metis Review
**Identified Gaps** (addressed in plan):
- Feature parity validation: v2 must handle all v1 scenarios
- Code reference audit: must verify zero v1 references before deletion
- WebSocket protocol versioning: add protocol version to handshake
- Performance baseline: establish 65 TPS measurement
- Edge cases: double init, invalid JSON, missing fields, timeouts
- Scope lock-down: no UI changes beyond protocol, no new features

---

## Work Objectives

### Core Objective
Delete v1 replay code and consolidate the Rust bridge server into a unified architecture supporting only replay (default) or replay+live (--live) modes, with a WebSocket initialization protocol for mode selection.

### Concrete Deliverables
1. **v1 Code Removal**: All v1 replay code deleted with zero references remaining
2. **Unified Server Mode**: Single server binary with `--live` flag
3. **WebSocket Protocol**: Init/disconnect payload handling
4. **Frontend Updates**: ReplayPanel and LivePanel updated
5. **Build Configuration**: `pnpm debug` with --live flag

### Definition of Done
```bash
# Server starts in neutral mode
cargo run --bin acp-bridge

# Server accepts --live flag
cargo run --bin acp-bridge -- --live

# All tests pass
cargo test --workspace && pnpm test

# 65 TPS maintained
./scripts/benchmark-replay.sh  # Should show ~65 TPS

# Zero v1 references
grep -r "replay::" crates/acp-bridge/src/  # Should find only v2
```

### Must Have
- v1 replay code completely removed
- `--live` flag enables live mode
- WebSocket init payload: replay mode (script + session ID)
- WebSocket init payload: live mode (command, args, cwd) - only if --live
- Proper error responses for invalid init
- Disconnect payload cleans up resources
- Frontend sends correct init payloads
- `pnpm debug` runs with --live
- 65 TPS performance maintained
- All 3 replay scripts work

### Must NOT Have (Guardrails)
- NO v1 code remaining after deletion
- NO changes to replay script format
- NO modifications to the 3 existing scripts
- NO new UI features beyond protocol updates
- NO authentication or authorization changes
- NO performance optimization beyond maintaining 65 TPS
- NO changes to acp-chat-core/acp-chat-react beyond what's necessary
- NO additional server modes beyond replay and replay+live

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Rust: cargo test, TypeScript: pnpm test)
- **Automated tests**: Tests-after (existing tests updated, new tests for protocol)
- **Framework**: Rust built-in test, TypeScript Vitest/Jest
- **Agent QA**: Every task includes agent-executable QA scenarios

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Rust backend**: cargo test + cargo build + runtime verification
- **TypeScript frontend**: pnpm build + Playwright browser testing
- **Integration**: End-to-end WebSocket protocol testing with curl/websocat
- **Performance**: Benchmark scripts to verify 65 TPS

**Evidence**: All QA evidence saved to `.sisyphus/evidence/task-{N}-{scenario}.{ext}`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Validation & Safety):
├── Task 1: Validate v2 feature parity with v1
├── Task 2: Audit all v1 code references
├── Task 3: Create backup branch
└── Task 4: Establish performance baseline (65 TPS)

Wave 2 (Core Rust - Delete & Refactor):
├── Task 5: Delete v1 replay module
├── Task 6: Refactor server modes (unified entry)
├── Task 7: Implement --live flag
├── Task 8: Create WebSocket init protocol
├── Task 9: Implement disconnect protocol
└── Task 10: Update Cargo.toml and exports

Wave 3 (Frontend - Protocol Updates):
├── Task 11: Update WebSocket client for init protocol
├── Task 12: Update ReplayPanel initialization
├── Task 13: Update LivePanel initialization
└── Task 14: Add error handling for mode rejection

Wave 4 (Integration & Config):
├── Task 15: Update pnpm debug with --live flag
├── Task 16: Update package.json scripts
├── Task 17: Test all 3 replay scripts end-to-end
└── Task 18: Verify live mode with --live flag

Wave FINAL (Review & Cleanup):
├── Task F1: Final reference check (zero v1 refs)
├── Task F2: Performance verification (65 TPS)
├── Task F3: Integration test suite run
└── Task F4: Documentation update
-> Present results -> Get user okay

Critical Path: T1 → T5 → T6 → T8 → T11 → T17 → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 2)
```

### Agent Dispatch Summary

- **Wave 1**: 4 tasks → `deep` category (validation requires thoroughness)
- **Wave 2**: 6 tasks → `quick` + `unspecified-high` (Rust changes)
- **Wave 3**: 4 tasks → `quick` + `visual-engineering` (TypeScript/React)
- **Wave 4**: 4 tasks → `quick` + `unspecified-high` (integration)
- **Wave FINAL**: 4 tasks → `oracle` + `unspecified-high` (review)

---

## TODOs

> Implementation + Verification = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE.**

- [x] 1. Validate v2 replay feature parity with v1

  **What to do**:
  - Compare v1 (`crates/acp-bridge/src/modes/replay.rs`) and v2 (`crates/acp-bridge/src/modes/replay_v2.rs`) implementations
  - Identify all v1 features and ensure v2 has equivalent functionality
  - Document any gaps or differences
  - Test v2 with all 3 existing scripts to confirm they work

  **Must NOT do**:
  - Do not modify any code during validation
  - Do not assume v2 is complete without verification

  **Recommended Agent Profile**:
  - **Category**: `deep` (thorough analysis required)
  - **Skills**: []
  - **Skills Evaluated**: None needed for analysis

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T3, T4)
  - **Blocks**: Task 5 (Delete v1)
  - **Blocked By**: None

  **References**:
  - `crates/acp-bridge/src/modes/replay.rs` - v1 implementation
  - `crates/acp-bridge/src/modes/replay_v2.rs` - v2 implementation
  - `fixtures/replay-data/` - Test scripts

  **Acceptance Criteria**:
  - [ ] Document comparing v1 vs v2 features created
  - [ ] All 3 replay scripts tested with v2
  - [ ] Feature parity confirmed or gaps documented

  **QA Scenarios**:
  ```
  Scenario: Verify v2 handles all v1 scenarios
    Tool: Bash
    Preconditions: Clean checkout, all scripts present
    Steps:
      1. Read v1 replay.rs - extract all features (timing, protocol, errors)
      2. Read v2 replay_v2.rs - extract all features
      3. Compare feature lists - mark parity status
      4. Run v2 with tool-calling-thinking/session-1
      5. Run v2 with long-context/session-1
      6. Run v2 with permission-request/session-1
    Expected Result: All scripts execute successfully, feature parity documented
    Failure Indicators: Script fails or feature missing in v2
    Evidence: .sisyphus/evidence/task-1-feature-parity.md
  ```

  **Commit**: YES
  - Message: `chore(replay): validate v2 feature parity with v1`
  - Files: `docs/v1-v2-comparison.md` (new documentation)

- [x] 2. Audit all v1 replay code references

  **What to do**:
  - Search entire monorepo for v1 replay references
  - Use `lsp_find_references` and `grep` comprehensively
  - Check: imports, exports, CLI commands, documentation, comments
  - Create list of all files that reference v1 replay

  **Must NOT do**:
  - Do not delete anything yet
  - Do not miss any references (be exhaustive)

  **Recommended Agent Profile**:
  - **Category**: `deep` (must be thorough)
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `crates/acp-bridge/src/modes/replay.rs` - Starting point
  - `crates/acp-bridge/src/main.rs` - CLI entry
  - `crates/acp-bridge/src/server/mod.rs` - Server routing
  - `crates/acp-bridge/src/modes/mod.rs` - Module exports

  **Acceptance Criteria**:
  - [ ] Complete list of v1 references created
  - [ ] Each reference categorized (import, usage, CLI, doc)
  - [ ] Zero surprises in later deletion phase

  **QA Scenarios**:
  ```
  Scenario: Exhaustive v1 reference search
    Tool: Bash
    Preconditions: None
    Steps:
      1. grep -r "modes::replay[^_]" crates/acp-bridge/src/ (exclude v2)
      2. grep -r "replay::" crates/acp-bridge/src/
      3. grep -r "ReplayMode" crates/acp-bridge/src/
      4. Check main.rs for replay CLI command
      5. Check server/mod.rs for mode routing
      6. Check modes/mod.rs for exports
      7. Check Cargo.toml for dependencies
      8. Check any documentation files
    Expected Result: Complete inventory of v1 references
    Evidence: .sisyphus/evidence/task-2-reference-audit.md
  ```

  **Commit**: YES
  - Message: `chore(replay): audit v1 code references`
  - Files: `docs/v1-references.md`

- [x] 3. Create backup branch for v1 replay

  **What to do**:
  - Create Git branch `backup/replay-v1-before-deletion`
  - Push to remote for safety
  - Document branch purpose

  **Must NOT do**:
  - Do not delete code without backup
  - Do not skip this step

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - Git repository root

  **Acceptance Criteria**:
  - [ ] Branch created: `backup/replay-v1-before-deletion`
  - [ ] Branch pushed to remote
  - [ ] Branch documented

  **QA Scenarios**:
  ```
  Scenario: Verify backup branch exists
    Tool: Bash
    Steps:
      1. git checkout -b backup/replay-v1-before-deletion
      2. git push origin backup/replay-v1-before-deletion
      3. git log --oneline -3
    Expected Result: Branch created with current HEAD
    Evidence: .sisyphus/evidence/task-3-backup-branch.txt
  ```

  **Commit**: NO (branch creation only)

- [x] 4. Establish 65 TPS performance baseline

  **What to do**:
  - Create benchmark script to measure replay TPS
  - Run against all 3 scripts
  - Record baseline metrics (TPS, memory, latency)
  - Document measurement methodology

  **Must NOT do**:
  - Do not optimize - just measure
  - Do not change code to improve metrics

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task F2 (Final performance verification)
  - **Blocked By**: None

  **References**:
  - `crates/acp-bridge/src/modes/replay_v2.rs` - Contains 65 TPS logic
  - `scripts/` - For new benchmark script

  **Acceptance Criteria**:
  - [ ] Benchmark script created: `scripts/benchmark-replay.sh`
  - [ ] All 3 scripts measured
  - [ ] Baseline documented: TPS, memory, latency

  **QA Scenarios**:
  ```
  Scenario: Measure v2 replay performance
    Tool: Bash
    Steps:
      1. Create benchmark script that:
         - Starts replay-v2 server
         - Connects WebSocket
         - Times replay execution
         - Calculates TPS (events / time)
         - Measures memory usage
      2. Run against tool-calling-thinking/session-1
      3. Run against long-context/session-1
      4. Run against permission-request/session-1
      5. Record results
    Expected Result: TPS ~65 for all scripts, baseline documented
    Evidence: .sisyphus/evidence/task-4-baseline-results.md
  ```

  **Commit**: YES
  - Message: `chore(replay): establish 65 TPS performance baseline`
  - Files: `scripts/benchmark-replay.sh`, `docs/performance-baseline.md`

- [x] 5. Delete v1 replay module and references

  **What to do**:
  - Delete `crates/acp-bridge/src/modes/replay.rs`
  - Remove v1 CLI command from `main.rs`
  - Remove v1 mode routing from `server/mod.rs`
  - Remove v1 export from `modes/mod.rs`
  - Update any remaining references

  **Must NOT do**:
  - Do not delete shared utilities (extract first if needed)
  - Do not leave any v1 references

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (must complete Wave 1 first)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6, 7, 8, 9
  - **Blocked By**: Task 1, 2, 3, 4

  **References**:
  - `crates/acp-bridge/src/modes/replay.rs` - DELETE
  - `crates/acp-bridge/src/main.rs` - Lines 40-47, 92-100
  - `crates/acp-bridge/src/server/mod.rs` - Lines 53-58, 79
  - `crates/acp-bridge/src/modes/mod.rs` - Line 10

  **Acceptance Criteria**:
  - [ ] v1 replay.rs deleted
  - [ ] Zero v1 references in codebase
  - [ ] `cargo build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Verify v1 deletion complete
    Tool: Bash
    Steps:
      1. rm crates/acp-bridge/src/modes/replay.rs
      2. Edit main.rs - remove v1 command match arm
      3. Edit server/mod.rs - remove v1 mode routing
      4. Edit modes/mod.rs - remove v1 export
      5. grep -r "modes::replay[^_]" crates/ (should be empty)
      6. cargo build --release --bin acp-bridge
    Expected Result: Build succeeds, zero v1 references
    Evidence: .sisyphus/evidence/task-5-v1-deleted.txt
  ```

  **Commit**: YES
  - Message: `refactor(bridge): remove v1 replay module`
  - Files: All v1 files removed, references updated

- [x] 6. Refactor server to unified mode with --live flag

  **What to do**:
  - Refactor `main.rs` to support single mode: unified server
  - Add `--live` CLI flag using clap
  - Store flag in server config/state
  - Remove old mode selection (dynamic, proxy, replay-v2 as separate modes)
  - Create unified mode that handles both replay and live

  **Must NOT do**:
  - Do not keep old separate modes
  - Do not make --live default (security)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential with T5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 7, 8, 9
  - **Blocked By**: Task 5

  **References**:
  - `crates/acp-bridge/src/main.rs` - CLI entry
  - `crates/acp-bridge/src/server/mod.rs` - Server state
  - Clap documentation for flag handling

  **Acceptance Criteria**:
  - [ ] `--live` flag added to CLI
  - [ ] Flag stored in server state
  - [ ] Old mode commands removed (dynamic, proxy, replay-v2 as separate)
  - [ ] `cargo run --bin acp-bridge -- --help` shows flag

  **QA Scenarios**:
  ```
  Scenario: Verify --live flag works
    Tool: Bash
    Steps:
      1. Edit main.rs - add --live flag with clap
      2. Create unified server mode
      3. Store live_enabled in server state
      4. Remove old mode match arms
      5. cargo build --release
      6. ./target/release/acp-bridge --help | grep -q "live"
      7. ./target/release/acp-bridge --live &
      8. sleep 1 && curl http://localhost:8765/health (if exists)
    Expected Result: --live flag present, server starts
    Evidence: .sisyphus/evidence/task-6-live-flag.txt
  ```

  **Commit**: YES
  - Message: `feat(bridge): unify server modes with --live flag`
  - Files: `main.rs`, `server/mod.rs`, new unified mode

- [x] 7. Implement WebSocket initialization protocol

  **What to do**:
  - Server waits indefinitely for init payload on WebSocket connect (no timeout)
  - Support two init types:
    - `{"type":"init","mode":"replay","script":"tool-calling-thinking","sessionId":"session-1"}`
    - `{"type":"init","mode":"live","command":"...","args":["..."],"cwd":"..."}` (only if --live)
  - Validate payload fields
  - Reject live init if --live not enabled: `{"error":"live mode not enabled"}`
  - Success response: `{"status":"success","mode":"replay|live"}`
  - After disconnect, server remains open for new connections

  **Must NOT do**:
  - Do not accept messages before init
  - Do not allow mode switching after init
  - Do not timeout waiting for init

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 9, T11
  - **Blocked By**: Task 6

  **References**:
  - `crates/acp-bridge/src/server/mod.rs` - WebSocket handling
  - `crates/acp-bridge/src/modes/replay_v2.rs` - JSON-RPC handling
  - ACP protocol docs

  **Acceptance Criteria**:
  - [ ] Server accepts init payload after connect (waits indefinitely)
  - [ ] Replay init loads specified script
  - [ ] Live init rejected without --live flag
  - [ ] Success response sent on valid init
  - [ ] Server remains open after disconnect for new connections
  - [ ] No timeout for init payload

  **QA Scenarios**:
  ```
  Scenario: Test WebSocket init protocol
    Tool: Bash (websocat)
    Steps:
      1. Start server: cargo run --bin acp-bridge
      2. Connect: websocat ws://127.0.0.1:8765
      3. Send replay init: {"type":"init","mode":"replay","script":"tool-calling-thinking","sessionId":"session-1"}
      4. Expect: {"status":"success","mode":"replay"}
      5. Start server with --live
      6. Send live init: {"type":"init","mode":"live","command":"echo","args":["hello"],"cwd":"/tmp"}
      7. Expect: {"status":"success","mode":"live"}
      8. Start server without --live
      9. Send live init
      10. Expect: {"error":"live mode not enabled"}
    Expected Result: All init scenarios work correctly
    Evidence: .sisyphus/evidence/task-7-init-protocol.log
  ```

  **Commit**: YES
  - Message: `feat(bridge): implement WebSocket init protocol`
  - Files: `server/mod.rs`, init handler module

- [x] 8. Implement WebSocket disconnect protocol

  **What to do**:
  - Handle `{"type":"disconnect"}` payload
  - For replay mode: halt replay script, unload, clean up resources
  - For live mode: stop ACP agent, clean up process
  - Response: `{"status":"success"}` or `{"error":"..."}`
  - Ensure proper resource cleanup
  - **Server remains open after disconnect** - WebSocket connection stays alive for new init

  **Must NOT do**:
  - Do not leave resources dangling
  - Do not ignore disconnect errors
  - Do not close WebSocket connection on disconnect (keep open for re-init)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 9, T11
  - **Blocked By**: Task 7

  **References**:
  - `crates/acp-bridge/src/modes/replay_v2.rs` - Cleanup logic
  - `crates/acp-bridge/src/modes/dynamic.rs` - Agent process management

  **Acceptance Criteria**:
  - [ ] Disconnect payload handled
  - [ ] Replay resources cleaned up
  - [ ] Live agent process terminated
  - [ ] Success/error response sent
  - [ ] WebSocket connection remains open after disconnect
  - [ ] New init can be sent after disconnect

  **QA Scenarios**:
  ```
  Scenario: Test disconnect protocol
    Tool: Bash (websocat)
    Steps:
      1. Connect and init replay mode
      2. Send disconnect: {"type":"disconnect"}
      3. Expect: {"status":"success"}
      4. Verify replay halted (check process list)
      5. Send NEW init with different script: {"type":"init","mode":"replay","script":"long-context","sessionId":"session-1"}
      6. Expect: {"status":"success","mode":"replay"}
      7. Verify new replay started
      8. Connect and init live mode (with --live)
      9. Send disconnect
      10. Expect: {"status":"success"}
      11. Verify agent process terminated
      12. Send NEW init (replay or live)
      13. Expect success - connection still open
    Expected Result: Clean disconnect with proper cleanup, connection stays open
    Evidence: .sisyphus/evidence/task-8-disconnect-protocol.log
  ```

  **Commit**: YES
  - Message: `feat(bridge): implement WebSocket disconnect protocol`
  - Files: `server/mod.rs`, disconnect handler

- [x] 9. Update Cargo.toml and module exports

  **What to do**:
  - Remove v1 mode from Cargo.toml if referenced
  - Update `modes/mod.rs` to remove v1 export
  - Ensure all dependencies still resolve
  - Clean up any unused imports

  **Must NOT do**:
  - Do not break dependency resolution
  - Do not leave unused dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Task 5

  **References**:
  - `crates/acp-bridge/Cargo.toml`
  - `crates/acp-bridge/src/modes/mod.rs`

  **Acceptance Criteria**:
  - [ ] Cargo.toml updated
  - [ ] modes/mod.rs exports updated
  - [ ] `cargo check` passes
  - [ ] `cargo build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Verify Cargo/module cleanup
    Tool: Bash
    Steps:
      1. Edit Cargo.toml - remove any v1-specific deps
      2. Edit modes/mod.rs - remove v1 pub mod
      3. cargo check --workspace
      4. cargo build --release
    Expected Result: Clean build, no warnings
    Evidence: .sisyphus/evidence/task-9-cargo-clean.txt
  ```

  **Commit**: YES
  - Message: `chore(bridge): update Cargo.toml and module exports`
  - Files: `Cargo.toml`, `modes/mod.rs`

- [x] 10. Integrate replay_v2 into unified server mode

  **What to do**:
  - Refactor replay_v2 to work with new init protocol
  - Make replay_v2 a module that can be invoked after init
  - Update replay_v2 to accept script/session from init payload
  - Ensure 65 TPS timing preserved

  **Must NOT do**:
  - Do not break 65 TPS timing
  - Do not change replay event format

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 17
  - **Blocked By**: Task 6, 7, 9

  **References**:
  - `crates/acp-bridge/src/modes/replay_v2.rs` - Full file
  - New unified server mode

  **Acceptance Criteria**:
  - [ ] replay_v2 integrated into unified mode
  - [ ] Accepts script/session from init
  - [ ] 65 TPS timing preserved
  - [ ] All 3 scripts work

  **QA Scenarios**:
  ```
  Scenario: Test replay_v2 integration
    Tool: Bash (websocat)
    Steps:
      1. Start unified server
      2. Connect WebSocket
      3. Send init: {"type":"init","mode":"replay","script":"tool-calling-thinking","sessionId":"session-1"}
      4. Expect replay events at ~65 TPS
      5. Measure timing between events
      6. Verify all events received
    Expected Result: Replay works at 65 TPS
    Evidence: .sisyphus/evidence/task-10-replay-v2-integration.log
  ```

  **Commit**: YES
  - Message: `refactor(bridge): integrate replay_v2 into unified mode`
  - Files: `modes/replay_v2.rs`, unified mode

- [x] 11. Update TypeScript WebSocket client for init protocol

  **What to do**:
  - Update `packages/acp-chat-core/src/transport/client.ts`
  - Add method to send init payload after connect
  - Support replay init: `initReplay(script, sessionId)`
  - Support live init: `initLive(command, args, cwd)` (if enabled)
  - Handle init response (success/error)
  - Add disconnect method

  **Must NOT do**:
  - Do not auto-send init on connect (let caller decide)
  - Do not change existing connection logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after T7, T8)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 12, 13, 14
  - **Blocked By**: Task 7, 8

  **References**:
  - `packages/acp-chat-core/src/transport/client.ts` - WebSocket client
  - New init protocol spec

  **Acceptance Criteria**:
  - [ ] `initReplay(script, sessionId)` method added
  - [ ] `initLive(command, args, cwd)` method added
  - [ ] `disconnect()` method added
  - [ ] Promise-based responses for init
  - [ ] Error handling for init failures

  **QA Scenarios**:
  ```
  Scenario: Test TypeScript init methods
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Create test page that:
         - Creates WebSocket client
         - Calls client.initReplay("tool-calling-thinking", "session-1")
         - Asserts success response
         - Calls client.disconnect()
         - Asserts success
      2. Test live init with --live server
      3. Test live init rejection without --live
    Expected Result: All init/disconnect methods work
    Evidence: .sisyphus/evidence/task-11-client-init.png
  ```

  **Commit**: YES
  - Message: `feat(core): update WebSocket client for init protocol`
  - Files: `transport/client.ts`

- [x] 12. Update ReplayPanel for new protocol

  **What to do**:
  - Update `apps/harness/src/components/ReplayPanel.tsx`
  - On connect, send replay init payload with selected script
  - Handle init response (show error if script invalid)
  - Update disconnect to use new protocol
  - Remove old replay-specific connection logic

  **Must NOT do**:
  - Do not change UI layout (keep tabs)
  - Do not change script selection UI

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17
  - **Blocked By**: Task 11

  **References**:
  - `apps/harness/src/components/ReplayPanel.tsx`
    - Lines with connection logic
    - Script selection handling
  - New init protocol

  **Acceptance Criteria**:
  - [ ] ReplayPanel sends init payload on connect
  - [ ] Handles script selection in init
  - [ ] Shows error for invalid script
  - [ ] Uses disconnect protocol on unmount
  - [ ] TypeScript compiles without errors

  **QA Scenarios**:
  ```
  Scenario: Test ReplayPanel with new protocol
    Tool: Playwright
    Preconditions: Server running, ReplayPanel mounted
    Steps:
      1. Select "tool-calling-thinking" and "session-1"
      2. Click Connect
      3. Verify init payload sent: {"type":"init","mode":"replay","script":"tool-calling-thinking","sessionId":"session-1"}
      4. Verify replay events received
      5. Click Disconnect
      6. Verify disconnect payload sent
    Expected Result: Full replay flow works
    Evidence: .sisyphus/evidence/task-12-replay-panel.png
  ```

  **Commit**: YES
  - Message: `feat(harness): update ReplayPanel for new protocol`
  - Files: `components/ReplayPanel.tsx`

- [x] 13. Update LivePanel for new protocol

  **What to do**:
  - Update `apps/harness/src/components/LivePanel.tsx`
  - On connect, send live init payload with command/args/cwd
  - Handle init rejection (server without --live)
  - Update disconnect to use new protocol
  - Remove old dynamic mode connection logic

  **Must NOT do**:
  - Do not change UI layout
  - Do not add new fields (keep command, args, cwd only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18
  - **Blocked By**: Task 11

  **References**:
  - `apps/harness/src/components/LivePanel.tsx`
    - Connection logic
    - Command/args/cwd inputs

  **Acceptance Criteria**:
  - [ ] LivePanel sends init payload on connect
  - [ ] Handles init rejection (shows "Live mode not enabled")
  - [ ] Uses disconnect protocol on unmount
  - [ ] TypeScript compiles without errors

  **QA Scenarios**:
  ```
  Scenario: Test LivePanel with new protocol
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Enter command: "echo", args: ["hello"], cwd: "/tmp"
      2. Click Connect (server with --live)
      3. Verify init payload sent with params
      4. Verify live session works
      5. Click Disconnect
      6. Test with server without --live
      7. Verify error shown: "Live mode not enabled on server"
    Expected Result: Live mode works with --live, rejected without
    Evidence: .sisyphus/evidence/task-13-live-panel.png
  ```

  **Commit**: YES
  - Message: `feat(harness): update LivePanel for new protocol`
  - Files: `components/LivePanel.tsx`

- [x] 14. Add error handling for mode rejection

  **What to do**:
  - Add user-friendly error messages for init failures
  - Show "Live mode not enabled on server" when appropriate
  - Show "Script not found: {name}" for invalid script
  - Add toast notifications or inline error display
  - Ensure errors are clear and actionable

  **Must NOT do**:
  - Do not use generic error messages
  - Do not ignore error cases

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 12, 13

  **References**:
  - Error handling patterns in existing code
  - Toast notification component (if exists)

  **Acceptance Criteria**:
  - [ ] Specific error for live mode rejection
  - [ ] Specific error for invalid script
  - [ ] User-friendly error messages
  - [ ] Errors visible in UI

  **QA Scenarios**:
  ```
  Scenario: Test error messages
    Tool: Playwright
    Steps:
      1. Try live mode on server without --live
      2. Verify error: "Live mode not enabled on server. Start server with --live flag."
      3. Try replay with invalid script name
      4. Verify error: "Script not found: invalid-script"
      5. Try replay with invalid session ID
      6. Verify error: "Session not found: invalid-session"
    Expected Result: Clear, specific error messages
    Evidence: .sisyphus/evidence/task-14-error-handling.png
  ```

  **Commit**: YES
  - Message: `feat(harness): add error handling for mode rejection`
  - Files: `components/ReplayPanel.tsx`, `components/LivePanel.tsx`

- [x] 15. Update package.json scripts for unified server

  **What to do**:
  - Update root `package.json` scripts
  - Remove old mode-specific scripts (dev:bridge-replay, dev:bridge-live)
  - Add unified server script: `dev:bridge`
  - Update scripts to use new unified mode
  - Ensure paths and ports are correct

  **Must NOT do**:
  - Do not break existing dev workflow
  - Do not change ports without checking

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 16
  - **Blocked By**: Task 6

  **References**:
  - `/home/blake/Documents/software/acp-react-chat-ui/package.json` - Scripts section
  - Current scripts: `dev:bridge-replay`, `dev:bridge-live`, `debug`

  **Acceptance Criteria**:
  - [ ] Old scripts removed
  - [ ] New unified script added
  - [ ] Ports consistent (8765 for unified)
  - [ ] Scripts documented

  **QA Scenarios**:
  ```
  Scenario: Verify package.json scripts
    Tool: Bash
    Steps:
      1. Edit package.json
      2. Remove: dev:bridge-replay, dev:bridge-live
      3. Add: dev:bridge="cargo run --bin acp-bridge -- --addr 127.0.0.1:8765"
      4. cat package.json | grep -A5 '"scripts"'
    Expected Result: Clean scripts section
    Evidence: .sisyphus/evidence/task-15-package-scripts.txt
  ```

  **Commit**: YES
  - Message: `chore(config): update package.json scripts for unified server`
  - Files: `package.json`

- [x] 16. Configure pnpm debug with --live flag

  **What to do**:
  - Update `debug` script in `package.json`
  - Should start: harness UI + unified server with --live
  - Example: `"debug": "concurrently 'VITE_ENABLE_LIVE_MODE=true pnpm dev:harness' 'cargo run --bin acp-bridge -- --live'"`
  - Ensure correct port alignment

  **Must NOT do**:
  - Do not change default behavior of other scripts
  - Do not break concurrent execution

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 18
  - **Blocked By**: Task 15

  **References**:
  - `/home/blake/Documents/software/acp-react-chat-ui/package.json`
  - `package.json` line 16: Current debug script

  **Acceptance Criteria**:
  - [ ] `pnpm debug` starts both harness and server with --live
  - [ ] LivePanel works in debug mode
  - [ ] ReplayPanel also works in debug mode

  **QA Scenarios**:
  ```
  Scenario: Test pnpm debug
    Tool: Bash
    Steps:
      1. pnpm debug &
      2. sleep 5
      3. curl http://localhost:4173 (harness UI)
      4. Test WebSocket to 8765
      5. Verify server started with --live
      6. pkill -f "pnpm debug"
    Expected Result: Both services start, ports accessible
    Evidence: .sisyphus/evidence/task-16-pnpm-debug.txt
  ```

  **Commit**: YES
  - Message: `chore(config): update pnpm debug with --live flag`
  - Files: `package.json`

- [x] 17. Test all 3 replay scripts end-to-end

  **What to do**:
  - Run complete end-to-end test for each script:
    - tool-calling-thinking/session-1
    - long-context/session-1
    - permission-request/session-1
  - Test with unified server (no --live)
  - Verify all events received correctly
  - Verify 65 TPS maintained
  - Document any issues

  **Must NOT do**:
  - Do not skip any scripts
  - Do not ignore timing issues

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential testing)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task F2, F3
  - **Blocked By**: Task 10, 12

  **References**:
  - `fixtures/replay-data/` - All scripts
  - Test harness from Task 4

  **Acceptance Criteria**:
  - [ ] All 3 scripts execute successfully
  - [ ] All events received correctly
  - [ ] 65 TPS timing verified
  - [ ] No errors in logs

  **QA Scenarios**:
  ```
  Scenario: End-to-end replay test
    Tool: Playwright + Bash
    Steps:
      For each script in [tool-calling-thinking, long-context, permission-request]:
        1. Start unified server
        2. Open harness UI
        3. Select script and session-1
        4. Click Connect
        5. Wait for replay to complete
        6. Verify all events displayed
        7. Measure TPS (should be ~65)
        8. Take screenshot
      9. Generate report
    Expected Result: All 3 scripts pass
    Evidence: .sisyphus/evidence/task-17-e2e-replay/
  ```

  **Commit**: YES
  - Message: `test(integration): verify all replay scripts work`
  - Files: Test reports

- [x] 18. Verify live mode with --live flag

  **What to do**:
  - Test live mode functionality:
    - Start server with --live
    - Connect via LivePanel
    - Execute simple command (echo)
    - Verify agent communication
    - Test disconnect
  - Test rejection without --live
  - Document any issues

  **Must NOT do**:
  - Do not use complex commands (keep it simple)
  - Do not skip rejection test

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: Task F3
  - **Blocked By**: Task 13, 16

  **References**:
  - LivePanel implementation
  - Server with --live flag

  **Acceptance Criteria**:
  - [ ] Live mode works with --live flag
  - [ ] Live mode rejected without --live flag
  - [ ] Error message shown correctly
  - [ ] Disconnect works properly

  **QA Scenarios**:
  ```
  Scenario: Live mode verification
    Tool: Playwright + Bash
    Steps:
      1. Start server WITHOUT --live
      2. Try live mode in UI
      3. Verify error: "Live mode not enabled"
      4. Stop server
      5. Start server WITH --live
      6. Connect live mode
      7. Execute echo command
      8. Verify output received
      9. Disconnect
      10. Verify cleanup
    Expected Result: Live mode works only with --live
    Evidence: .sisyphus/evidence/task-18-live-mode/
  ```

  **Commit**: YES
  - Message: `test(integration): verify live mode with --live flag`
  - Files: Test reports

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **v1 Reference Check** — `oracle`
  Search entire codebase for any v1 replay references. Verify zero references remain. Check: `grep -r "replay::" crates/`, `grep -r "ReplayMode" src/`, check all imports and exports. Output: `v1 References [0 found] | VERDICT: PASS/FAIL`

- [x] F2. **Performance Verification** — `unspecified-high`
  Run benchmark on all 3 replay scripts. Verify 65 TPS ± 5%. Check: TPS measurement, memory usage, latency. Output: `TPS [65.2 avg] | Memory [baseline] | Latency [p99 < 100ms] | VERDICT`

- [x] F3. **Integration Test Suite** — `unspecified-high`
  Run full integration: connect → init → execute → disconnect for all modes. Test: replay mode (all 3 scripts), live mode (with --live), live rejection (without --live). Output: `Tests [12/12 PASS] | VERDICT`

- [x] F4. **Scope Compliance Check** — `deep`
  Verify no scope creep: check no v1 code, no script changes, no extra UI features, no auth changes, no unrelated refactors. Output: `Scope [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

**Wave 1 commits** (Validation):
- `chore(replay): validate v2 feature parity with v1`
- `chore(replay): audit v1 code references`
- `chore(replay): create backup branch backup/replay-v1`
- `chore(replay): establish 65 TPS performance baseline`

**Wave 2 commits** (Rust Core):
- `refactor(bridge): remove v1 replay module`
- `feat(bridge): unify server modes with --live flag`
- `feat(bridge): implement WebSocket init protocol`
- `feat(bridge): implement WebSocket disconnect protocol`

**Wave 3 commits** (Frontend):
- `feat(harness): update WebSocket client for init protocol`
- `feat(harness): update ReplayPanel for new protocol`
- `feat(harness): update LivePanel for new protocol`
- `feat(harness): add mode rejection error handling`

**Wave 4 commits** (Integration):
- `chore(config): update pnpm debug with --live flag`
- `test(integration): verify all replay scripts work`
- `test(integration): verify live mode with --live flag`

**Final commits** (Cleanup):
- `docs(replay): update protocol documentation`
- `docs(readme): update getting started guide`

---

## Success Criteria

### Verification Commands

```bash
# 1. Zero v1 references
grep -r "modes::replay[^_]" crates/acp-bridge/src/ && echo "FAIL: v1 refs found" || echo "PASS: no v1 refs"

# 2. Server builds
cargo build --release --bin acp-bridge

# 3. Tests pass
cargo test --workspace

# 4. 65 TPS maintained
./scripts/benchmark-replay.sh

# 5. All replay scripts work
./scripts/test-replay-scripts.sh

# 6. Live mode works with --live flag
cargo run --bin acp-bridge -- --live &
./scripts/test-live-mode.sh

# 7. Live mode rejects without --live flag
cargo run --bin acp-bridge &
./scripts/test-live-rejection.sh

# 8. Frontend builds
pnpm build

# 9. Frontend tests pass
pnpm test
```

### Final Checklist
- [ ] All "Must Have" items present
- [ ] All "Must NOT Have" items absent (guardrails respected)
- [ ] All 3 replay scripts execute successfully
- [ ] 65 TPS performance maintained
- [ ] Zero v1 code references
- [ ] WebSocket init protocol working
- [ ] Live mode requires --live flag
- [ ] Disconnect protocol working
- [ ] Frontend updated for new protocol
- [ ] Documentation updated
