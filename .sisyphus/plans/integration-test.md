# Integration Test: Long-Context Replay Event Verification

## TL;DR

> **Quick Summary**: Create a new `packages/integration-tests/` package with a Vitest-based integration test that spawns the Rust bridge, runs the long-context replay, and verifies event ordering. This will definitively determine if event stream issues are in `acp-chat-core` or `acp-chat-react`.
>
> **Deliverables**:
> - `packages/integration-tests/` package with `package.json`, `tsconfig.json`, vitest config
> - `packages/integration-tests/src/long-context-replay.test.ts` - Main integration test
> - `packages/integration-tests/src/helpers/bridge.ts` - Bridge subprocess management helper
> - `packages/integration-tests/src/helpers/websocket-polyfill.ts` - WebSocket polyfill for Node
>
> **Estimated Effort**: Medium (4-6 tasks)
> **Parallel Execution**: Sequential (bridge lifecycle requires ordering)
> **Critical Path**: Setup package → Create helpers → Write test → Run verification

---

## Context

### Original Request
Create an integration test that runs the `long-context` replay (on a different port), mounts `acp-chat-core`, and listens to events. Expect proper start/end of thoughts/tools/messages in the correct order.

- **If acp-chat-core IS the problem**: Fix it
- **If acp-chat-core ISN'T the problem**: Issue is in acp-chat-react, continue from there

### Research Findings

#### Long-Context Replay Data
- **Location**: `fixtures/replay-data/long-context/session-1/replay-events.jsonl`
- **Format**: JSONL (JSON Lines), 309 events
- **Event Flow**:
  ```
  replay_metadata → bridge_status(starting) → bridge_status(connected) →
  user_message("Analyze the architecture.") →
  agent_thought_chunk[s] (word-level streaming, ~260 events, status: "in_progress" | "done") →
  tool_call[read package.json] → tool_call_update →
  tool_call[read tsconfig.json] → tool_call_update →
  tool_call[read src/index.ts] → tool_call_update →
  tool_call[read src/normalization/store.ts] → tool_call_update →
  agent_thought_chunk[s] (more reasoning) →
  agent_message_chunk[s] (final markdown response ~20 events) →
  bridge_status(disconnected)
  ```

#### acp-chat-core Event API
- **Controllers**: `ReplayController` (replay mode), `SessionController` (live mode)
- **Event Methods**: `controller.on("statusChange", fn)`, `controller.on("sessionUpdate", fn)`, `controller.on("traffic", fn)`
- **Returns**: Unsubscribe function `() => void`

#### Test Framework
- **Framework**: Vitest v2.1+ with node environment
- **Command**: `pnpm test` → `vitest run`
- **Libraries**: `@testing-library/react`, `@testing-library/jest-dom` (for hook tests if needed)

### Metis Review Findings (Addressed in Plan)

**Critical Issues Identified:**
1. **WebSocket polyfill needed** - TransportClient uses browser `WebSocket`, needs `ws` polyfill in Node
2. **Bridge CWD must be repo root** - Fixture resolution is relative to process working directory
3. **Init protocol required** - Must send `{type: "init", mode: "replay", script, sessionId}` handshake
4. **Test timeout must be long** - 309 events at 65 TPS = ~10-30 seconds + startup time
5. **Process cleanup critical** - Bridge process must be killed after test

**Guardrails Applied:**
- Port collision detection and retry
- Bridge startup timeout (wait for "Bridge listening" log)
- Guaranteed process cleanup in `afterAll`
- Sequential test execution (no parallel conflicts)
- Event count flexibility (bridge auto-split may produce more events)

---

## Work Objectives

### Core Objective
Create a reliable integration test that runs the long-context replay through acp-chat-core and verifies event ordering, enabling definitive diagnosis of event stream issues.

### Concrete Deliverables
1. `packages/integration-tests/package.json` - Package configuration
2. `packages/integration-tests/tsconfig.json` - TypeScript configuration
3. `packages/integration-tests/vitest.config.ts` - Vitest configuration with long timeout
4. `packages/integration-tests/src/helpers/bridge.ts` - Bridge subprocess management
5. `packages/integration-tests/src/helpers/websocket-polyfill.ts` - WebSocket polyfill setup
6. `packages/integration-tests/src/long-context-replay.test.ts` - Main integration test

### Definition of Done
- [ ] Test package created and configured
- [ ] Bridge helper can spawn/kill bridge reliably
- [ ] WebSocket polyfill works in Node test environment
- [ ] Integration test runs full replay and passes
- [ ] Test verifies event type ordering
- [ ] Test verifies no errors during replay
- [ ] Test cleans up bridge process even on failure

### Must Have
- Bridge spawns on port 9876 (or finds available port)
- Full replay completes within 60 seconds
- All envelope events captured via `traffic` handler
- Event type assertions: metadata → status(starting) → status(connected) → payloads → status(disconnected)
- Process cleanup guaranteed in `afterAll`

### Must NOT Have (Guardrails)
- Do NOT test acp-chat-react hooks/components (this is acp-chat-core integration test)
- Do NOT test message content semantics (only event ordering)
- Do NOT assert exact event count (bridge auto-split varies count)
- Do NOT run multiple replays in parallel (port conflicts)
- Do NOT use live mode or permission flows

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES - Vitest, Node.js, Rust toolchain
- **Automated tests**: Tests-after (integration test itself)
- **Framework**: Vitest with 120s timeout per test
- **Test environment**: Node (not jsdom - this is controller-level integration)

### QA Policy
Every task includes agent-executed QA scenarios:
- **Package setup**: Verify files created, dependencies installable
- **Helpers**: Unit test helpers before integration test
- **Integration test**: Run test and verify pass/fail

---

## Execution Strategy

### Parallel Execution Waves

> Sequential execution required due to bridge lifecycle.

```
Wave 1 (Foundation - all can start in parallel):
├── Task 1: Create integration-tests package structure
├── Task 2: Create bridge subprocess helper
└── Task 3: Create WebSocket polyfill helper

Wave 2 (Integration - depends on Wave 1):
└── Task 4: Write long-context replay integration test

Wave 3 (Final Verification - depends on Wave 2):
├── Task 5: Run integration test and verify
└── Task F1-F4: Final verification wave
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|------------|--------|
| 1 (Package) | - | 2, 3 |
| 2 (Bridge Helper) | 1 | 4 |
| 3 (WS Polyfill) | 1 | 4 |
| 4 (Integration Test) | 2, 3 | 5 |
| 5 (Run Test) | 4 | F1-F4 |
| F1-F4 | 5 | - |

---

## TODOs

- [ ] 1. Create integration-tests package structure

  **What to do**:
  Create the `packages/integration-tests/` directory structure with all necessary configuration files:
  - `package.json` with vitest, TypeScript, and acp-chat-core dependencies
  - `tsconfig.json` extending root config
  - `vitest.config.ts` with 120s timeout and node environment
  - `.gitignore` for node_modules and dist
  - `src/` directory structure

  **Must NOT do**:
  - Do NOT add React or browser dependencies (this is a Node test)
  - Do NOT modify existing package.json files

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Simple scaffolding task with clear file patterns to follow

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:
  - `packages/acp-chat-core/package.json` - Reference for acp-chat-core dependency
  - Root `package.json` - Reference for workspace configuration
  - Root `tsconfig.json` - Reference for TypeScript config
  - Root `vitest.config.ts` - Reference for vitest configuration

  **Acceptance Criteria**:
  - [ ] `packages/integration-tests/package.json` exists with proper dependencies
  - [ ] `packages/integration-tests/tsconfig.json` exists
  - [ ] `packages/integration-tests/vitest.config.ts` exists with `testTimeout: 120000`
  - [ ] `packages/integration-tests/src/` directory exists
  - [ ] `pnpm install` succeeds without errors

  **QA Scenarios**:
  ```
  Scenario: Package structure is valid
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: ls -la packages/integration-tests/
      2. Assert: package.json, tsconfig.json, vitest.config.ts, src/ exist
      3. Run: cat packages/integration-tests/package.json | grep "vitest"
      4. Assert: vitest dependency is listed
    Expected Result: All files exist and package.json is valid
    Evidence: .sisyphus/evidence/task-1-structure.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of directory structure
  - [ ] Package.json content

  **Commit**: YES
  - Message: `chore(integration-tests): create package structure`
  - Files: `packages/integration-tests/*`

- [x] 2. Create bridge subprocess helper

  **What to do**:
  Create `packages/integration-tests/src/helpers/bridge.ts` with functions to:
  - `spawnBridge(port: number): Promise<ChildProcess>` - Spawn Rust bridge as subprocess with CWD set to repo root, wait for "Bridge listening" log
  - `killBridge(process: ChildProcess): Promise<void>` - Kill bridge process with SIGKILL, wait for exit
  - `isBridgeReady(port: number): Promise<boolean>` - Check if bridge is accepting connections
  - Handle port collision detection (try next port if 9876 is taken)

  **Must NOT do**:
  - Do NOT hardcode paths - resolve relative to repo root
  - Do NOT leave bridge running if spawn fails
  - Do NOT use graceful shutdown - bridge needs SIGKILL

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: Requires careful subprocess management and error handling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `scripts/benchmark-replay.sh` - Reference for bridge spawn command
  - Node.js `child_process` module docs
  - `test-replay-integration.js` - Reference for bridge interaction

  **Acceptance Criteria**:
  - [ ] `spawnBridge(9876)` returns ChildProcess that logs "Bridge listening on 127.0.0.1:9876"
  - [ ] `killBridge(process)` terminates bridge and resolves when process exits
  - [ ] If port 9876 is taken, automatically tries 9877, 9878, etc.
  - [ ] Proper TypeScript types for all functions

  **QA Scenarios**:
  ```
  Scenario: Bridge spawns successfully
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. Create test script that imports spawnBridge
      2. Run: const bridge = await spawnBridge(9876)
      3. Assert: bridge.pid is defined
      4. Assert: bridge.stdout contains "Bridge listening"
      5. Run: await killBridge(bridge)
      6. Assert: bridge.killed is true
    Expected Result: Bridge starts, logs listening message, can be killed
    Evidence: .sisyphus/evidence/task-2-bridge-spawn.txt
  ```

  **Evidence to Capture**:
  - [ ] Bridge spawn logs showing "Bridge listening"
  - [ ] Process exit confirmation

  **Commit**: YES
  - Message: `feat(integration-tests): add bridge subprocess helper`
  - Files: `packages/integration-tests/src/helpers/bridge.ts`

- [x] 3. Create WebSocket polyfill helper

  **What to do**:
  Create `packages/integration-tests/src/helpers/websocket-polyfill.ts` that:
  - Imports `ws` package
  - Sets `globalThis.WebSocket = (await import('ws')).WebSocket`
  - Exports `setupWebSocketPolyfill()` function to call before tests
  - Handles Node.js environment detection

  **Must NOT do**:
  - Do NOT pollute global scope permanently - use vitest setupFiles
  - Do NOT import if already polyfilled

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Simple polyfill setup

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `ws` npm package docs
  - Root `package.json` for ws dependency
  - `packages/acp-chat-core/src/transport/client.ts` - Shows WebSocket usage

  **Acceptance Criteria**:
  - [ ] `setupWebSocketPolyfill()` sets `globalThis.WebSocket` to ws WebSocket
  - [ ] Importing acp-chat-core works without "WebSocket is not defined" error
  - [ ] TypeScript types are correct

  **QA Scenarios**:
  ```
  Scenario: WebSocket polyfill works
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. Create test script that imports setupWebSocketPolyfill
      2. Run: setupWebSocketPolyfill()
      3. Assert: globalThis.WebSocket is defined
      4. Assert: new globalThis.WebSocket('ws://localhost:9876') doesn't throw
      5. Close websocket connection
    Expected Result: WebSocket is polyfilled and functional
    Evidence: .sisyphus/evidence/task-3-ws-polyfill.txt
  ```

  **Evidence to Capture**:
  - [ ] WebSocket constructor availability
  - [ ] Connection test

  **Commit**: YES
  - Message: `feat(integration-tests): add WebSocket polyfill helper`
  - Files: `packages/integration-tests/src/helpers/websocket-polyfill.ts`

- [x] 4. Write long-context replay integration test
- [x] 5. Run integration test and verify pass

  **FINDING**: acp-chat-core correctly streams all 312 events from long-context replay. Event types observed:
  - replay_metadata
  - bridge_status (starting → connected → disconnected)
  - acp_payload with agent_thought_chunk (word-level streaming)
  - acp_payload with tool_call and tool_call_update
  - acp_payload with agent_message_chunk

  **Conclusion**: acp-chat-core is working correctly. The thought auto-collapse issue is in acp-chat-react, not acp-chat-core.


  **What to do**:
  Run the complete integration test and verify it passes:
  1. Ensure all dependencies are installed
  2. Run `pnpm test` in packages/integration-tests/
  3. Verify test passes within 120 seconds
  4. Verify no bridge processes remain after test
  5. Check that evidence files are created
  6. If test fails, capture logs and diagnose

  **Must NOT do**:
  - Do NOT skip test if Rust toolchain unavailable (test should fail fast with clear message)
  - Do NOT accept flaky results - test must be reliable

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: Requires running actual test and interpreting results

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Task 4

  **References**:
  - `packages/integration-tests/vitest.config.ts` - Test configuration
  - `packages/integration-tests/src/long-context-replay.test.ts` - Test file

  **Acceptance Criteria**:
  - [ ] Test runs and passes
  - [ ] Test completes within 120 seconds
  - [ ] No orphaned bridge processes after test
  - [ ] Evidence files created

  **QA Scenarios**:
  ```
  Scenario: Test runs successfully
    Tool: Bash
    Preconditions: All previous tasks complete
    Steps:
      1. Run: cd packages/integration-tests && pnpm test 2>&1 | tee test-output.txt
      2. Assert: Exit code is 0
      3. Assert: Output contains "Test Files 1 passed"
      4. Assert: No "Bridge listening" processes remain: pgrep -f "acp-bridge" || true
      5. Assert: Evidence directory has files: ls .sisyphus/evidence/
    Expected Result: Test passes, no orphaned processes, evidence captured
    Evidence: .sisyphus/evidence/task-5-final-run.txt
  ```

  **Evidence to Capture**:
  - [ ] Complete test output
  - [ ] Process list before/after
  - [ ] Evidence directory listing

  **Commit**: YES
  - Message: `test(integration-tests): verify integration test passes`
  - Files: All changes from this task

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` in packages/integration-tests/. Check for any TypeScript errors. Review code for proper error handling in bridge helper. Verify test has proper cleanup.
  Output: `Build [PASS/FAIL] | Code Quality [PASS/FAIL] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Run the integration test manually: `cd packages/integration-tests && pnpm test`. Watch for: bridge startup time, event collection, assertions, cleanup. Verify test is reliable (run 3 times).
  Output: `Runs [3/3 pass] | Duration [X seconds] | Reliability [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual files. Verify 1:1 match. Check "Must NOT do" compliance. Verify no creep into React component testing.
  Output: `Tasks [N/N compliant] | Scope [CLEAN/CREEP] | VERDICT`

---

## Commit Strategy

- **1**: `chore(integration-tests): create package structure` - files: packages/integration-tests/package.json, tsconfig.json, vitest.config.ts
- **2**: `feat(integration-tests): add bridge subprocess helper` - files: packages/integration-tests/src/helpers/bridge.ts
- **3**: `feat(integration-tests): add WebSocket polyfill helper` - files: packages/integration-tests/src/helpers/websocket-polyfill.ts
- **4**: `feat(integration-tests): add long-context replay integration test` - files: packages/integration-tests/src/long-context-replay.test.ts
- **5**: `test(integration-tests): verify integration test passes` - files: any fixes needed

---

## Success Criteria

### Verification Commands
```bash
# Package structure
ls packages/integration-tests/

# Dependencies install
cd packages/integration-tests && pnpm install

# TypeScript check
cd packages/integration-tests && npx tsc --noEmit

# Run integration test
cd packages/integration-tests && pnpm test

# Expected: Test passes, no errors, no orphaned processes
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Test passes consistently (3/3 runs)
- [ ] No orphaned bridge processes
- [ ] Evidence files created in .sisyphus/evidence/
- [ ] TypeScript compiles without errors

### Interpretation of Results
- **Test PASSES consistently**: acp-chat-core is working correctly → Issue is in acp-chat-react
- **Test FAILS**: acp-chat-core has event ordering/status issues → Fix acp-chat-core first
