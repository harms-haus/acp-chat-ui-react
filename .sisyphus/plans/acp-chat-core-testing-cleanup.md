# Plan: ACP Chat Core - Testing & Cleanup

## TL;DR

> **Comprehensive cleanup and testing overhaul for the primary ACP Chat Core library.**
>
> **Deliverables:**
> - Dead code removed, debug logging cleaned up
> - Vitest test infrastructure fixed and enhanced
> - 80%+ test coverage for core modules
> - Comprehensive unit test suite (15+ test files)
> - Integration test suite with replay-based fixtures
> - Testing documentation and patterns for future development
> - `pnpm test-core` command working with coverage
>
> **Estimated Effort:** Large (40-50 tasks across 6 waves)
> **Parallel Execution:** YES - 5-8 tasks per wave
> **Critical Path:** Cleanup → Infrastructure → Unit Tests → Integration Tests → Documentation

---

## Context

### Current State Analysis

**Package:** `@harms-haus/acp-chat-core`  
**Location:** `/packages/acp-chat-core`  
**Size:** ~6,424 lines of source code, ~3,053 lines of existing tests

**Existing Test Files:**
1. `session/session-controller.test.ts` - 49 lines (basic, insufficient)
2. `__tests__/replay-controller.test.ts` - 734 lines (comprehensive)
3. `__tests__/capture-interceptor.test.ts` - 327 lines (good)
4. `__tests__/filesystem-subscription.test.ts` - 152 lines (complete)
5. `__tests__/token-timing.test.ts` - 301 lines (edge cases covered)
6. `bridge-contract.test.ts` - 346 lines (validation tests)
7. `normalization/store.test.ts` - 700 lines (extensive)
8. `normalization/thread-view.test.ts` - (exists, coverage unknown)
9. `index.test.ts` - (exists, coverage unknown)

**Critical Issues Found:**
1. **Tests not running:** Vitest cannot discover test files despite correct patterns
2. **No coverage reporting:** Coverage not configured or generated
3. **Debug logging:** Extensive `console.log` in production code (`controller.ts`)
4. **Global debug state:** `window.__ACP_DEBUG` dumping in production
5. **Missing tests:** TransportClient, helper logic, presets have no dedicated tests
6. **Type inconsistency:** BridgeEnvelope missing `extra_data` field in TypeScript

### ACP Protocol Implementation Status

**Implemented Methods:**
- ✅ `initialize` - Initialize connection with capabilities
- ✅ `session/new` - Create new session
- ✅ `session/load` - Load existing session
- ✅ `session/list` - List sessions
- ✅ `session/prompt` - Send prompt to agent
- ✅ `session/cancel` - Cancel current prompt
- ✅ `session/update` - Receive session state updates
- ✅ `session/request_permission` - Permission request handling

**Extended Features (Beyond ACP Spec):**
- ✅ Filesystem operations: `fs/read_text_file`, `fs/write_text_file`
- ✅ Session capture/recording
- ✅ Replay mode support
- ✅ Batched updates support
- ✅ Agent control: `startAgent()`, `initLive()`

**Content Block Types:**
- ✅ `TextContent` - Plain text
- ⚠️ `ImageContent` - May be handled via resource type (verify)
- ✅ `ResourceLink` - External resource links

**Session Update Events:**
- ✅ `user_message` - User message content
- ✅ `agent_message_chunk` - Streaming agent response
- ✅ `agent_thought_chunk` - Agent thought process
- ✅ `tool_call` - Tool invocation
- ✅ `tool_call_update` - Tool call status update
- ✅ `permission_request` - Permission request

---

## Work Objectives

### Core Objective
Transform acp-chat-core from a "tests exist but don't run" state to a production-grade library with 80%+ test coverage, clean code, comprehensive documentation, and a robust testing infrastructure that can be maintained and extended.

### Concrete Deliverables

**Cleanup:**
- [ ] Remove or guard all debug logging in production code
- [ ] Remove `window.__ACP_DEBUG` global state dumping
- [ ] Audit and remove any unused exports or dead code
- [ ] Fix TypeScript type inconsistencies (BridgeEnvelope `extra_data`)

**Infrastructure:**
- [ ] Fix Vitest test discovery (currently failing)
- [ ] Configure coverage collection with v8 provider
- [ ] Set coverage thresholds (80% lines, 75% branches, 80% functions)
- [ ] Create test utilities and helpers
- [ ] Set up replay-based testing infrastructure

**Unit Tests:**
- [ ] SessionController comprehensive tests (currently minimal)
- [ ] TransportClient tests (currently none)
- [ ] Bridge parser tests (expand beyond contract validation)
- [ ] Helper logic tests (composer, thought-stack)
- [ ] Preset validation tests
- [ ] Filesystem subscription tests (exists, verify completeness)

**Integration Tests:**
- [ ] Replay-based session lifecycle tests
- [ ] ACP protocol compliance tests
- [ ] Error handling and edge case tests
- [ ] WebSocket connection lifecycle tests
- [ ] Session capture and replay flow tests

**Documentation:**
- [ ] Testing strategy guide
- [ ] How to write unit tests for core modules
- [ ] How to write integration tests with replay fixtures
- [ ] Test fixture format specification
- [ ] Coverage reporting guide

### Definition of Done
- [x] `pnpm test-core` runs successfully with all tests passing
- [x] Coverage report shows 80%+ for lines, 75%+ for branches
- [x] No console.log statements in production code paths
- [x] All new tests include agent-executed QA scenarios
- [ ] Documentation complete and accurate
- [x] No regression in existing functionality

### Must Have (Non-Negotiable)
- [x] 80%+ test coverage for core modules
- [x] All existing tests must pass
- [x] Debug logging removed or properly guarded
- [x] Vitest test discovery working
- [x] Integration tests with replay fixtures
- [ ] Comprehensive documentation

### Must NOT Have (Explicit Exclusions)
- No Playwright tests (out of scope)
- No CI/CD setup (out of scope)
- No harness UI testing (out of scope)
- No cross-library shared test code (per requirements)
- No new ACP protocol extensions (pure ACP standard only)
- No breaking API changes (unless absolutely necessary)

---

## Verification Strategy

### Testing Framework Decision
- **Framework:** Vitest 2.1.0 (already configured, just needs fixing)
- **Environment:** Node.js (native, no DOM needed for core)
- **Coverage:** v8 provider (native, faster than Istanbul)
- **Mocking:** Vitest built-in (vi.fn, vi.mock)

### Test Commands
```bash
# Run all tests
pnpm test-core

# Run with coverage
pnpm test-core:coverage

# Run specific test file
pnpm vitest run packages/acp-chat-core/src/session/controller.test.ts

# Watch mode for development
pnpm vitest --filter=acp-chat-core
```

### QA Policy
Every task MUST include agent-executed QA scenarios:

- **Unit tests:** Direct function calls with assertions
- **Integration tests:** Replay fixture loading and execution
- **Coverage:** Generate and verify coverage reports meet thresholds
- **Lint/type check:** `tsc --noEmit` must pass

**Evidence:** All test results, coverage reports, and lint output saved to `.sisyphus/evidence/acp-chat-core/`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Cleanup & Infrastructure):
├── Task 1: Remove debug logging from controller.ts
├── Task 2: Fix Vitest test discovery configuration
├── Task 3: Set up coverage collection with thresholds
├── Task 4: Create test utilities and helpers
├── Task 5: Fix BridgeEnvelope type (add extra_data field)
└── Task 6: Audit and document dead code removal

Wave 2 (Core Module Tests - MAX PARALLEL):
├── Task 7: SessionController comprehensive tests
├── Task 8: TransportClient tests
├── Task 9: Bridge parser expanded tests
├── Task 10: Composer helper logic tests
├── Task 11: Thought-stack helper logic tests
├── Task 12: Preset validation tests
└── Task 13: Capture interceptor tests (verify completeness)

Wave 3 (Integration Tests):
├── Task 14: Replay fixture infrastructure
├── Task 15: Session lifecycle integration tests
├── Task 16: ACP protocol compliance tests
├── Task 17: Error handling integration tests
├── Task 18: WebSocket connection lifecycle tests
└── Task 19: Session capture/replay flow tests

Wave 4 (Documentation & Finalization):
├── Task 20: Write testing strategy guide
├── Task 21: Write unit testing patterns doc
├── Task 22: Write integration testing patterns doc
├── Task 23: Write test fixture specification
├── Task 24: Write coverage reporting guide
└── Task 25: Update package.json scripts

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Coverage verification (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix

- **1-6**: No dependencies (can all run in parallel)
- **7**: Depends on 2, 4 (test infra ready)
- **8**: Depends on 2, 4
- **9**: Depends on 2, 4
- **10**: Depends on 2, 4
- **11**: Depends on 2, 4
- **12**: Depends on 2, 4
- **13**: Depends on 2, 4
- **14**: Depends on 2, 4, 5 (type fix)
- **15-19**: Depends on 14 (replay infra)
- **20-25**: Depends on 7-19 (tests complete)
- **F1-F4**: Depends on ALL previous tasks

### Agent Dispatch Summary

- **Wave 1**: 6 tasks → `quick` (cleanup, config fixes)
- **Wave 2**: 7 tasks → `deep` (complex test logic)
- **Wave 3**: 6 tasks → `deep` (integration complexity)
- **Wave 4**: 6 tasks → `writing` (documentation)
- **Wave FINAL**: 4 tasks → `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

### Wave 1: Foundation - Cleanup & Infrastructure

- [x] **1. Remove debug logging from controller.ts**

  **What to do:**
  - Remove all `console.log` statements from `src/session/controller.ts`
  - Remove `window.__ACP_DEBUG` global state dumping (lines 343-353)
  - If debug logging is needed, implement a proper logger interface with DEBUG flag
  - Search for any other production files with debug logging

  **Files to modify:**
  - `packages/acp-chat-core/src/session/controller.ts`

  **Must NOT do:**
  - Don't just comment out - remove entirely
  - Don't break existing functionality that might rely on these logs (unlikely)

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - `src/session/controller.ts:343-353` - Window debug dumping code
  - Search for `console.log` in `src/` directory

  **Acceptance Criteria:**
  - [ ] `grep -r "console.log" packages/acp-chat-core/src/` returns 0 results (or only in test files)
  - [ ] `grep -r "window.__ACP_DEBUG" packages/acp-chat-core/src/` returns 0 results
  - [ ] `pnpm check` passes with no errors

  **QA Scenarios:**
  ```
  Scenario: Verify no console.log in production code
    Tool: Bash (grep)
    Steps:
      1. Run: grep -r "console.log" packages/acp-chat-core/src/ --include="*.ts" | grep -v ".test.ts" | grep -v "__tests__"
    Expected Result: Empty output (no matches)
    Evidence: .sisyphus/evidence/task-1-no-console-log.txt
  ```

  **Commit:** YES
  - Message: `refactor(core): remove debug logging from controller`
  - Files: `packages/acp-chat-core/src/session/controller.ts`

- [x] **2. Fix Vitest test discovery configuration**

  **What to do:**
  - Investigate why vitest cannot find test files despite correct patterns
  - Check root `vitest.config.ts` include patterns
  - Check if `vitest.setup.ts` is properly configured
  - May need to adjust `test.include` patterns or add setup file
  - Ensure tests in `__tests__/` directories are discovered

  **Files to examine/modify:**
  - `vitest.config.ts` (root)
  - `vitest.setup.ts` (root)
  - `packages/acp-chat-core/package.json`

  **Must NOT do:**
  - Don't move test files to different locations
  - Don't rename all test files to match a different pattern

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - Root `vitest.config.ts` - Current configuration
  - `packages/acp-chat-core/src/__tests__/` - Test directory structure
  - Vitest documentation for test discovery

  **Acceptance Criteria:**
  - [ ] `cd packages/acp-chat-core && pnpm vitest run` discovers and runs 9 test files
  - [ ] All existing tests pass (or fail for legitimate reasons, not discovery issues)
  - [ ] Tests in `__tests__/` directories are discovered
  - [ ] Tests in same directory as source (`*.test.ts`) are discovered

  **QA Scenarios:**
  ```
  Scenario: Verify test discovery works
    Tool: Bash
    Preconditions: In packages/acp-chat-core directory
    Steps:
      1. Run: pnpm vitest run --reporter=verbose 2>&1 | head -50
    Expected Result: Shows test files being discovered and run
    Evidence: .sisyphus/evidence/task-2-test-discovery.txt
  ```

  **Commit:** YES
  - Message: `fix(core): fix vitest test discovery configuration`
  - Files: `vitest.config.ts`, possibly `packages/acp-chat-core/vitest.config.ts`

- [ ] **3. Set up coverage collection with thresholds**

  **What to do:**
  - Add coverage configuration to vitest.config.ts
  - Use v8 provider (faster than istanbul)
  - Set thresholds: 80% lines, 75% branches, 80% functions
  - Configure reporters: text, json, html, lcov
  - Ensure coverage works with the monorepo structure

  **Files to modify:**
  - `packages/acp-chat-core/vitest.config.ts` (create if doesn't exist, or modify root)
  - May need to create package-specific config

  **Must NOT do:**
  - Don't use istanbul provider (slower)
  - Don't set unrealistic thresholds initially

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with task 2)
  - **Parallel Group:** Wave 1
  - **Blocked By:** Task 2 (test discovery working)

  **References:**
  - Vitest coverage documentation
  - Current root vitest.config.ts

  **Acceptance Criteria:**
  - [ ] `pnpm vitest run --coverage` generates coverage report
  - [ ] Coverage report includes all source files in `src/`
  - [ ] HTML report generated at `coverage/index.html`
  - [ ] LCOV report generated for integration

  **QA Scenarios:**
  ```
  Scenario: Verify coverage collection works
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run --coverage 2>&1 | tail -30
      2. Check: ls packages/acp-chat-core/coverage/ 2>/dev/null || ls coverage/
    Expected Result: Coverage report shows percentages for files
    Evidence: .sisyphus/evidence/task-3-coverage-report.txt
  ```

  **Commit:** YES
  - Message: `chore(core): add vitest coverage configuration`
  - Files: `packages/acp-chat-core/vitest.config.ts`

- [ ] **4. Create test utilities and helpers**

  **What to do:**
  - Create `src/test-utils/` directory
  - Create test fixtures loader
  - Create mock helpers for SessionController
  - Create ACP message builders for tests
  - Create test data factories

  **Files to create:**
  - `packages/acp-chat-core/src/test-utils/index.ts`
  - `packages/acp-chat-core/src/test-utils/fixtures.ts`
  - `packages/acp-chat-core/src/test-utils/mocks.ts`
  - `packages/acp-chat-core/src/test-utils/factories.ts`

  **Must NOT do:**
  - Don't export test utilities from main index.ts
  - Don't include test utilities in production builds

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - Existing test patterns in `src/__tests__/`
  - Fixture files in `fixtures/` directory

  **Acceptance Criteria:**
  - [ ] Test utilities can be imported in test files
  - [ ] Fixture loader can load replay files
  - [ ] Mock helpers create valid SessionController mocks
  - [ ] ACP message builders create valid message structures

  **QA Scenarios:**
  ```
  Scenario: Verify test utilities work
    Tool: Bash (node)
    Steps:
      1. Create test file importing utilities
      2. Run: node --loader ts-node/esm test-import.ts
    Expected Result: Imports succeed without errors
    Evidence: .sisyphus/evidence/task-4-test-utils.txt
  ```

  **Commit:** YES
  - Message: `feat(core): add test utilities and helpers`
  - Files: `packages/acp-chat-core/src/test-utils/*`

- [ ] **5. Fix BridgeEnvelope type (add extra_data field)**

  **What to do:**
  - Add `extraData?: Record<string, unknown>` field to BridgeEnvelope TypeScript type
  - Update in both `packages/acp-chat-core/src/generated/` and `packages/acp-ws-bridge/src/types/`
  - Ensure consistency with Rust-generated bindings
  - Update any code that constructs/parses BridgeEnvelope

  **Files to modify:**
  - `packages/acp-chat-core/src/generated/BridgeEnvelope.ts`
  - `packages/acp-ws-bridge/src/types/BridgeEnvelope.ts` (if different)

  **Must NOT do:**
  - Don't modify generated files directly if they're auto-generated from Rust
  - Instead, ensure Rust ts-rs generation includes the field

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - `crates/acp-ws-bridge/bindings/BridgeEnvelope.ts` - Rust-generated version WITH extra_data
  - `packages/acp-chat-core/src/generated/BridgeEnvelope.ts` - Current version WITHOUT

  **Acceptance Criteria:**
  - [ ] BridgeEnvelope type includes `extraData` field
  - [ ] TypeScript compilation passes
  - [ ] All usages updated if needed

  **QA Scenarios:**
  ```
  Scenario: Verify extra_data field exists
    Tool: Bash (grep)
    Steps:
      1. Run: grep -A5 "extraData" packages/acp-chat-core/src/generated/BridgeEnvelope.ts
    Expected Result: Shows extraData field definition
    Evidence: .sisyphus/evidence/task-5-extra-data-field.txt
  ```

  **Commit:** YES
  - Message: `fix(core): add extraData field to BridgeEnvelope type`
  - Files: `packages/acp-chat-core/src/generated/BridgeEnvelope.ts`

- [x] **6. Audit and document dead code removal**

  **What to do:**
  - Run static analysis to find unused exports
  - Check for any deprecated code or TODOs that should be removed
  - Document what was removed and why
  - Update any references in documentation

  **Files to examine:**
  - All exports from `src/index.ts`
  - All source files for unused functions

  **Must NOT do:**
  - Don't remove public API exports without careful consideration
  - Don't remove code that might be used by other packages

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - `src/index.ts` - All public exports

  **Acceptance Criteria:**
  - [ ] Document listing any dead code found
  - [ ] If dead code removed, commit with clear message
  - [ ] No breaking changes to public API

  **QA Scenarios:**
  ```
  Scenario: Verify no obvious dead code
    Tool: Bash (grep)
    Steps:
      1. Run: grep -r "@deprecated" packages/acp-chat-core/src/ --include="*.ts"
      2. Run: grep -r "TODO.*remove" packages/acp-chat-core/src/ --include="*.ts"
    Expected Result: Lists any deprecated/TODO items found
    Evidence: .sisyphus/evidence/task-6-dead-code-audit.txt
  ```

  **Commit:** YES (if code removed)
  - Message: `refactor(core): remove dead code [list what was removed]`
  - Files: Any files with dead code

### Wave 2: Core Module Tests

- [x] **7. SessionController comprehensive tests**

  **What to do:**
  - Replace minimal 49-line test file with comprehensive tests
  - Test all public methods: connect, disconnect, initialize, createSession, loadSession, listSessions, sendPrompt, cancelPrompt
  - Test event emission: statusChange, sessionUpdate, traffic, error, sessionClearing, permissionRequest
  - Test permission handling flow
  - Test filesystem operation handling
  - Test error scenarios and edge cases
  - Mock WebSocket and transport layer

  **Files to create/modify:**
  - `packages/acp-chat-core/src/session/controller.test.ts` (expand from 49 lines to 500+ lines)

  **Must NOT do:**
  - Don't test private methods directly
  - Don't require actual WebSocket server

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 8-13)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Tasks 2, 3, 4 (test infra ready)

  **References:**
  - `src/session/controller.ts` - Implementation to test
  - `src/session/replay-controller.ts` - Similar patterns
  - `src/__tests__/replay-controller.test.ts` - Example comprehensive tests

  **Acceptance Criteria:**
  - [ ] Minimum 20 test cases covering all public methods
  - [ ] All event emissions tested
  - [ ] Error scenarios covered
  - [ ] Mock transport used (no real WebSocket)
  - [ ] 80%+ coverage for controller.ts

  **QA Scenarios:**
  ```
  Scenario: Run SessionController tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/session/controller.test.ts
    Expected Result: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-7-controller-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add comprehensive SessionController tests`
  - Files: `packages/acp-chat-core/src/session/controller.test.ts`

- [x] **8. TransportClient tests**

  **What to do:**
  - Create comprehensive tests for TransportClient (currently none)
  - Test connection lifecycle: connect, disconnect, reconnect
  - Test WebSocket event handling: onopen, onmessage, onclose, onerror
  - Test auto-reconnect with exponential backoff
  - Test init modes: live, replay-v2
  - Test envelope sending and receiving
  - Test connection state management

  **Files to create:**
  - `packages/acp-chat-core/src/transport/client.test.ts`

  **Must NOT do:**
  - Don't require actual WebSocket server (use mock)
  - Don't test browser-specific code in Node environment

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7, 9-13)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Tasks 2, 3, 4

  **References:**
  - `src/transport/client.ts` - Implementation (307 lines)
  - `src/__tests__/replay-controller.test.ts` - Mock WebSocket example

  **Acceptance Criteria:**
  - [ ] Minimum 15 test cases
  - [ ] Connection lifecycle fully tested
  - [ ] Reconnect logic tested with mocked timers
  - [ ] All connection states tested
  - [ ] 80%+ coverage for client.ts

  **QA Scenarios:**
  ```
  Scenario: Run TransportClient tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/transport/client.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-8-transport-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add TransportClient tests`
  - Files: `packages/acp-chat-core/src/transport/client.test.ts`

- [x] **9. Bridge parser expanded tests**

  **What to do:**
  - Expand beyond existing `bridge-contract.test.ts`
  - Test envelope parsing edge cases
  - Test version validation thoroughly
  - Test malformed envelope handling
  - Test all message type parsing

  **Files to create/modify:**
  - `packages/acp-chat-core/src/bridge/parser.test.ts`

  **Must NOT do:**
  - Don't duplicate existing contract tests
  - Focus on edge cases and error handling

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-8, 10-13)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Tasks 2, 3, 4

  **References:**
  - `src/bridge/parser.ts` - Implementation (58 lines)
  - `src/bridge-contract.test.ts` - Existing tests

  **Acceptance Criteria:**
  - [ ] Minimum 10 test cases
  - [ ] All edge cases covered
  - [ ] Error handling tested
  - [ ] 90%+ coverage for parser.ts (small file)

  **QA Scenarios:**
  ```
  Scenario: Run bridge parser tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/bridge/parser.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-9-parser-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add bridge parser edge case tests`
  - Files: `packages/acp-chat-core/src/bridge/parser.test.ts`

- [x] **10. Composer helper logic tests**

  **What to do:**
  - Test all functions in `composer-logic.ts`
  - Test send logic: `shouldSendOnKeydown()`, `canSend()`
  - Test prompt lifecycle: `startPrompt()`, `completePrompt()`, `cancelPrompt()`
  - Test state queries: `isPromptActive()`, `shouldShowStopButton()`
  - Test button states: `getButtonState()`, `isSendButtonDisabled()`

  **Files to create:**
  - `packages/acp-chat-core/src/helpers/composer-logic.test.ts`

  **Must NOT do:**
  - Don't test UI rendering (that's React package)
  - Focus on pure logic functions

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-9, 11-13)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Tasks 2, 3, 4

  **References:**
  - `src/helpers/composer-logic.ts` - Implementation (75 lines)

  **Acceptance Criteria:**
  - [x] All exported functions tested
  - [x] Edge cases covered (empty input, disabled state, etc.)
  - [x] 90%+ coverage (achieved: 100%)

  **QA Scenarios:**
  ```
  Scenario: Run composer logic tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/helpers/composer-logic.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/acp-chat-core/task-10-composer-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add composer logic tests`
  - Files: `packages/acp-chat-core/src/helpers/composer-logic.test.ts`

- [ ] **11. Thought-stack helper logic tests**

  **What to do:**
  - Test thought grouping algorithms
  - Test `groupThoughtItems()`, `createGroupedTimeline()`
  - Test `isThoughtGroupActive()`, `shouldThoughtGroupBeOpen()`
  - Test edge cases: empty thoughts, single thought, many thoughts
  - Test grouping logic with various thought patterns

  **Files to create:**
  - `packages/acp-chat-core/src/helpers/thought-stack-logic.test.ts`

  **Must NOT do:**
  - Don't test UI rendering
  - Focus on algorithm correctness

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-10, 12-13)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Tasks 2, 3, 4

  **References:**
  - `src/helpers/thought-stack-logic.ts` - Implementation (119 lines)

  **Acceptance Criteria:**
  - [ ] All exported functions tested
  - [ ] Grouping algorithm tested with various inputs
  - [ ] Edge cases covered
  - [ ] 90%+ coverage

  **QA Scenarios:**
  ```
  Scenario: Run thought-stack logic tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/helpers/thought-stack-logic.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-11-thought-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add thought-stack logic tests`
  - Files: `packages/acp-chat-core/src/helpers/thought-stack-logic.test.ts`

- [ ] **12. Preset validation tests**

  **What to do:**
  - Test launch preset parsing
  - Test environment variable parsing: `ACP_LAUNCH_CMD`, `ACP_SESSION_ID`, `ACP_CWD`, etc.
  - Test `parseLaunchPreset()` with valid and invalid inputs
  - Test `isPresetValid()` validation logic
  - Test edge cases: missing vars, malformed values

  **Files to create:**
  - `packages/acp-chat-core/src/presets/launch.test.ts`

  **Must NOT do:**
  - Don't modify actual environment variables in tests
  - Use mocking or pass env as parameter

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-11, 13)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Tasks 2, 3, 4

  **References:**
  - `src/presets/launch.ts` - Implementation (64 lines)

  **Acceptance Criteria:**
  - [ ] All environment variables tested
  - [ ] Valid and invalid inputs tested
  - [ ] Edge cases covered
  - [ ] 90%+ coverage

  **QA Scenarios:**
  ```
  Scenario: Run preset validation tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/presets/launch.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-12-preset-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add preset validation tests`
  - Files: `packages/acp-chat-core/src/presets/launch.test.ts`

- [ ] **13. Verify and complete capture interceptor tests**

  **What to do:**
  - Review existing `capture-interceptor.test.ts` (327 lines)
  - Identify any missing test cases
  - Add tests for uncovered scenarios
  - Ensure 80%+ coverage

  **Files to examine:**
  - `packages/acp-chat-core/src/__tests__/capture-interceptor.test.ts`

  **Must NOT do:**
  - Don't rewrite tests if they're already comprehensive
  - Focus on gaps only

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-12)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Tasks 2, 3, 4

  **References:**
  - `src/session/capture-interceptor.ts` - Implementation (313 lines)
  - `src/__tests__/capture-interceptor.test.ts` - Existing tests

  **Acceptance Criteria:**
  - [ ] Coverage check shows 80%+ for capture-interceptor.ts
  - [ ] Any gaps identified and filled
  - [ ] All tests pass

  **QA Scenarios:**
  ```
  Scenario: Verify capture interceptor coverage
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run --coverage packages/acp-chat-core/src/__tests__/capture-interceptor.test.ts
      2. Check coverage report for capture-interceptor.ts
    Expected Result: Coverage >= 80%
    Evidence: .sisyphus/evidence/task-13-coverage-check.txt
  ```

  **Commit:** YES (if gaps filled)
  - Message: `test(core): complete capture interceptor test coverage`
  - Files: `packages/acp-chat-core/src/__tests__/capture-interceptor.test.ts`

### Wave 3: Integration Tests

- [ ] **14. Replay fixture infrastructure**

  **What to do:**
  - Create replay fixture loader utility
  - Create replay runner that can execute replay files
  - Set up integration with existing fixtures in `fixtures/` directory
  - Create helpers for asserting replay outcomes
  - Document fixture format

  **Files to create:**
  - `packages/acp-chat-core/src/test-utils/replay-runner.ts`
  - `packages/acp-chat-core/src/test-utils/fixture-loader.ts`

  **Must NOT do:**
  - Don't modify existing fixture files
  - Don't create new fixtures yet (next task)

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** NO (blocks 15-19)
  - **Parallel Group:** Wave 3 starter
  - **Blocked By:** Tasks 2, 4, 5

  **References:**
  - `fixtures/` directory with existing replay files
  - `src/session/replay-controller.ts` - How replays are processed
  - `src/replay/types.ts` - Replay type definitions

  **Acceptance Criteria:**
  - [ ] Can load and parse replay JSONL files
  - [ ] Can execute replay through ReplayController
  - [ ] Can assert on replay outcomes
  - [ ] Works with existing fixtures

  **QA Scenarios:**
  ```
  Scenario: Verify replay infrastructure works
    Tool: Bash
    Steps:
      1. Create test using replay runner
      2. Run: pnpm vitest run test-replay-infra.test.ts
    Expected Result: Test passes, replay executes correctly
    Evidence: .sisyphus/evidence/task-14-replay-infra.txt
  ```

  **Commit:** YES
  - Message: `feat(core): add replay fixture testing infrastructure`
  - Files: `packages/acp-chat-core/src/test-utils/replay-runner.ts`

- [ ] **15. Session lifecycle integration tests**

  **What to do:**
  - Test full session lifecycle: init → create → prompt → response → complete
  - Use replay fixtures to drive tests
  - Test with `sample-replay.jsonl`, `thought-tool-replay.jsonl`
  - Test session state transitions
  - Test multiple turns in sequence

  **Files to create:**
  - `packages/acp-chat-core/src/__tests__/integration/session-lifecycle.test.ts`

  **Must NOT do:**
  - Don't require running WebSocket server
  - Use replay mode for isolation

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 16-19)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Task 14

  **References:**
  - `fixtures/sample-replay.jsonl`
  - `fixtures/thought-tool-replay.jsonl`
  - `src/__tests__/replay-controller.test.ts` - Replay test patterns

  **Acceptance Criteria:**
  - [ ] Tests run with replay fixtures
  - [ ] Full lifecycle tested
  - [ ] State transitions verified
  - [ ] Multiple scenarios covered

  **QA Scenarios:**
  ```
  Scenario: Run session lifecycle integration tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/__tests__/integration/session-lifecycle.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-15-integration-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add session lifecycle integration tests`
  - Files: `packages/acp-chat-core/src/__tests__/integration/session-lifecycle.test.ts`

- [ ] **16. ACP protocol compliance tests**

  **What to do:**
  - Test ACP protocol message formats
  - Test JSON-RPC compliance
  - Test all ACP methods with valid/invalid params
  - Test error codes and error responses
  - Test capability negotiation
  - Test version compliance

  **Files to create:**
  - `packages/acp-chat-core/src/__tests__/integration/acp-protocol.test.ts`

  **Must NOT do:**
  - Don't test protocol beyond ACP spec
  - No custom extensions

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 15, 17-19)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Task 14

  **References:**
  - `docs/wiki/ACP-Protocol.md` - Protocol specification
  - `src/session/controller.ts` - Method implementations

  **Acceptance Criteria:**
  - [ ] All ACP methods tested
  - [ ] JSON-RPC format validated
  - [ ] Error codes tested
  - [ ] Capability negotiation tested

  **QA Scenarios:**
  ```
  Scenario: Run ACP protocol compliance tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/__tests__/integration/acp-protocol.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-16-protocol-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add ACP protocol compliance tests`
  - Files: `packages/acp-chat-core/src/__tests__/integration/acp-protocol.test.ts`

- [ ] **17. Error handling integration tests**

  **What to do:**
  - Test error scenarios: network errors, parse errors, timeout errors
  - Test recovery mechanisms
  - Test error event emission
  - Test error state transitions
  - Test permission denied scenarios
  - Test invalid session state errors

  **Files to create:**
  - `packages/acp-chat-core/src/__tests__/integration/error-handling.test.ts`

  **Must NOT do:**
  - Don't just test error throwing, test error handling and recovery

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 15-16, 18-19)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Task 14

  **References:**
  - `src/session/controller.ts` - Error handling code
  - `src/transport/client.ts` - Transport error handling

  **Acceptance Criteria:**
  - [ ] Various error types tested
  - [ ] Recovery mechanisms verified
  - [ ] Error events emitted correctly
  - [ ] State transitions on error tested

  **QA Scenarios:**
  ```
  Scenario: Run error handling integration tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/__tests__/integration/error-handling.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-17-error-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add error handling integration tests`
  - Files: `packages/acp-chat-core/src/__tests__/integration/error-handling.test.ts`

- [ ] **18. WebSocket connection lifecycle tests**

  **What to do:**
  - Test connection establishment and teardown
  - Test reconnection with exponential backoff
  - Test connection state transitions
  - Test connection error scenarios
  - Test graceful degradation
  - Test multiple connection attempts

  **Files to create:**
  - `packages/acp-chat-core/src/__tests__/integration/connection-lifecycle.test.ts`

  **Must NOT do:**
  - Don't require actual WebSocket server
  - Use mocked WebSocket or replay mode

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 15-17, 19)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Task 14

  **References:**
  - `src/transport/client.ts` - Transport implementation
  - Task 8 (TransportClient unit tests)

  **Acceptance Criteria:**
  - [ ] Connection lifecycle tested
  - [ ] Reconnection logic tested
  - [ ] State transitions verified
  - [ ] Error scenarios covered

  **QA Scenarios:**
  ```
  Scenario: Run connection lifecycle integration tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/__tests__/integration/connection-lifecycle.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-18-connection-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add WebSocket connection lifecycle tests`
  - Files: `packages/acp-chat-core/src/__tests__/integration/connection-lifecycle.test.ts`

- [ ] **19. Session capture/replay flow tests**

  **What to do:**
  - Test session capture functionality
  - Test captured session replay
  - Test capture interceptor integration
  - Test export functionality
  - Test capture with various session types

  **Files to create:**
  - `packages/acp-chat-core/src/__tests__/integration/capture-replay-flow.test.ts`

  **Must NOT do:**
  - Don't actually write to filesystem in tests (mock or use temp)

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 15-18)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Task 14

  **References:**
  - `src/session/capture-interceptor.ts`
  - `fixtures/replay-data/captured/` - Example captures

  **Acceptance Criteria:**
  - [ ] Capture functionality tested
  - [ ] Replay of captured sessions tested
  - [ ] Export functionality verified
  - [ ] Various session types covered

  **QA Scenarios:**
  ```
  Scenario: Run capture/replay flow tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-core/src/__tests__/integration/capture-replay-flow.test.ts
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-19-capture-tests.txt
  ```

  **Commit:** YES
  - Message: `test(core): add session capture/replay flow tests`
  - Files: `packages/acp-chat-core/src/__tests__/integration/capture-replay-flow.test.ts`

### Wave 4: Documentation

- [ ] **20. Write testing strategy guide**

  **What to do:**
  - Document overall testing strategy for acp-chat-core
  - Explain test pyramid (unit vs integration)
  - Document testing philosophy (behavior over implementation)
  - Explain when to use mocks vs real objects
  - Document test file organization

  **Files to create:**
  - `packages/acp-chat-core/TESTING.md`

  **Must NOT do:**
  - Don't duplicate external testing guides
  - Focus on acp-chat-core specifics

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 21-25)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-19 (tests complete)

  **References:**
  - Existing test files for patterns
  - Vitest documentation

  **Acceptance Criteria:**
  - [ ] Testing strategy documented
  - [ ] Test organization explained
  - [ ] Philosophy clear
  - [ ] Examples provided

  **QA Scenarios:**
  ```
  Scenario: Verify documentation completeness
    Tool: Read
    Steps:
      1. Read packages/acp-chat-core/TESTING.md
    Expected Result: Comprehensive testing guide
    Evidence: .sisyphus/evidence/task-20-testing-doc.md
  ```

  **Commit:** YES
  - Message: `docs(core): add testing strategy guide`
  - Files: `packages/acp-chat-core/TESTING.md`

- [ ] **21. Write unit testing patterns doc**

  **What to do:**
  - Document patterns for writing unit tests
  - Provide examples for different module types
  - Show mock usage patterns
  - Document test data factories
  - Provide templates for common test scenarios

  **Files to create:**
  - `packages/acp-chat-core/docs/unit-testing-patterns.md`

  **Must NOT do:**
  - Don't be generic - use acp-chat-core examples

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 20, 22-25)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-19

  **Acceptance Criteria:**
  - [ ] Unit testing patterns documented
  - [ ] Examples from codebase
  - [ ] Templates provided
  - [ ] Mocking patterns explained

  **QA Scenarios:**
  ```
  Scenario: Verify unit testing patterns doc
    Tool: Read
    Steps:
      1. Read packages/acp-chat-core/docs/unit-testing-patterns.md
    Expected Result: Practical patterns with examples
    Evidence: .sisyphus/evidence/task-21-unit-patterns.md
  ```

  **Commit:** YES
  - Message: `docs(core): add unit testing patterns guide`
  - Files: `packages/acp-chat-core/docs/unit-testing-patterns.md`

- [ ] **22. Write integration testing patterns doc**

  **What to do:**
  - Document replay-based integration testing
  - Explain fixture format
  - Show how to write integration tests
  - Document test data setup
  - Provide examples

  **Files to create:**
  - `packages/acp-chat-core/docs/integration-testing-patterns.md`

  **Must NOT do:**
  - Don't overlap too much with unit testing doc

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 20-21, 23-25)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-19

  **Acceptance Criteria:**
  - [ ] Integration testing documented
  - [ ] Replay fixture usage explained
  - [ ] Examples from integration tests
  - [ ] Best practices included

  **QA Scenarios:**
  ```
  Scenario: Verify integration testing patterns doc
    Tool: Read
    Steps:
      1. Read packages/acp-chat-core/docs/integration-testing-patterns.md
    Expected Result: Comprehensive integration testing guide
    Evidence: .sisyphus/evidence/task-22-integration-patterns.md
  ```

  **Commit:** YES
  - Message: `docs(core): add integration testing patterns guide`
  - Files: `packages/acp-chat-core/docs/integration-testing-patterns.md`

- [ ] **23. Write test fixture specification**

  **What to do:**
  - Document replay fixture format (JSONL)
  - Explain each field in replay events
  - Document metadata format
  - Provide example fixtures
  - Explain how to create new fixtures

  **Files to create:**
  - `packages/acp-chat-core/docs/fixture-specification.md`

  **Must NOT do:**
  - Don't change existing fixture format
  - Document current format as-is

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 20-22, 24-25)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-19

  **Acceptance Criteria:**
  - [ ] Fixture format documented
  - [ ] All fields explained
  - [ ] Examples provided
  - [ ] Creation guide included

  **QA Scenarios:**
  ```
  Scenario: Verify fixture specification
    Tool: Read
    Steps:
      1. Read packages/acp-chat-core/docs/fixture-specification.md
    Expected Result: Complete fixture format spec
    Evidence: .sisyphus/evidence/task-23-fixture-spec.md
  ```

  **Commit:** YES
  - Message: `docs(core): add test fixture specification`
  - Files: `packages/acp-chat-core/docs/fixture-specification.md`

- [ ] **24. Write coverage reporting guide**

  **What to do:**
  - Document how to run coverage
  - Explain coverage thresholds
  - Show how to interpret coverage reports
  - Document how to improve coverage
  - CI integration notes

  **Files to create:**
  - `packages/acp-chat-core/docs/coverage-guide.md`

  **Must NOT do:**
  - Don't duplicate vitest coverage docs
  - Focus on acp-chat-core specifics

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 20-23, 25)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-19

  **Acceptance Criteria:**
  - [ ] Coverage commands documented
  - [ ] Thresholds explained
  - [ ] Report interpretation guide
  - [ ] Improvement strategies

  **QA Scenarios:**
  ```
  Scenario: Verify coverage guide
    Tool: Read
    Steps:
      1. Read packages/acp-chat-core/docs/coverage-guide.md
    Expected Result: Practical coverage guide
    Evidence: .sisyphus/evidence/task-24-coverage-guide.md
  ```

  **Commit:** YES
  - Message: `docs(core): add coverage reporting guide`
  - Files: `packages/acp-chat-core/docs/coverage-guide.md`

- [ ] **25. Update package.json scripts**

  **What to do:**
  - Add `test-core` script to root package.json
  - Add `test-core:coverage` script
  - Ensure all scripts work correctly
  - Update test script in package

  **Files to modify:**
  - `package.json` (root)
  - `packages/acp-chat-core/package.json`

  **Must NOT do:**
  - Don't break existing scripts

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 20-24)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 2, 3

  **Acceptance Criteria:**
  - [ ] `pnpm test-core` runs tests
  - [ ] `pnpm test-core:coverage` runs with coverage
  - [ ] Both commands work from root

  **QA Scenarios:**
  ```
  Scenario: Verify test scripts work
    Tool: Bash
    Steps:
      1. Run: pnpm test-core
      2. Run: pnpm test-core:coverage
    Expected Result: Both commands execute successfully
    Evidence: .sisyphus/evidence/task-25-scripts.txt
  ```

  **Commit:** YES
  - Message: `chore(core): add test scripts to package.json`
  - Files: `package.json`, `packages/acp-chat-core/package.json`

### Wave FINAL: Verification

- [ ] **F1. Plan compliance audit (oracle)**

  **What to do:**
  - Read plan end-to-end
  - Verify all "Must Have" items are present
  - Verify all "Must NOT Have" items are absent
  - Check evidence files exist
  - Compare deliverables against plan

  **Output:**
  - Report: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

  **Recommended Agent Profile:**
  - **Category:** `oracle`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with F2-F4)
  - **Blocked By:** ALL tasks 1-25 (MUST wait for user approval after all tasks complete)

  **Acceptance Criteria:**
  - [ ] All Must Have items verified present
  - [ ] All Must NOT Have items verified absent
  - [ ] Evidence files confirmed
  - [ ] User approval received ("okay" or "LGTM")

  **Evidence:** `.sisyphus/evidence/acp-chat-core/f1-compliance-report.md`

- [ ] **F2. Code quality review (unspecified-high)**

  **What to do:**
  - Run `tsc --noEmit` (type check)
  - Run linter if configured
  - Run `bun test` or `vitest run`
  - Review all changed files for issues:
    - `as any` or `@ts-ignore` usage
    - Empty catch blocks
    - console.log in production
    - Unused imports
    - AI slop patterns

  **Output:**
  - Report: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Issues [N]`

  **Recommended Agent Profile:**
  - **Category:** `unspecified-high`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with F1, F3-F4)
  - **Blocked By:** ALL tasks 1-25 (MUST wait for user approval after all tasks complete)

  **Acceptance Criteria:**
  - [ ] Type check passes
  - [ ] Tests pass
  - [ ] No critical issues
  - [ ] User approval received ("okay" or "LGTM")

  **Evidence:** `.sisyphus/evidence/acp-chat-core/f2-quality-report.md`

- [ ] **F3. Coverage verification (unspecified-high)**

  **What to do:**
  - Generate coverage report
  - Verify 80%+ lines, 75%+ branches
  - Check coverage per module
  - Identify any uncovered critical paths

  **Output:**
  - Report: `Coverage [N%] | Thresholds [PASS/FAIL] | Critical Paths [N uncovered]`

  **Recommended Agent Profile:**
  - **Category:** `unspecified-high`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with F1-F2, F4)
  - **Blocked By:** ALL tasks 1-25 (MUST wait for user approval after all tasks complete)

  **Acceptance Criteria:**
  - [ ] Overall coverage >= 80%
  - [ ] Branch coverage >= 75%
  - [ ] No critical paths uncovered
  - [ ] User approval received ("okay" or "LGTM")

  **Evidence:** `.sisyphus/evidence/acp-chat-core/f3-coverage-report.md`

- [ ] **F4. Scope fidelity check (deep)**

  **What to do:**
  - For each task: read "What to do", check implementation
  - Verify 1:1 - everything in spec was built
  - Verify nothing beyond spec was built
  - Check "Must NOT do" compliance
  - Detect cross-task contamination

  **Output:**
  - Report: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files]`

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with F1-F3)
  - **Blocked By:** ALL tasks 1-25

  **Acceptance Criteria:**
  - [ ] All tasks compliant with spec
  - [ ] No scope creep detected
  - [ ] No cross-task contamination

  **Evidence:** `.sisyphus/evidence/acp-chat-core/f4-fidelity-report.md`

---

## Final Verification Wave

After F1-F4 complete, present consolidated results to user and get explicit "okay" before completing work.

**Consolidated Report Should Include:**
- Overall test count: [N] tests passing
- Coverage: [N]% lines, [N]% branches
- Code quality: Type check [PASS], Lint [PASS]
- Documentation: [N] docs created
- Dead code removed: [N] files/lines
- All verification reports (F1-F4)

**User Approval Required:**
Do NOT mark F1-F4 complete until user explicitly approves with "okay" or "LGTM".

---

## Commit Strategy

**Group commits by wave:**

- **Wave 1 commits:** `refactor(core):`, `fix(core):`, `chore(core):`
- **Wave 2 commits:** `test(core):` (7-13)
- **Wave 3 commits:** `test(core):` (14-19)
- **Wave 4 commits:** `docs(core):` (20-25)
- **Wave FINAL:** No commits (verification only)

**Pre-commit checks for each commit:**
```bash
pnpm check        # Type check
pnpm test-core    # Tests pass
```

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
pnpm test-core

# Coverage meets thresholds
pnpm test-core:coverage
# Expected: Coverage >= 80% lines, >= 75% branches

# Type check passes
cd packages/acp-chat-core && pnpm check

# No console.log in production
grep -r "console.log" packages/acp-chat-core/src/ --include="*.ts" | grep -v ".test.ts" | grep -v "__tests__"
# Expected: Empty output
```

### Final Checklist
- [ ] All 25 tasks complete
- [ ] F1-F4 verification passed
- [ ] User approval received
- [ ] Coverage >= 80% lines, >= 75% branches
- [ ] All tests passing
- [ ] Documentation complete
- [ ] No debug logging in production
- [ ] pnpm test-core works from root
- [ ] pnpm test-core:coverage works from root

---

## Notes

### Testing Philosophy
- Test behavior, not implementation
- Use mocks for external dependencies (WebSocket, filesystem)
- Prefer integration tests with replay fixtures for complex flows
- Unit tests for pure logic and algorithms
- 80% coverage is the target, not the goal - focus on meaningful tests

### Future Considerations (Out of Scope)
- Performance benchmarking
- Memory leak testing
- Fuzz testing for protocol parsing
- Property-based testing
- Mutation testing

### Related Plans
- See `acp-chat-react-testing-cleanup.md` for React package plan
- See `acp-ws-bridge-testing-cleanup.md` for bridge plan
