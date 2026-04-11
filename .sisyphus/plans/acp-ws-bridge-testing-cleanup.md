# Plan: ACP WS-Bridge - Testing & Cleanup

## TL;DR

> **Comprehensive testing overhaul for both the Rust crate and npm package of the WebSocket bridge.**
>
> **Deliverables:**
> - Type inconsistencies fixed (BridgeEnvelope `extra_data` field)
> - Rust test suite with 80%+ coverage
> - TypeScript test suite with 80%+ coverage
> - WebSocket protocol tests
> - Transport client tests
> - Bridge envelope validation tests
> - Rust testing documentation
> - TypeScript testing documentation
> - `pnpm test-bridge` command working
> - `cargo test` working in Rust crate
>
> **Estimated Effort:** Large (35-40 tasks across 5 waves)
> **Parallel Execution:** YES - Rust and TypeScript can run in parallel
> **Critical Path:** Type Fixes → Rust Tests → TypeScript Tests → Documentation

---

## Context

### Current State Analysis

**Package:** `@harms-haus/acp-ws-bridge` (npm) + `harms_haus_acp_ws_bridge` (Rust)  
**Locations:** 
- `/crates/acp-ws-bridge` (Rust)
- `/packages/acp-ws-bridge` (TypeScript)

**Critical Issues Found:**

1. **NO TESTS EXIST** (Both Rust and TypeScript)
   - Rust crate: No `#[cfg(test)]` modules, no test files
   - npm package: No `.test.ts` files, vitest runs but finds nothing
   - Zero test coverage

2. **Type Inconsistency** (CRITICAL)
   - Rust `BridgeEnvelope` has `extra_data: Option<serde_json::Value>`
   - TypeScript `BridgeEnvelope` MISSING `extraData` field
   - Protocol incompatibility between Rust server and TypeScript client

3. **Debug Code in Production**
   - `console.trace` statements in `client.ts`
   - Should be removed or behind debug flag

4. **Duplicate Type Definitions**
   - npm package has manual type definitions
   - acp-chat-core has generated types from Rust
   - Risk of drift between definitions

### Rust Crate Structure

```
crates/acp-ws-bridge/
├── Cargo.toml              # Dependencies: tokio, tokio-tungstenite, serde, ts-rs
├── src/
│   ├── lib.rs             # Entry point, exports modules
│   ├── contract/
│   │   ├── mod.rs         # Version constants (ENVELOPE_VERSION=1)
│   │   ├── envelope.rs    # BridgeEnvelope with extra_data
│   │   └── message.rs     # BridgeMessage enum (6 variants)
│   └── server/
│       └── mod.rs         # Generic WebSocket server
├── bindings/              # Generated TypeScript (from ts-rs)
│   ├── BridgeEnvelope.ts  # HAS extra_data
│   ├── BridgeMessage.ts
│   ├── BridgeStatus.ts
│   └── UnsupportedVersionError.ts
└── docs/
    └── extra-data-design.md
```

**Code Metrics:**
- Rust source: ~400 lines
- Zero tests
- No test infrastructure configured

### NPM Package Structure

```
packages/acp-ws-bridge/
├── package.json           # Version 0.0.1
├── src/
│   ├── index.ts          # Main exports (8 lines)
│   ├── client.ts         # TransportClient (313 lines)
│   └── types/
│       ├── index.ts      # Re-exports
│       ├── BridgeEnvelope.ts    # MISSING extra_data
│       ├── BridgeMessage.ts
│       ├── BridgeStatus.ts
│       └── UnsupportedVersionError.ts
└── dist/                 # Compiled output
```

**Code Metrics:**
- TypeScript source: ~500 lines
- Zero tests
- Vitest configured but no test files

### Bridge Protocol

**Message Flow:**
```
Browser (React)
    ↓ WebSocket
TransportClient (TypeScript)
    ↓ BridgeEnvelope (JSON)
WebSocket Bridge (Rust)
    ↓ ACP stdio
ACP Agent
```

**BridgeEnvelope Structure:**
```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "extra_data": {...},     // MISSING in TypeScript!
  "type": "acp_payload" | "bridge_status" | ...
}
```

**BridgeMessage Variants:**
1. `AcpPayload` - Raw ACP JSON-RPC
2. `BridgeStatus` - Lifecycle state change
3. `Stderr` - stderr line from process
4. `ProcessExit` - Process termination
5. `ReplayMetadata` - Replay session info
6. `StartAgent` - Command to spawn agent

---

## Work Objectives

### Core Objective
Transform acp-ws-bridge from "zero tests and type inconsistencies" to a production-grade WebSocket bridge with 80%+ test coverage on both Rust and TypeScript sides, consistent types, and comprehensive documentation.

### Concrete Deliverables

**Type Fixes (Critical):**
- [ ] Add `extraData` field to TypeScript BridgeEnvelope
- [ ] Verify type consistency between Rust and TypeScript
- [ ] Consolidate type definitions (use single source of truth)

**Rust Tests:**
- [ ] BridgeEnvelope unit tests
- [ ] BridgeMessage unit tests
- [ ] Envelope parsing/validation tests
- [ ] Version negotiation tests
- [ ] WebSocket server tests
- [ ] Error handling tests
- [ ] Integration tests

**TypeScript Tests:**
- [ ] TransportClient unit tests
- [ ] Connection lifecycle tests
- [ ] Reconnection logic tests
- [ ] Event handling tests
- [ ] Envelope serialization tests
- [ ] Error handling tests
- [ ] Integration tests

**Documentation:**
- [ ] Rust testing guide
- [ ] TypeScript testing guide
- [ ] Bridge protocol documentation
- [ ] Test fixture format
- [ ] Coverage guide for both languages

### Definition of Done
- [ ] `cargo test` runs successfully in Rust crate (all tests passing)
- [ ] `pnpm test-bridge` runs successfully (all tests passing)
- [ ] Coverage >= 80% for both Rust and TypeScript
- [ ] Type consistency verified between Rust and TypeScript
- [ ] `extra_data` field present in both implementations
- [ ] All new tests include agent-executed QA scenarios
- [ ] Documentation complete

### Must Have (Non-Negotiable)
- 80%+ test coverage for both Rust and TypeScript
- Type consistency (extra_data field in both)
- All existing functionality preserved
- `cargo test` working
- `pnpm test-bridge` working
- Comprehensive documentation

### Must NOT Have (Explicit Exclusions)
- No CI/CD setup (out of scope)
- No integration with external test harness (out of scope)
- No cross-library shared test code (per requirements)
- No changes to bridge protocol (pure ACP standard)
- No breaking API changes

---

## Verification Strategy

### Testing Frameworks

**Rust:**
- **Framework:** Built-in `cargo test` (no additional setup)
- **Coverage:** `cargo-tarpaulin` or `cargo-llvm-cov`
- **Mocking:** `mockall` for traits, `faux` for structs
- **Assertions:** Standard `assert!`, `assert_eq!`

**TypeScript:**
- **Framework:** Vitest 2.1.0 (already configured)
- **Environment:** Node.js with `ws` mock
- **Coverage:** v8 provider
- **Mocking:** Vitest built-in (vi.fn, vi.mock)

### Test Commands

```bash
# Rust tests
cd crates/acp-ws-bridge && cargo test

# Rust tests with coverage
cd crates/acp-ws-bridge && cargo tarpaulin --out Html

# TypeScript tests
pnpm test-bridge

# TypeScript tests with coverage
pnpm test-bridge:coverage

# All bridge tests
pnpm test-bridge-all  # Runs both Rust and TypeScript
```

### QA Policy
Every task MUST include agent-executed QA scenarios:

- **Rust tests:** `cargo test` with assertions
- **TypeScript tests:** `vitest run` with assertions
- **Coverage:** Generate and verify coverage reports
- **Type consistency:** Verify TypeScript types match Rust

**Evidence:** All test results, coverage reports saved to `.sisyphus/evidence/acp-ws-bridge/`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Type Fixes & Infrastructure):
├── Task 1: Add extraData field to TypeScript BridgeEnvelope
├── Task 2: Consolidate type definitions (remove duplicates)
├── Task 3: Remove debug console.trace from client.ts
├── Task 4: Set up Rust test infrastructure (Cargo.toml)
├── Task 5: Set up TypeScript coverage configuration
└── Task 6: Create test utilities (both Rust and TS)

Wave 2 (Rust Tests - MAX PARALLEL):
├── Task 7: BridgeEnvelope unit tests
├── Task 8: BridgeMessage unit tests
├── Task 9: Envelope parsing/validation tests
├── Task 10: Version negotiation tests
├── Task 11: Bridge envelope serialization tests
└── Task 12: Error handling tests (Rust)

Wave 3 (TypeScript Tests - MAX PARALLEL):
├── Task 13: TransportClient connection tests
├── Task 14: TransportClient reconnection tests
├── Task 15: Event handling tests
├── Task 16: Envelope serialization tests (TS)
├── Task 17: Error handling tests (TS)
└── Task 18: WebSocket mock utilities

Wave 4 (Integration Tests):
├── Task 19: Rust WebSocket server integration tests
├── Task 20: TypeScript client-server integration tests
├── Task 21: End-to-end message flow tests
├── Task 22: Error scenario integration tests
└── Task 23: Protocol compliance tests

Wave 5 (Documentation & Finalization):
├── Task 24: Write Rust testing guide
├── Task 25: Write TypeScript testing guide
├── Task 26: Write bridge protocol documentation
├── Task 27: Write test fixture specification
├── Task 28: Write coverage guide
└── Task 29: Update package.json and Cargo.toml scripts

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Coverage verification (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix

- **1-6**: No dependencies (can run in parallel)
- **7-12**: Depends on 4 (Rust test infra)
- **13-18**: Depends on 5, 6 (TS test infra)
- **19-23**: Depends on 7-18 (unit tests complete)
- **24-29**: Depends on 7-23 (tests complete)
- **F1-F4**: Depends on ALL tasks 1-29

### Agent Dispatch Summary

- **Wave 1**: 6 tasks → `quick` (type fixes, config)
- **Wave 2**: 6 tasks → `deep` (Rust tests)
- **Wave 3**: 6 tasks → `deep` (TypeScript tests)
- **Wave 4**: 5 tasks → `deep` (integration)
- **Wave 5**: 6 tasks → `writing` (documentation)
- **Wave FINAL**: 4 tasks → `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

### Wave 1: Foundation - Type Fixes & Infrastructure

- [ ] **1. Add extraData field to TypeScript BridgeEnvelope**

  **What to do:**
  - Add `extraData?: Record<string, unknown>` field to TypeScript BridgeEnvelope
  - Update in `packages/acp-ws-bridge/src/types/BridgeEnvelope.ts`
  - Also update in `packages/acp-chat-core/src/generated/BridgeEnvelope.ts`
  - Ensure field matches Rust: optional JSON object

  **Files to modify:**
  - `packages/acp-ws-bridge/src/types/BridgeEnvelope.ts`
  - `packages/acp-chat-core/src/generated/BridgeEnvelope.ts`

  **Must NOT do:**
  - Don't modify Rust source (it's correct)
  - Don't break existing code that creates BridgeEnvelope

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - `crates/acp-ws-bridge/src/contract/envelope.rs` - Rust implementation
  - `crates/acp-ws-bridge/bindings/BridgeEnvelope.ts` - Generated TypeScript with extra_data

  **Acceptance Criteria:**
  - [ ] `extraData` field present in TypeScript BridgeEnvelope
  - [ ] TypeScript compilation passes
  - [ ] Field matches Rust type (optional JSON)

  **QA Scenarios:**
  ```
  Scenario: Verify extraData field exists
    Tool: Bash (grep)
    Steps:
      1. Run: grep "extraData" packages/acp-ws-bridge/src/types/BridgeEnvelope.ts
      2. Run: grep "extraData" packages/acp-chat-core/src/generated/BridgeEnvelope.ts
    Expected Result: Shows extraData field in both files
    Evidence: .sisyphus/evidence/task-1-extradata-field.txt
  ```

  **Commit:** YES
  - Message: `fix(bridge): add extraData field to BridgeEnvelope types`
  - Files: `packages/acp-ws-bridge/src/types/BridgeEnvelope.ts`, `packages/acp-chat-core/src/generated/BridgeEnvelope.ts`

- [ ] **2. Consolidate type definitions**

  **What to do:**
  - Review type definitions in npm package vs acp-chat-core
  - Decide on single source of truth
  - Remove duplicate definitions
  - Update imports

  **Options:**
  - Option A: Use acp-chat-core generated types exclusively
  - Option B: Keep npm package types but ensure consistency

  **Files to examine:**
  - `packages/acp-ws-bridge/src/types/`
  - `packages/acp-chat-core/src/generated/`

  **Must NOT do:**
  - Don't break public API
  - Don't create circular dependencies

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with task 1)
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **Acceptance Criteria:**
  - [ ] Duplicates identified
  - [ ] Consolidation strategy decided
  - [ ] Types consolidated (if applicable)

  **QA Scenarios:**
  ```
  Scenario: Verify type consolidation
    Tool: Bash
    Steps:
      1. Compare types in both packages
      2. Verify no duplicate definitions
    Expected Result: Types consistent across packages
    Evidence: .sisyphus/evidence/task-2-type-consolidation.txt
  ```

  **Commit:** YES (if consolidation done)
  - Message: `refactor(bridge): consolidate type definitions`

- [ ] **3. Remove debug console.trace from client.ts**

  **What to do:**
  - Find all `console.trace` statements in `client.ts`
  - Remove or guard with DEBUG flag
  - Check for other debug logging

  **Files to modify:**
  - `packages/acp-ws-bridge/src/client.ts`

  **Must NOT do:**
  - Don't remove legitimate error logging
  - Focus on debug/trace statements

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **Acceptance Criteria:**
  - [ ] Debug statements removed or guarded
  - [ ] No console.trace in production code

  **QA Scenarios:**
  ```
  Scenario: Verify debug code removed
    Tool: Bash (grep)
    Steps:
      1. Run: grep -n "console.trace" packages/acp-ws-bridge/src/client.ts
    Expected Result: Empty or only in debug paths
    Evidence: .sisyphus/evidence/task-3-debug-removed.txt
  ```

  **Commit:** YES
  - Message: `refactor(bridge): remove debug console.trace statements`
  - Files: `packages/acp-ws-bridge/src/client.ts`

- [ ] **4. Set up Rust test infrastructure**

  **What to do:**
  - Add test dependencies to Cargo.toml (if needed)
  - Add `tokio-test` for async tests
  - Add `mockall` for mocking
  - Create test directory structure

  **Files to modify:**
  - `crates/acp-ws-bridge/Cargo.toml`

  **Must NOT do:**
  - Don't add unnecessary dependencies

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **Acceptance Criteria:**
  - [ ] Test dependencies added
  - [ ] `cargo test` compiles (even if no tests yet)

  **QA Scenarios:**
  ```
  Scenario: Verify Rust test setup
    Tool: Bash
    Steps:
      1. Run: cd crates/acp-ws-bridge && cargo test --no-run
    Expected Result: Compiles successfully
    Evidence: .sisyphus/evidence/task-4-rust-test-infra.txt
  ```

  **Commit:** YES
  - Message: `chore(bridge): add Rust test dependencies`
  - Files: `crates/acp-ws-bridge/Cargo.toml`

- [ ] **5. Set up TypeScript coverage configuration**

  **What to do:**
  - Add coverage config to vitest.config.ts
  - Set thresholds: 80% lines, 75% branches
  - Configure reporters

  **Files to create/modify:**
  - `packages/acp-ws-bridge/vitest.config.ts` (may need to create)

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **Acceptance Criteria:**
  - [ ] Coverage configuration added
  - [ ] `pnpm vitest run --coverage` works

  **QA Scenarios:**
  ```
  Scenario: Verify coverage config
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run --coverage packages/acp-ws-bridge
    Expected Result: Coverage report generated
    Evidence: .sisyphus/evidence/task-5-coverage-config.txt
  ```

  **Commit:** YES
  - Message: `chore(bridge): add coverage configuration`
  - Files: `packages/acp-ws-bridge/vitest.config.ts`

- [ ] **6. Create test utilities**

  **What to do:**
  - Create Rust test utilities
  - Create TypeScript test utilities
  - Add WebSocket mock for TypeScript
  - Add test data builders

  **Files to create:**
  - `crates/acp-ws-bridge/src/test_utils.rs`
  - `packages/acp-ws-bridge/src/test-utils.ts`

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **Acceptance Criteria:**
  - [ ] Test utilities created
  - [ ] Can be imported in tests

  **QA Scenarios:**
  ```
  Scenario: Verify test utilities
    Tool: Bash
    Steps:
      1. Check test utility files exist
      2. Verify imports work
    Expected Result: Utilities available
    Evidence: .sisyphus/evidence/task-6-test-utils.txt
  ```

  **Commit:** YES
  - Message: `feat(bridge): add test utilities`
  - Files: Test utility files

### Wave 2: Rust Tests

- [ ] **7. BridgeEnvelope unit tests**

  **What to do:**
  - Test BridgeEnvelope construction
  - Test `new()` and `new_replay()` constructors
  - Test `is_supported_version()`
  - Test serialization/deserialization
  - Test extra_data handling

  **Files to create:**
  - `crates/acp-ws-bridge/src/contract/envelope_test.rs` or inline tests

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 8-12)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Task 4

  **Acceptance Criteria:**
  - [ ] All BridgeEnvelope methods tested
  - [ ] Coverage >= 80%
  - [ ] All tests pass

  **QA Scenarios:**
  ```
  Scenario: Run BridgeEnvelope tests
    Tool: Bash
    Steps:
      1. Run: cd crates/acp-ws-bridge && cargo test envelope
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-7-rust-envelope-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add BridgeEnvelope unit tests`

- [ ] **8. BridgeMessage unit tests**

  **What to do:**
  - Test all 6 BridgeMessage variants
  - Test serialization for each variant
  - Test factory methods
  - Test status variants

  **Files to create:**
  - `crates/acp-ws-bridge/src/contract/message_test.rs` or inline tests

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7, 9-12)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Task 4

  **Acceptance Criteria:**
  - [ ] All message variants tested
  - [ ] Coverage >= 80%

  **QA Scenarios:**
  ```
  Scenario: Run BridgeMessage tests
    Tool: Bash
    Steps:
      1. Run: cd crates/acp-ws-bridge && cargo test message
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-8-rust-message-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add BridgeMessage unit tests`

- [ ] **9. Envelope parsing/validation tests**

  **What to do:**
  - Test valid envelope parsing
  - Test invalid envelope rejection
  - Test version validation
  - Test malformed JSON handling

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-8, 10-12)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Task 4

  **Acceptance Criteria:**
  - [ ] Valid/invalid parsing tested
  - [ ] Edge cases covered

  **QA Scenarios:**
  ```
  Scenario: Run parsing tests
    Tool: Bash
    Steps:
      1. Run: cd crates/acp-ws-bridge && cargo test parse
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-9-rust-parse-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add envelope parsing tests`

- [ ] **10. Version negotiation tests**

  **What to do:**
  - Test supported version detection
  - Test unsupported version rejection
  - Test version 1 specifically
  - Test future version handling

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-9, 11-12)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Task 4

  **Acceptance Criteria:**
  - [ ] Version negotiation tested
  - [ ] Error cases covered

  **QA Scenarios:**
  ```
  Scenario: Run version tests
    Tool: Bash
    Steps:
      1. Run: cd crates/acp-ws-bridge && cargo test version
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-10-rust-version-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add version negotiation tests`

- [ ] **11. Bridge envelope serialization tests**

  **What to do:**
  - Test JSON serialization
  - Test deserialization
  - Test round-trip (serialize then deserialize)
  - Test with extra_data

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-10, 12)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Task 4

  **Acceptance Criteria:**
  - [ ] Serialization tested
  - [ ] Round-trip verified
  - [ ] extra_data included

  **QA Scenarios:**
  ```
  Scenario: Run serialization tests
    Tool: Bash
    Steps:
      1. Run: cd crates/acp-ws-bridge && cargo test serialize
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-11-rust-serialize-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add serialization tests`

- [ ] **12. Error handling tests (Rust)**

  **What to do:**
  - Test UnsupportedVersionError
  - Test error messages
  - Test error conditions

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-11)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Task 4

  **Acceptance Criteria:**
  - [ ] Error types tested
  - [ ] Error messages verified

  **QA Scenarios:**
  ```
  Scenario: Run error tests
    Tool: Bash
    Steps:
      1. Run: cd crates/acp-ws-bridge && cargo test error
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-12-rust-error-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add error handling tests`

### Wave 3: TypeScript Tests

- [ ] **13. TransportClient connection tests**

  **What to do:**
  - Test connection establishment
  - Test disconnection
  - Test connection state transitions
  - Test connection errors

  **Files to create:**
  - `packages/acp-ws-bridge/src/client.test.ts`

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 14-18)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Tasks 5, 6

  **Acceptance Criteria:**
  - [ ] Connection lifecycle tested
  - [ ] State transitions verified
  - [ ] Mock WebSocket used

  **QA Scenarios:**
  ```
  Scenario: Run connection tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-ws-bridge/src/client.test.ts -t "connection"
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-13-ts-connection-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add TransportClient connection tests`

- [ ] **14. TransportClient reconnection tests**

  **What to do:**
  - Test auto-reconnect
  - Test exponential backoff
  - Test max retry limit
  - Test reconnection state

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 13, 15-18)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Tasks 5, 6

  **Acceptance Criteria:**
  - [ ] Reconnection logic tested
  - [ ] Backoff verified
  - [ ] Timers mocked

  **QA Scenarios:**
  ```
  Scenario: Run reconnection tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-ws-bridge/src/client.test.ts -t "reconnect"
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-14-ts-reconnect-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add reconnection tests`

- [ ] **15. Event handling tests**

  **What to do:**
  - Test event subscription
  - Test event emission
  - Test event callback invocation
  - Test event cleanup

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 13-14, 16-18)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Tasks 5, 6

  **Acceptance Criteria:**
  - [ ] Events tested
  - [ ] Callbacks verified
  - [ ] Cleanup tested

  **QA Scenarios:**
  ```
  Scenario: Run event tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-ws-bridge/src/client.test.ts -t "event"
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-15-ts-event-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add event handling tests`

- [ ] **16. Envelope serialization tests (TS)**

  **What to do:**
  - Test envelope serialization
  - Test deserialization
  - Test with extra_data
  - Test round-trip

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 13-15, 17-18)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Tasks 5, 6

  **Acceptance Criteria:**
  - [ ] Serialization tested
  - [ ] extra_data included
  - [ ] Round-trip verified

  **QA Scenarios:**
  ```
  Scenario: Run serialization tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-ws-bridge/src/types/ --testNamePattern="serialize"
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-16-ts-serialize-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add TypeScript serialization tests`

- [ ] **17. Error handling tests (TS)**

  **What to do:**
  - Test error scenarios
  - Test error event emission
  - Test error recovery

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 13-16, 18)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Tasks 5, 6

  **Acceptance Criteria:**
  - [ ] Errors tested
  - [ ] Recovery verified

  **QA Scenarios:**
  ```
  Scenario: Run error tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-ws-bridge/src/client.test.ts -t "error"
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-17-ts-error-tests.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add TypeScript error tests`

- [ ] **18. WebSocket mock utilities**

  **What to do:**
  - Create comprehensive WebSocket mock
  - Support connection/disconnection simulation
  - Support message sending/receiving
  - Support error simulation

  **Files to create:**
  - `packages/acp-ws-bridge/src/test-utils/mock-websocket.ts`

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 13-17)
  - **Parallel Group:** Wave 3
  - **Blocked By:** Tasks 5, 6

  **Acceptance Criteria:**
  - [ ] Mock WebSocket works
  - [ ] Used in tests

  **QA Scenarios:**
  ```
  Scenario: Verify mock WebSocket
    Tool: Bash
    Steps:
      1. Check mock exists
      2. Verify used in tests
    Expected Result: Mock working
    Evidence: .sisyphus/evidence/task-18-mock-ws.txt
  ```

  **Commit:** YES
  - Message: `feat(bridge): add WebSocket mock utilities`

### Wave 4: Integration Tests

- [ ] **19. Rust WebSocket server integration tests**

  **What to do:**
  - Test server startup
  - Test connection acceptance
  - Test message handling
  - Test init/disconnect flow

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 20-23)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-18

  **Acceptance Criteria:**
  - [ ] Server integration tested
  - [ ] Client-server flow works

  **QA Scenarios:**
  ```
  Scenario: Run server integration tests
    Tool: Bash
    Steps:
      1. Run: cd crates/acp-ws-bridge && cargo test integration
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-19-rust-integration.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add Rust server integration tests`

- [ ] **20. TypeScript client-server integration tests**

  **What to do:**
  - Test client connection to server
  - Test message exchange
  - Test end-to-end flow

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 19, 21-23)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-18

  **Acceptance Criteria:**
  - [ ] Client-server tested
  - [ ] End-to-end flow works

  **QA Scenarios:**
  ```
  Scenario: Run client-server tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-ws-bridge/src/__tests__/integration.test.ts
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-20-ts-integration.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add client-server integration tests`

- [ ] **21. End-to-end message flow tests**

  **What to do:**
  - Test full message flow
  - Test all message types
  - Test bidirectional communication

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 19-20, 22-23)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-18

  **Acceptance Criteria:**
  - [ ] Message flow tested
  - [ ] All types covered

  **QA Scenarios:**
  ```
  Scenario: Run message flow tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-ws-bridge --testNamePattern="flow"
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-21-message-flow.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add message flow integration tests`

- [ ] **22. Error scenario integration tests**

  **What to do:**
  - Test error handling in flow
  - Test recovery
  - Test edge cases

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 19-21, 23)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-18

  **Acceptance Criteria:**
  - [ ] Errors tested
  - [ ] Recovery verified

  **QA Scenarios:**
  ```
  Scenario: Run error scenario tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-ws-bridge --testNamePattern="error"
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-22-error-scenarios.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add error scenario integration tests`

- [ ] **23. Protocol compliance tests**

  **What to do:**
  - Test ACP protocol compliance
  - Test Bridge protocol compliance
  - Test message format compliance

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 19-22)
  - **Parallel Group:** Wave 4
  - **Blocked By:** Tasks 7-18

  **Acceptance Criteria:**
  - [ ] Protocol compliance verified
  - [ ] Format validation tested

  **QA Scenarios:**
  ```
  Scenario: Run protocol compliance tests
    Tool: Bash
    Steps:
      1. Run: cargo test protocol
      2. Run: pnpm vitest run packages/acp-ws-bridge --testNamePattern="protocol"
    Expected Result: Tests pass
    Evidence: .sisyphus/evidence/task-23-protocol.txt
  ```

  **Commit:** YES
  - Message: `test(bridge): add protocol compliance tests`

### Wave 5: Documentation

- [ ] **24. Write Rust testing guide**

  **What to do:**
  - Document Rust testing approach
  - Show how to run tests
  - Explain mocking strategies
  - Provide examples

  **Files to create:**
  - `crates/acp-ws-bridge/TESTING.md`

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 25-29)
  - **Parallel Group:** Wave 5
  - **Blocked By:** Tasks 7-23

  **Acceptance Criteria:**
  - [ ] Rust testing documented
  - [ ] Examples provided

  **Commit:** YES
  - Message: `docs(bridge): add Rust testing guide`

- [ ] **25. Write TypeScript testing guide**

  **What to do:**
  - Document TypeScript testing approach
  - Show how to run tests
  - Explain WebSocket mocking
  - Provide examples

  **Files to create:**
  - `packages/acp-ws-bridge/TESTING.md`

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 24, 26-29)
  - **Parallel Group:** Wave 5
  - **Blocked By:** Tasks 7-23

  **Acceptance Criteria:**
  - [ ] TypeScript testing documented
  - [ ] Examples provided

  **Commit:** YES
  - Message: `docs(bridge): add TypeScript testing guide`

- [ ] **26. Write bridge protocol documentation**

  **What to do:**
  - Document bridge protocol
  - Explain message types
  - Document envelope format
  - Provide examples

  **Files to create:**
  - `packages/acp-ws-bridge/docs/protocol.md`

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 24-25, 27-29)
  - **Parallel Group:** Wave 5
  - **Blocked By:** Tasks 7-23

  **Acceptance Criteria:**
  - [ ] Protocol documented
  - [ ] Examples provided

  **Commit:** YES
  - Message: `docs(bridge): add protocol documentation`

- [ ] **27. Write test fixture specification**

  **What to do:**
  - Document test fixture format
  - Show how to create fixtures
  - Document usage in tests

  **Files to create:**
  - `packages/acp-ws-bridge/docs/fixtures.md`

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 24-26, 28-29)
  - **Parallel Group:** Wave 5
  - **Blocked By:** Tasks 7-23

  **Acceptance Criteria:**
  - [ ] Fixtures documented
  - [ ] Examples provided

  **Commit:** YES
  - Message: `docs(bridge): add fixture specification`

- [ ] **28. Write coverage guide**

  **What to do:**
  - Document coverage commands
  - Explain thresholds
  - Show how to interpret reports

  **Files to create:**
  - `packages/acp-ws-bridge/docs/coverage.md`

  **Recommended Agent Profile:**
  - **Category:** `writing`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 24-27, 29)
  - **Parallel Group:** Wave 5
  - **Blocked By:** Tasks 7-23

  **Acceptance Criteria:**
  - [ ] Coverage documented
  - [ ] Commands explained

  **Commit:** YES
  - Message: `docs(bridge): add coverage guide`

- [ ] **29. Update package.json and Cargo.toml scripts**

  **What to do:**
  - Add `test-bridge` script to root package.json
  - Add `test-bridge:coverage` script
  - Update Cargo.toml with test metadata

  **Files to modify:**
  - `package.json` (root)
  - `crates/acp-ws-bridge/Cargo.toml`

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 24-28)
  - **Parallel Group:** Wave 5
  - **Blocked By:** None

  **Acceptance Criteria:**
  - [ ] `pnpm test-bridge` works
  - [ ] `cargo test` works
  - [ ] Coverage commands work

  **QA Scenarios:**
  ```
  Scenario: Verify test scripts
    Tool: Bash
    Steps:
      1. Run: pnpm test-bridge
      2. Run: cd crates/acp-ws-bridge && cargo test
    Expected Result: Both work
    Evidence: .sisyphus/evidence/task-29-scripts.txt
  ```

  **Commit:** YES
  - Message: `chore(bridge): add test scripts`

### Wave FINAL: Verification

- [ ] **F1. Plan compliance audit (oracle)**

  Verify all requirements met.

  **Recommended Agent Profile:** `oracle`

  **Evidence:** `.sisyphus/evidence/acp-ws-bridge/f1-compliance.md`

- [ ] **F2. Code quality review (unspecified-high)**

  Type check, tests, lint.

  **Recommended Agent Profile:** `unspecified-high`

  **Evidence:** `.sisyphus/evidence/acp-ws-bridge/f2-quality.md`

- [ ] **F3. Coverage verification (unspecified-high)**

  Verify 80%+ coverage for both Rust and TS.

  **Recommended Agent Profile:** `unspecified-high`

  **Evidence:** `.sisyphus/evidence/acp-ws-bridge/f3-coverage.md`

- [ ] **F4. Scope fidelity check (deep)**

  Verify no scope creep.

  **Recommended Agent Profile:** `deep`

  **Evidence:** `.sisyphus/evidence/acp-ws-bridge/f4-fidelity.md`

---

## Success Criteria

### Verification Commands
```bash
# Rust tests
cd crates/acp-ws-bridge && cargo test
# Expected: All tests pass

# TypeScript tests
pnpm test-bridge
# Expected: All tests pass

# Rust coverage
cd crates/acp-ws-bridge && cargo tarpaulin --out Html
# Expected: >= 80% coverage

# TypeScript coverage
pnpm test-bridge:coverage
# Expected: >= 80% coverage

# Type consistency
node -e "const ts = require('./packages/acp-ws-bridge/dist/types/BridgeEnvelope.js'); console.log('extraData' in new ts.BridgeEnvelope())"
# Expected: Shows extraData field exists
```

### Final Checklist
- [ ] All 29 tasks complete
- [ ] F1-F4 verification passed
- [ ] User approval received
- [ ] Rust coverage >= 80%
- [ ] TypeScript coverage >= 80%
- [ ] Type consistency verified
- [ ] All tests passing
- [ ] Documentation complete
- [ ] pnpm test-bridge works
- [ ] cargo test works

---

## Notes

### Related Plans
- See `acp-chat-core-testing-cleanup.md` for core package plan
- See `acp-chat-react-testing-cleanup.md` for React package plan
