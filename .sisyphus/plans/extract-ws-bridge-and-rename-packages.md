# Extract WebSocket Bridge and Rename Packages

## TL;DR

> **Quick Summary**: Extract WebSocket server/client code from `acp-bridge` into a new reusable `acp-ws-bridge` crate/package. Rename the bridge binary to `acp-harness-server`, harness UI to `acp-harness-ui`, and add `@harms-haus/` prefix to all TypeScript packages.
>
> **Deliverables**:
> - New crate: `crates/acp-ws-bridge/` (harms_haus_acp_ws_bridge)
> - New package: `packages/acp-ws-bridge/` (@harms-haus/acp-ws-bridge)
> - Renamed crate: `crates/acp-harness-server/` (harms_haus_acp_harness_server, was acp-bridge)
> - Renamed package: `packages/acp-harness-ui/` (@harms-haus/acp-harness-ui, was apps/harness)
> - Renamed packages: @harms-haus/acp-chat-core, @harms-haus/acp-chat-react
> - Generic extra-data mechanism for replay speed and future extensions
> - Trace logging integration
> - Updated documentation (wiki, AGENTS.md, READMEs)
>
> **Estimated Effort**: Large (40+ tasks across 5 waves)
> **Parallel Execution**: YES - 5 execution waves
> **Critical Path**: Extract WS → Rename Crates → Rename Packages → Update Imports → Update Docs → Final Verification

---

## Context

### Original Request
Extract the websocket code from the bridge and harness ui into a crate and a package called `acp-ws-bridge`. Rename the original bridge executable to `acp-harness-server`. Rename harness UI to `acp-harness-ui`. Add `@harms-haus/` prefix to all TypeScript packages and `harms_haus_` prefix to Rust crates. Update all imports, types, and documentation.

### Key Decisions Made

**User Confirmed**:
1. **Rust crate naming**: Use underscore convention: `harms_haus_acp_ws_bridge`
2. **WebSocket extraction**: Server + Contract types only (replay modes stay in harness-server)
3. **Extra data mechanism**: Free-form JSON
4. **Backwards compatibility**: NO aliases - clean break
5. **Directory structure**: Simplified - no prefix in paths (`crates/acp-ws-bridge/`, not `crates/harms-haus-acp-ws-bridge/`)
6. **Documentation updates**: YES - wiki, AGENTS.md, pnpm-workspace.yaml

### Architecture Overview

**Before**:
```
crates/acp-bridge/          # Rust WebSocket server + replay modes
packages/acp-chat-core/     # Core library (@acp/chat-core)
packages/acp-chat-react/    # React components (@acp/chat-react)
apps/harness/              # Demo app (@acp/harness)
```

**After**:
```
crates/acp-ws-bridge/       # Reusable WebSocket bridge (harms_haus_acp_ws_bridge)
crates/acp-harness-server/  # Server binary with replay (harms_haus_acp_harness_server)
packages/acp-ws-bridge/     # TypeScript WS client (@harms-haus/acp-ws-bridge)
packages/acp-chat-core/     # Core library (@harms-haus/acp-chat-core)
packages/acp-chat-react/    # React components (@harms-haus/acp-chat-react)
packages/acp-harness-ui/    # Demo app (@harms-haus/acp-harness-ui)
```

### Metis Review Findings

**Addressed in Plan**:
- Added explicit file lists for websocket extraction
- Added verification commands (grep, cargo check, tsc --noEmit) to every task
- Added guardrails for "MUST NOT" behaviors
- Split trace logging into separate task (was scope creep)
- Added CI/CD configuration updates to scope
- Added git history preservation instructions
- Added comment/reference update tasks
- Defined exact directory structure

**Assumptions Requiring Validation**:
- WebSocket code can be cleanly separated (verified via lsp_find_references)
- All packages use `@harms-haus/` prefix (including integration-tests)
- No circular dependencies created (verified via dependency analysis)

---

## Work Objectives

### Core Objective
Create a clean separation between reusable WebSocket bridge components and harness-specific replay functionality. Rename all packages to use the `@harms-haus/` scope for consistency and brand identity.

### Concrete Deliverables
1. **New crate** `harms_haus_acp_ws_bridge` in `crates/acp-ws-bridge/`
   - WebSocket server implementation
   - Contract types (BridgeEnvelope, BridgeMessage, etc.)
   - Generic extra-data support
   - Trace logging
2. **New package** `@harms-haus/acp-ws-bridge` in `packages/acp-ws-bridge/`
   - TypeScript contract types
   - WebSocket client (TransportClient)
   - Type definitions for extra-data
3. **Renamed crate** `harms_haus_acp_harness_server` in `crates/acp-harness-server/`
   - Was `acp-bridge`
   - Contains replay modes, CLI, harness-specific code
   - Depends on `harms_haus_acp_ws_bridge`
4. **Renamed packages** with `@harms-haus/` prefix:
   - `@harms-haus/acp-chat-core` (was @acp/chat-core)
   - `@harms-haus/acp-chat-react` (was @acp/chat-react)
   - `@harms-haus/acp-harness-ui` (was @acp/harness, moved from apps/)
   - `@harms-haus/integration-tests` (was @acp/integration-tests)

### Definition of Done
- [ ] All packages build successfully: `cargo check` (Rust), `tsc --noEmit` (TypeScript)
- [ ] All tests pass: `cargo test` (Rust), `vitest run` (TypeScript)
- [ ] No old package names remain: `grep -r "@acp/" packages/` returns 0 results
- [ ] No old crate names remain: `grep -r "acp-bridge" crates/` returns 0 results
- [ ] Integration tests pass with new package names
- [ ] Documentation updated and accurate
- [ ] Harness UI runs and connects to server

### Must Have
- WebSocket server code extracted and functional
- All packages renamed with `@harms-haus/` prefix
- All imports updated to use new names
- Documentation fully updated
- Generic extra-data mechanism working
- Trace logging integrated

### Must NOT Have (Guardrails)
- ❌ **NO behavior changes** - extract and rename only, no logic modifications
- ❌ **NO API changes** beyond naming (same methods, same signatures)
- ❌ **NO new features** (except extra-data and trace logging)
- ❌ **NO partial renames** - all or nothing per package
- ❌ **NO broken references** - all imports must work
- ❌ **NO outdated documentation** - docs must match code

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES - Vitest for TypeScript, `cargo test` for Rust
- **Automated tests**: Tests-after (update existing tests, add new ones for ws-bridge)
- **Framework**: Vitest (TS), built-in Rust test framework
- **Agent-Executed QA**: Every task includes verification commands

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

**Verification Methods**:
- **Rust**: `cargo check`, `cargo test`, `cargo build`
- **TypeScript**: `tsc --noEmit`, `vitest run`, `pnpm build`
- **Grep verification**: `grep -r "old-name"` must return 0
- **Integration**: Run harness UI and verify WebSocket connection works

---

## Execution Strategy

### Phase 1: Extract WebSocket Bridge (Waves 1-3)
Create new `acp-ws-bridge` crate and package with server/client code.

### Phase 2: Rename All Packages (Waves 4-6)
Rename all crates and packages to use `harms-haus` prefix.

### Phase 3: Update Integration (Wave 7)
Update all imports, dependencies, and references.

### Phase 4: Documentation (Wave 8)
Update wiki, AGENTS.md, READMEs.

### Phase 5: Final Verification (Wave 9)
Comprehensive testing and verification.

### Parallel Execution Waves

```
Wave 1: Foundation (Start Immediately - can all run in parallel):
├── Task 1: Create Rust crate directory structure
├── Task 2: Create TypeScript package directory structure
├── Task 3: Design extra-data types (JSON schema)
└── Task 4: Update workspace configuration files

Wave 2: Extract WebSocket Code (after Wave 1, can run in parallel):
├── Task 5: Extract contract types to Rust ws-bridge
├── Task 6: Extract server code to Rust ws-bridge
├── Task 7: Create Rust ws-bridge library exports
└── Task 8: Extract TypeScript contract types to ws-bridge package

Wave 3: WebSocket Client & Integration (after Wave 2, sequential dependencies):
├── Task 9: Extract TransportClient to ws-bridge package
├── Task 10: Update ws-bridge package exports and build
├── Task 11: Add trace logging to Rust ws-bridge
└── Task 12: Add trace logging to TypeScript ws-bridge

Wave 4: Rename Rust Crates (after Wave 3, can run in parallel):
├── Task 13: Rename acp-bridge to acp-harness-server (directory)
├── Task 14: Update acp-harness-server Cargo.toml
├── Task 15: Update acp-harness-server imports and references
└── Task 16: Add ws-bridge dependency to harness-server

Wave 5: Rename TypeScript Packages (after Wave 3, can run in parallel):
├── Task 17: Rename @acp/chat-core to @harms-haus/acp-chat-core
├── Task 18: Rename @acp/chat-react to @harms-haus/acp-chat-react
├── Task 19: Rename apps/harness to packages/acp-harness-ui
└── Task 20: Rename @acp/integration-tests

Wave 6: Package Configuration Updates (after Wave 5, sequential):
├── Task 21: Update all package.json files with new names
├── Task 22: Update pnpm-workspace.yaml
├── Task 23: Update root package.json scripts
└── Task 24: Update tsconfig.json references

Wave 7: Import Updates (after Waves 4-6, can run in parallel by language):
├── Task 25: Update Rust imports in harness-server
├── Task 26: Update Rust imports in ws-bridge
├── Task 27: Update TypeScript imports in chat-core
├── Task 28: Update TypeScript imports in chat-react
├── Task 29: Update TypeScript imports in harness-ui
└── Task 30: Update TypeScript imports in integration-tests

Wave 8: Documentation Updates (after Wave 7, can run in parallel):
├── Task 31: Update wiki pages with new package names
├── Task 32: Update AGENTS.md with new conventions
├── Task 33: Update package README.md files
└── Task 34: Update inline code comments

Wave 9: Final Verification (after Wave 8, must run sequentially):
├── Task 35: Verify no old names remain (grep check)
├── Task 36: Verify Rust builds (cargo check all crates)
├── Task 37: Verify TypeScript builds (tsc --noEmit all packages)
├── Task 38: Run all Rust tests (cargo test)
├── Task 39: Run all TypeScript tests (vitest run)
├── Task 40: Integration test: Start server and connect UI
└── Task 41: Final documentation verification

Critical Path: Wave 1 → Wave 2 → Wave 3 → (Wave 4 || Wave 5) → Wave 6 → Wave 7 → Wave 8 → Wave 9
Max Parallel Tasks: 6 (Wave 5)
```

---

## TODOs

- [ ] 1. Create Rust ws-bridge crate directory structure

  **What to do**:
  - Create directory `crates/acp-ws-bridge/`
  - Create `crates/acp-ws-bridge/Cargo.toml` with:
    - Package name: `harms_haus_acp_ws_bridge`
    - Version: `0.1.0`
    - Edition: `2021`
    - License: `MIT`
    - Dependencies: tokio, tokio-tungstenite, futures-util, serde, serde_json, tracing, ts-rs, thiserror
  - Create `crates/acp-ws-bridge/src/` directory
  - Create `crates/acp-ws-bridge/src/lib.rs` (empty initially)

  **Must NOT do**:
  - Do NOT add any source code yet (just structure)
  - Do NOT add harness-specific dependencies
  - Do NOT add replay-related code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None needed (simple file creation)
  - **Reason**: This is simple directory and file creation with known content

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5, 6, 7
  - **Blocked By**: None

  **References**:
  - Pattern: `crates/acp-bridge/Cargo.toml` - Use as template for dependencies
  - File to create: `crates/acp-ws-bridge/Cargo.toml`

  **Acceptance Criteria**:
  - [ ] Directory `crates/acp-ws-bridge/` exists
  - [ ] File `crates/acp-ws-bridge/Cargo.toml` exists with correct package name
  - [ ] File `crates/acp-ws-bridge/src/lib.rs` exists

  **QA Scenarios**:
  ```
  Scenario: Verify crate structure created
    Tool: Bash
    Steps:
      1. `ls -la crates/acp-ws-bridge/`
      2. `ls -la crates/acp-ws-bridge/src/`
      3. `cat crates/acp-ws-bridge/Cargo.toml | grep "name"`
    Expected Result:
      - Directory exists
      - src/ subdirectory exists
      - Package name is "harms_haus_acp_ws_bridge"
    Evidence: .sisyphus/evidence/task-1-crate-structure.txt
  ```

  **Commit**: NO (groups with Wave 1)

---

- [ ] 2. Create TypeScript ws-bridge package directory structure

  **What to do**:
  - Create directory `packages/acp-ws-bridge/`
  - Create `packages/acp-ws-bridge/package.json` with:
    - Name: `@harms-haus/acp-ws-bridge`
    - Version: `0.0.1`
    - License: `MIT`
    - Dependencies: None initially
    - Dev dependencies: typescript, vitest
  - Create `packages/acp-ws-bridge/src/` directory
  - Create `packages/acp-ws-bridge/tsconfig.json` (copy from chat-core and adjust)
  - Create `packages/acp-ws-bridge/src/index.ts` (empty initially)

  **Must NOT do**:
  - Do NOT add any source code yet (just structure)
  - Do NOT add chat-core dependency yet
  - Do NOT copy any files from existing packages yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None needed
  - **Reason**: Simple directory and configuration file creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 8, 9
  - **Blocked By**: None

  **References**:
  - Pattern: `packages/acp-chat-core/package.json` - Use as template
  - Pattern: `packages/acp-chat-core/tsconfig.json` - Use as template

  **Acceptance Criteria**:
  - [ ] Directory `packages/acp-ws-bridge/` exists
  - [ ] File `packages/acp-ws-bridge/package.json` exists with correct name
  - [ ] File `packages/acp-ws-bridge/tsconfig.json` exists
  - [ ] File `packages/acp-ws-bridge/src/index.ts` exists

  **QA Scenarios**:
  ```
  Scenario: Verify package structure created
    Tool: Bash
    Steps:
      1. `ls -la packages/acp-ws-bridge/`
      2. `cat packages/acp-ws-bridge/package.json | grep '"name"'`
    Expected Result:
      - Directory exists
      - Package name is "@harms-haus/acp-ws-bridge"
    Evidence: .sisyphus/evidence/task-2-package-structure.txt
  ```

  **Commit**: NO (groups with Wave 1)

---

- [ ] 3. Design extra-data types (JSON schema)

  **What to do**:
  - Design TypeScript interface for extra-data: `ExtraData` or `Record<string, unknown>`
  - Add extra-data field to BridgeEnvelope (Rust): `extra_data: Option<serde_json::Value>`
  - Add extra-data field to BridgeEnvelope (TypeScript): `extraData?: Record<string, unknown>`
  - Document the contract: extra-data is free-form JSON, preserved but not validated by ws-bridge
  - Design replay-speed as harness-server specific usage of extra-data

  **Must NOT do**:
  - Do NOT make extra-data strongly typed (must be free-form JSON)
  - Do NOT add replay-speed specific fields to ws-bridge
  - Do NOT validate extra-data content in ws-bridge

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Requires understanding of both Rust and TypeScript type systems

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5, 6, 8
  - **Blocked By**: None

  **References**:
  - Current: `crates/acp-bridge/src/contract/envelope.rs` - BridgeEnvelope definition
  - Current: `packages/acp-chat-core/src/generated/` - Generated TypeScript types
  - Pattern: Use `serde_json::Value` in Rust for free-form JSON

  **Acceptance Criteria**:
  - [ ] Rust type defined: `extra_data: Option<serde_json::Value>` in BridgeEnvelope
  - [ ] TypeScript type defined: `extraData?: Record<string, unknown>` in BridgeEnvelope
  - [ ] Documentation explains free-form nature and usage patterns

  **QA Scenarios**:
  ```
  Scenario: Verify extra-data types defined
    Tool: Read files
    Steps:
      1. Read `crates/acp-ws-bridge/src/contract/envelope.rs` (after Task 5)
      2. Read `packages/acp-ws-bridge/src/types.ts` (after Task 8)
    Expected Result:
      - extra_data field present in Rust struct
      - extraData field present in TypeScript interface
    Evidence: .sisyphus/evidence/task-3-extra-data-types.txt
  ```

  **Commit**: NO (groups with Wave 1)

---

- [ ] 4. Update workspace configuration files

  **What to do**:
  - Update `pnpm-workspace.yaml` to include new package: `packages/acp-ws-bridge`
  - Update root `Cargo.toml` workspace.members to include new crate: `crates/acp-ws-bridge`
  - Verify no other workspace configs need updating

  **Must NOT do**:
  - Do NOT change existing package paths yet (that happens in Wave 5)
  - Do NOT update dependency references yet (that happens in Wave 6)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple configuration file edits

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 22 (full workspace update)
  - **Blocked By**: Task 1, 2 (need directories to exist first)

  **References**:
  - File: `pnpm-workspace.yaml` - Add `packages/acp-ws-bridge`
  - File: `Cargo.toml` (root) - Add `crates/acp-ws-bridge` to workspace.members

  **Acceptance Criteria**:
  - [ ] `pnpm-workspace.yaml` includes `packages/acp-ws-bridge`
  - [ ] Root `Cargo.toml` includes `crates/acp-ws-bridge`

  **QA Scenarios**:
  ```
  Scenario: Verify workspace configs updated
    Tool: Bash
    Steps:
      1. `cat pnpm-workspace.yaml | grep acp-ws-bridge`
      2. `cat Cargo.toml | grep acp-ws-bridge`
    Expected Result:
      - Both files reference the new crate/package
    Evidence: .sisyphus/evidence/task-4-workspace-config.txt
  ```

  **Commit**: NO (groups with Wave 1)

---

- [ ] 5. Extract contract types to Rust ws-bridge

  **What to do**:
  - Copy `crates/acp-bridge/src/contract/` to `crates/acp-ws-bridge/src/contract/`
  - Update module declarations in `crates/acp-ws-bridge/src/lib.rs` to export contract types
  - Modify contract types to add `extra_data: Option<serde_json::Value>` field to BridgeEnvelope
  - Ensure TS-RS bindings are generated (already configured)
  - Remove harness-specific variants (keep only core message types)

  **Must NOT do**:
  - Do NOT include replay-specific types (replay_v2 types stay in harness-server)
  - Do NOT modify message content structures (preserve compatibility)
  - Do NOT remove existing fields (only add extra_data)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Requires Rust knowledge and careful type modification

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 6)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 11 (needs contract types)
  - **Blocked By**: Task 1 (needs directory structure)

  **References**:
  - Source: `crates/acp-bridge/src/contract/envelope.rs` - BridgeEnvelope definition
  - Source: `crates/acp-bridge/src/contract/message.rs` - Message variants
  - Target: `crates/acp-ws-bridge/src/contract/`
  - Pattern: Use `serde_json::Value` for free-form extra_data

  **Acceptance Criteria**:
  - [ ] Contract files copied to ws-bridge
  - [ ] extra_data field added to BridgeEnvelope
  - [ ] lib.rs exports contract types
  - [ ] `cargo check` passes in ws-bridge

  **QA Scenarios**:
  ```
  Scenario: Verify contract types extracted
    Tool: Bash
    Steps:
      1. `ls crates/acp-ws-bridge/src/contract/`
      2. `cargo check -p harms_haus_acp_ws_bridge`
    Expected Result:
      - contract/ directory exists with envelope.rs, message.rs
      - cargo check passes
    Evidence: .sisyphus/evidence/task-5-contract-types.txt
  ```

  **Commit**: NO (groups with Wave 2)

---

- [ ] 6. Extract server code to Rust ws-bridge

  **What to do**:
  - Copy `crates/acp-bridge/src/server/` to `crates/acp-ws-bridge/src/server/`
  - Extract generic WebSocket server logic (NOT mode-specific code)
  - Keep server connection handling, message routing, envelope parsing
  - Remove replay-specific server logic (stays in harness-server)
  - Update imports to use new crate name
  - Add server module exports to lib.rs

  **Must NOT do**:
  - Do NOT include replay_v2 or replay_v2_streaming logic (those are harness-specific)
  - Do NOT include proxy mode logic (harness-specific)
  - Do NOT include script conversion logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Requires careful separation of generic vs harness-specific code

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16 (harness-server needs ws-bridge)
  - **Blocked By**: Task 1 (needs directory structure)

  **References**:
  - Source: `crates/acp-bridge/src/server/mod.rs` - Server implementation
  - Target: `crates/acp-ws-bridge/src/server/`
  - Analysis: Use lsp_find_references on server exports to identify what MUST move vs what stays

  **Acceptance Criteria**:
  - [ ] Server module copied to ws-bridge
  - [ ] Only generic server code (no replay/proxy modes)
  - [ ] lib.rs exports server module
  - [ ] `cargo check` passes in ws-bridge

  **QA Scenarios**:
  ```
  Scenario: Verify server code extracted
    Tool: Bash
    Steps:
      1. `ls crates/acp-ws-bridge/src/server/`
      2. `grep -r "replay" crates/acp-ws-bridge/src/server/` (should be empty)
      3. `cargo check -p harms_haus_acp_ws_bridge`
    Expected Result:
      - server/ directory exists with generic code
      - No replay references in server code
      - cargo check passes
    Evidence: .sisyphus/evidence/task-6-server-code.txt
  ```

  **Commit**: NO (groups with Wave 2)

---

- [ ] 7. Create Rust ws-bridge library exports

  **What to do**:
  - Update `crates/acp-ws-bridge/src/lib.rs` to properly export all public APIs
  - Re-export contract types (BridgeEnvelope, BridgeMessage, etc.)
  - Re-export server types and functions
  - Add module documentation
  - Ensure all items are marked `pub` where needed

  **Must NOT do**:
  - Do NOT expose internal implementation details
  - Do NOT change any APIs (just re-export)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple module organization and exports

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 5, 6)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16 (harness-server needs exports)
  - **Blocked By**: Task 5, Task 6

  **References**:
  - Pattern: `crates/acp-bridge/src/lib.rs` - current exports
  - Target: `crates/acp-ws-bridge/src/lib.rs`

  **Acceptance Criteria**:
  - [ ] lib.rs exports contract module
  - [ ] lib.rs exports server module
  - [ ] All public types are accessible
  - [ ] Documentation comments added
  - [ ] `cargo check` and `cargo test` pass

  **QA Scenarios**:
  ```
  Scenario: Verify library exports
    Tool: Bash
    Steps:
      1. `cat crates/acp-ws-bridge/src/lib.rs`
      2. `cargo doc -p harms_haus_acp_ws_bridge --no-deps`
    Expected Result:
      - lib.rs has proper pub mod declarations
      - Documentation builds successfully
    Evidence: .sisyphus/evidence/task-7-library-exports.txt
  ```

  **Commit**: NO (groups with Wave 2)

---

- [ ] 8. Extract TypeScript contract types to ws-bridge package

  **What to do**:
  - Create `packages/acp-ws-bridge/src/types/` directory
  - Copy generated types from `packages/acp-chat-core/src/generated/` to `packages/acp-ws-bridge/src/types/`
  - Types to copy: BridgeEnvelope, BridgeMessage, BridgeStatus, UnsupportedVersionError
  - Update types to add `extraData?: Record<string, unknown>` field
  - Update `packages/acp-ws-bridge/src/index.ts` to export types

  **Must NOT do**:
  - Do NOT copy all generated types (only bridge-related ones)
  - Do NOT modify type semantics (only add extraData field)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: File copying and minor type modifications

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 9 (needs types)
  - **Blocked By**: Task 2 (needs directory structure)

  **References**:
  - Source: `packages/acp-chat-core/src/generated/` - BridgeEnvelope, BridgeMessage types
  - Target: `packages/acp-ws-bridge/src/types/`

  **Acceptance Criteria**:
  - [ ] BridgeEnvelope type copied and updated
  - [ ] BridgeMessage type copied
  - [ ] Other bridge types copied
  - [ ] extraData field added to BridgeEnvelope
  - [ ] index.ts exports all types
  - [ ] `tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Verify TypeScript types extracted
    Tool: Bash
    Steps:
      1. `ls packages/acp-ws-bridge/src/types/`
      2. `cat packages/acp-ws-bridge/src/types/bridge-envelope.ts | grep extraData`
      3. `cd packages/acp-ws-bridge && tsc --noEmit`
    Expected Result:
      - types/ directory exists with bridge types
      - extraData field present
      - TypeScript compiles
    Evidence: .sisyphus/evidence/task-8-ts-types.txt
  ```

  **Commit**: NO (groups with Wave 2)

---

- [ ] 9. Extract TransportClient to ws-bridge package

  **What to do**:
  - Copy `packages/acp-chat-core/src/transport/client.ts` to `packages/acp-ws-bridge/src/client.ts`
  - Update imports in the client to use local types (from `./types/`)
  - Update `packages/acp-ws-bridge/src/index.ts` to export TransportClient
  - Remove TransportClient from acp-chat-core (or re-export from ws-bridge)
  - Update any references to use new import path

  **Must NOT do**:
  - Do NOT modify TransportClient logic (extract as-is)
  - Do NOT break acp-chat-core yet (will be updated in Wave 7)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: File copying and import updates

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 8)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 10 (needs client)
  - **Blocked By**: Task 8 (needs types)

  **References**:
  - Source: `packages/acp-chat-core/src/transport/client.ts` - TransportClient class
  - Target: `packages/acp-ws-bridge/src/client.ts`
  - Note: Keep original in chat-core for now, remove in Wave 7

  **Acceptance Criteria**:
  - [ ] TransportClient copied to ws-bridge
  - [ ] Client imports updated to use local types
  - [ ] index.ts exports TransportClient
  - [ ] `tsc --noEmit` passes in ws-bridge

  **QA Scenarios**:
  ```
  Scenario: Verify TransportClient extracted
    Tool: Bash
    Steps:
      1. `ls packages/acp-ws-bridge/src/client.ts`
      2. `cat packages/acp-ws-bridge/src/index.ts | grep TransportClient`
      3. `cd packages/acp-ws-bridge && tsc --noEmit`
    Expected Result:
      - client.ts exists
      - TransportClient exported from index
      - TypeScript compiles
    Evidence: .sisyphus/evidence/task-9-transport-client.txt
  ```

  **Commit**: NO (groups with Wave 3)

---

- [ ] 10. Update ws-bridge package exports and build

  **What to do**:
  - Ensure `packages/acp-ws-bridge/src/index.ts` exports everything:
    - Contract types (BridgeEnvelope, BridgeMessage, etc.)
    - TransportClient
    - ConnectionStatus enum
    - Any utility functions
  - Update `packages/acp-ws-bridge/package.json`:
    - Add `main`, `module`, `types` fields
    - Add build script
    - Add files array for npm publishing
  - Test that package builds: `pnpm build` in ws-bridge directory

  **Must NOT do**:
  - Do NOT add dependencies yet (keep minimal)
  - Do NOT publish to npm yet (just prepare)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Package configuration and build setup

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 9)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 27 (chat-core will depend on ws-bridge)
  - **Blocked By**: Task 9 (needs client)

  **References**:
  - Pattern: `packages/acp-chat-core/package.json` - build configuration
  - Pattern: `packages/acp-chat-core/src/index.ts` - export patterns

  **Acceptance Criteria**:
  - [ ] index.ts exports all public APIs
  - [ ] package.json has correct build configuration
  - [ ] `pnpm build` succeeds in ws-bridge
  - [ ] Generated types are correct

  **QA Scenarios**:
  ```
  Scenario: Verify package builds correctly
    Tool: Bash
    Steps:
      1. `cd packages/acp-ws-bridge && pnpm build`
      2. `ls packages/acp-ws-bridge/dist/`
    Expected Result:
      - Build succeeds
      - dist/ directory created with compiled output
    Evidence: .sisyphus/evidence/task-10-package-build.txt
  ```

  **Commit**: NO (groups with Wave 3)

---

- [ ] 11. Add trace logging to Rust ws-bridge

  **What to do**:
  - Add `tracing` crate dependency (already in Cargo.toml from Task 1)
  - Add trace logging to WebSocket server:
    - Connection established: `trace!("WebSocket connection established: {:?}", addr)`
    - Message received: `trace!("Message received: {:?}", msg)`
    - Message sent: `trace!("Message sent: {:?}", msg)`
    - Connection closed: `trace!("Connection closed: {:?}", addr)`
  - Use appropriate log levels: trace for high-volume, debug for normal operations
  - Add span tracing for connection lifecycle

  **Must NOT do**:
  - Do NOT add logging for every internal operation (too verbose)
  - Do NOT change any behavior (logging only)
  - Do NOT add println! (use tracing macros only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Adding tracing instrumentation (standard practice)

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 7)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 7 (needs server code)

  **References**:
  - Pattern: `crates/acp-bridge/src/server/mod.rs` - existing logging patterns
  - Docs: tracing crate documentation

  **Acceptance Criteria**:
  - [ ] tracing dependency present in Cargo.toml
  - [ ] trace! macros added at key points
  - [ ] Connection lifecycle has spans
  - [ ] `cargo check` passes

  **QA Scenarios**:
  ```
  Scenario: Verify trace logging added
    Tool: Bash
    Steps:
      1. `grep -r "trace!" crates/acp-ws-bridge/src/ | wc -l`
      2. `grep -r "tracing::" crates/acp-ws-bridge/src/lib.rs`
    Expected Result:
      - Multiple trace! calls in server code
      - tracing imported in lib.rs
    Evidence: .sisyphus/evidence/task-11-trace-logging.txt
  ```

  **Commit**: NO (groups with Wave 3)

---

- [ ] 12. Add trace logging to TypeScript ws-bridge

  **What to do**:
  - Add trace logging to TransportClient:
    - Connection state changes: `console.trace('[WS] State change:', status)`
    - Messages received: `console.trace('[WS] Received:', envelope)`
    - Messages sent: `console.trace('[WS] Sent:', envelope)`
    - Errors: `console.error('[WS] Error:', error)`
  - Create optional logger injection (allow passing custom logger)
  - Add debug mode flag to TransportClient config

  **Must NOT do**:
  - Do NOT add logging for every internal operation (too verbose)
  - Do NOT break existing API (logger should be optional)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Adding logging instrumentation

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 9)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 9 (needs client code)

  **References**:
  - Pattern: `packages/acp-chat-core/src/transport/client.ts` - current structure
  - File: `packages/acp-ws-bridge/src/client.ts` (from Task 9)

  **Acceptance Criteria**:
  - [ ] console.trace calls added at key points
  - [ ] Optional logger injection supported
  - [ ] Debug mode flag added
  - [ ] `tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Verify TypeScript trace logging added
    Tool: Bash
    Steps:
      1. `grep -n "console.trace\|console.debug\|console.error" packages/acp-ws-bridge/src/client.ts`
    Expected Result:
      - Multiple logging calls in client code
    Evidence: .sisyphus/evidence/task-12-ts-trace-logging.txt
  ```

  **Commit**: NO (groups with Wave 3)

---

- [ ] 13. Rename acp-bridge to acp-harness-server (directory)

  **What to do**:
  - Use `git mv` to rename directory: `git mv crates/acp-bridge crates/acp-harness-server`
  - Verify git history is preserved: `git log --follow crates/acp-harness-server/Cargo.toml`
  - Update any scripts that reference the old path

  **Must NOT do**:
  - Do NOT use regular mv (loses git history)
  - Do NOT modify any file contents yet (that happens in Task 14-15)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `/git-master`
  - **Reason**: Git operations require proper git skill

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Wave 3)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 14, 15, 16
  - **Blocked By**: Wave 3 (need ws-bridge ready first)

  **References**:
  - Source directory: `crates/acp-bridge/`
  - Target directory: `crates/acp-harness-server/`
  - Command: `git mv crates/acp-bridge crates/acp-harness-server`

  **Acceptance Criteria**:
  - [ ] Directory renamed using git mv
  - [ ] Git history preserved (log --follow works)
  - [ ] No references to old path in scripts

  **QA Scenarios**:
  ```
  Scenario: Verify directory renamed with git history
    Tool: Bash
    Steps:
      1. `ls crates/ | grep acp-harness-server`
      2. `git log --follow crates/acp-harness-server/Cargo.toml | head -20`
    Expected Result:
      - acp-harness-server directory exists
      - Git history shows commits before rename
    Evidence: .sisyphus/evidence/task-13-directory-rename.txt
  ```

  **Commit**: NO (groups with Wave 4)

---

- [ ] 14. Update acp-harness-server Cargo.toml

  **What to do**:
  - Update `crates/acp-harness-server/Cargo.toml`:
    - Change package name: `harms_haus_acp_harness_server`
    - Update description: "ACP test harness server with replay support"
    - Add dependency on ws-bridge: `harms_haus_acp_ws_bridge = { path = "../acp-ws-bridge" }`
    - Update any other metadata (repository, homepage, etc.)
  - Keep all existing dependencies

  **Must NOT do**:
  - Do NOT remove any dependencies yet
  - Do NOT change version number

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple Cargo.toml editing

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 13)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 25 (import updates need Cargo.toml correct)
  - **Blocked By**: Task 13 (needs directory rename)

  **References**:
  - File: `crates/acp-harness-server/Cargo.toml`
  - Pattern: Use `harms_haus_acp_ws_bridge` dependency

  **Acceptance Criteria**:
  - [ ] Package name is `harms_haus_acp_harness_server`
  - [ ] Dependency on `harms_haus_acp_ws_bridge` added
  - [ ] All metadata updated

  **QA Scenarios**:
  ```
  Scenario: Verify Cargo.toml updated
    Tool: Bash
    Steps:
      1. `cat crates/acp-harness-server/Cargo.toml | grep "^name"`
      2. `cat crates/acp-harness-server/Cargo.toml | grep "harms_haus_acp_ws_bridge"`
    Expected Result:
      - Name is harms_haus_acp_harness_server
      - Dependency on ws-bridge present
    Evidence: .sisyphus/evidence/task-14-cargo-toml.txt
  ```

  **Commit**: NO (groups with Wave 4)

---

- [ ] 15. Update acp-harness-server imports and references

  **What to do**:
  - Update all Rust imports in `crates/acp-harness-server/src/`:
    - `use acp_bridge::...` → `use harms_haus_acp_ws_bridge::...`
    - `mod` declarations for moved code
    - Any internal crate references
  - Update `src/main.rs` binary name references
  - Update lib.rs exports if needed
  - Remove code that moved to ws-bridge (contract/, server/)
  - Keep modes/ (replay_v2, proxy, etc.) - those stay here

  **Must NOT do**:
  - Do NOT remove modes/ directory (stays in harness-server)
  - Do NOT change any logic (just imports)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Careful import updates across multiple files

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 14)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 25
  - **Blocked By**: Task 14 (needs Cargo.toml updated)

  **References**:
  - Source files: `crates/acp-harness-server/src/**/*.rs`
  - Pattern: Replace `acp_bridge` with `harms_haus_acp_ws_bridge`
  - Use ast_grep_replace for safe renaming: `ast_grep_replace(lang="rust", pattern="use acp_bridge::$$$", rewrite="use harms_haus_acp_ws_bridge::$$$")`

  **Acceptance Criteria**:
  - [ ] All imports updated to use new crate name
  - [ ] Removed duplicate code (what moved to ws-bridge)
  - [ ] Modes/ still present and functional
  - [ ] `cargo check` passes

  **QA Scenarios**:
  ```
  Scenario: Verify imports updated
    Tool: Bash
    Steps:
      1. `grep -r "use acp_bridge" crates/acp-harness-server/src/ | wc -l` (should be 0)
      2. `grep -r "use harms_haus_acp_ws_bridge" crates/acp-harness-server/src/ | wc -l` (should be >0)
      3. `cargo check -p harms_haus_acp_harness_server`
    Expected Result:
      - No old crate references
      - New crate references present
      - Build passes
    Evidence: .sisyphus/evidence/task-15-imports-updated.txt
  ```

  **Commit**: NO (groups with Wave 4)

---

- [ ] 16. Add ws-bridge dependency to harness-server

  **What to do**:
  - Ensure `crates/acp-harness-server/Cargo.toml` has dependency:
    ```toml
    [dependencies]
    harms_haus_acp_ws_bridge = { path = "../acp-ws-bridge" }
    ```
  - Update all usages to import from ws-bridge instead of local modules
  - Remove local contract/ and server/ modules (now in ws-bridge)
  - Update lib.rs to re-export from ws-bridge where needed

  **Must NOT do**:
  - Do NOT duplicate code (use ws-bridge exports)
  - Do NOT break any existing functionality

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Dependency management and import updates

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Tasks 7, 15)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 25
  - **Blocked By**: Task 7 (ws-bridge exports), Task 15 (harness-server imports)

  **References**:
  - File: `crates/acp-harness-server/Cargo.toml`
  - File: `crates/acp-harness-server/src/lib.rs`
  - File: `crates/acp-ws-bridge/src/lib.rs` (exports to use)

  **Acceptance Criteria**:
  - [ ] Dependency declared in Cargo.toml
  - [ ] Imports use ws-bridge crate
  - [ ] Local contract/ and server/ removed
  - [ ] `cargo check` passes
  - [ ] `cargo test` passes

  **QA Scenarios**:
  ```
  Scenario: Verify dependency integration
    Tool: Bash
    Steps:
      1. `cargo tree -p harms_haus_acp_harness_server | grep harms_haus_acp_ws_bridge`
      2. `cargo test -p harms_haus_acp_harness_server`
    Expected Result:
      - Dependency tree shows ws-bridge
      - Tests pass
    Evidence: .sisyphus/evidence/task-16-dependency-integration.txt
  ```

  **Commit**: NO (groups with Wave 4)

---

- [ ] 17. Rename @acp/chat-core to @harms-haus/acp-chat-core

  **What to do**:
  - Update `packages/acp-chat-core/package.json`:
    - Change name: `@harms-haus/acp-chat-core`
    - Keep all other fields
  - No directory rename needed (stays as `packages/acp-chat-core/`)
  - This is just the npm package name change

  **Must NOT do**:
  - Do NOT rename directory (simplified structure per user decision)
  - Do NOT change version

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple package.json update

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 18, 19, 20)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 21 (needs all package names)
  - **Blocked By**: None

  **References**:
  - File: `packages/acp-chat-core/package.json`
  - Field: `"name": "@harms-haus/acp-chat-core"`

  **Acceptance Criteria**:
  - [ ] package.json name field updated
  - [ ] No other changes needed yet

  **QA Scenarios**:
  ```
  Scenario: Verify package name updated
    Tool: Bash
    Steps:
      1. `cat packages/acp-chat-core/package.json | grep '"name"'`
    Expected Result:
      - Name is @harms-haus/acp-chat-core
    Evidence: .sisyphus/evidence/task-17-chat-core-rename.txt
  ```

  **Commit**: NO (groups with Wave 5)

---

- [ ] 18. Rename @acp/chat-react to @harms-haus/acp-chat-react

  **What to do**:
  - Update `packages/acp-chat-react/package.json`:
    - Change name: `@harms-haus/acp-chat-react`
    - Update dependency: `@acp/chat-core` → `@harms-haus/acp-chat-core`
  - No directory rename needed

  **Must NOT do**:
  - Do NOT rename directory
  - Do NOT change any other dependencies yet (that happens in Wave 6)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple package.json updates

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 17, 19, 20)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 21
  - **Blocked By**: None

  **References**:
  - File: `packages/acp-chat-react/package.json`
  - Fields: `"name"`, `"dependencies"` (chat-core reference)

  **Acceptance Criteria**:
  - [ ] package.json name field updated
  - [ ] chat-core dependency reference updated

  **QA Scenarios**:
  ```
  Scenario: Verify package name and dependency updated
    Tool: Bash
    Steps:
      1. `cat packages/acp-chat-react/package.json | grep '"name"'`
      2. `cat packages/acp-chat-react/package.json | grep chat-core`
    Expected Result:
      - Name is @harms-haus/acp-chat-react
      - Dependency uses @harms-haus/acp-chat-core
    Evidence: .sisyphus/evidence/task-18-chat-react-rename.txt
  ```

  **Commit**: NO (groups with Wave 5)

---

- [ ] 19. Rename apps/harness to packages/acp-harness-ui

  **What to do**:
  - Move directory: `git mv apps/harness packages/acp-harness-ui`
  - Update `packages/acp-harness-ui/package.json`:
    - Change name: `@harms-haus/acp-harness-ui`
    - Update all dependencies to use @harms-haus prefix
    - Remove "private": true (this will be published)
  - Update any scripts that reference old path

  **Must NOT do**:
  - Do NOT use regular mv (use git mv to preserve history)
  - Do NOT change source code yet (that happens in Wave 7)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `/git-master`
  - **Reason**: Git move operation

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 17, 18, 20)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 21, Task 29
  - **Blocked By**: None

  **References**:
  - Source: `apps/harness/`
  - Target: `packages/acp-harness-ui/`
  - Command: `git mv apps/harness packages/acp-harness-ui`

  **Acceptance Criteria**:
  - [ ] Directory moved with git mv
  - [ ] package.json name updated
  - [ ] Dependencies updated
  - [ ] Git history preserved

  **QA Scenarios**:
  ```
  Scenario: Verify harness-ui moved and renamed
    Tool: Bash
    Steps:
      1. `ls packages/ | grep acp-harness-ui`
      2. `ls apps/ | grep harness` (should be empty)
      3. `git log --follow packages/acp-harness-ui/package.json | head -10`
      4. `cat packages/acp-harness-ui/package.json | grep '"name"'`
    Expected Result:
      - Directory in packages/
      - No directory in apps/
      - Git history preserved
      - Name is @harms-haus/acp-harness-ui
    Evidence: .sisyphus/evidence/task-19-harness-ui-move.txt
  ```

  **Commit**: NO (groups with Wave 5)

---

- [ ] 20. Rename @acp/integration-tests

  **What to do**:
  - Update `packages/integration-tests/package.json`:
    - Change name: `@harms-haus/integration-tests`
    - Keep "private": true (not published)
  - No directory rename needed

  **Must NOT do**:
  - Do NOT remove private flag (these are internal tests)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple package.json update

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 17, 18, 19)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 21, Task 30
  - **Blocked By**: None

  **References**:
  - File: `packages/integration-tests/package.json`

  **Acceptance Criteria**:
  - [ ] package.json name updated
  - [ ] Still marked as private

  **QA Scenarios**:
  ```
  Scenario: Verify integration-tests renamed
    Tool: Bash
    Steps:
      1. `cat packages/integration-tests/package.json | grep '"name"'`
    Expected Result:
      - Name is @harms-haus/integration-tests
    Evidence: .sisyphus/evidence/task-20-integration-tests-rename.txt
  ```

  **Commit**: NO (groups with Wave 5)

---

- [ ] 21. Update all package.json files with new names

  **What to do**:
  - Update ALL package.json files to use new dependency names:
    - `packages/acp-chat-core/package.json` - dependencies (none yet)
    - `packages/acp-chat-react/package.json` - dependencies, peerDependencies
    - `packages/acp-harness-ui/package.json` - all dependencies
    - `packages/integration-tests/package.json` - dependencies
    - `packages/acp-ws-bridge/package.json` - final name confirmation
  - Replace `@acp/` with `@harms-haus/` in all dependency references
  - Keep version numbers unchanged
  - Update devDependencies as well

  **Must NOT do**:
  - Do NOT change version numbers
  - Do NOT add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Find-and-replace across JSON files

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Wave 5)
  - **Parallel Group**: Wave 6
  - **Blocks**: Task 23, Task 27-30
  - **Blocked By**: Wave 5 (all package names must be set)

  **References**:
  - All `packages/*/package.json` files
  - Pattern: Replace `@acp/` with `@harms-haus/`

  **Acceptance Criteria**:
  - [ ] All package.json files updated
  - [ ] No @acp/ references remain in package.json files
  - [ ] All dependency names use @harms-haus/

  **QA Scenarios**:
  ```
  Scenario: Verify all package.json files updated
    Tool: Bash
    Steps:
      1. `grep -r '"@acp/' packages/*/package.json | wc -l` (should be 0)
      2. `grep -r '"@harms-haus/' packages/*/package.json | wc -l` (should be >0)
    Expected Result:
      - No old @acp/ references
      - New @harms-haus/ references present
    Evidence: .sisyphus/evidence/task-21-all-package-json.txt
  ```

  **Commit**: NO (groups with Wave 6)

---

- [ ] 22. Update pnpm-workspace.yaml

  **What to do**:
  - Update `pnpm-workspace.yaml`:
    - Keep `packages/*` (covers all packages including new acp-ws-bridge and acp-harness-ui)
    - Remove `apps/*` (no longer needed, harness moved to packages/)
    - Verify workspace configuration is correct

  **Must NOT do**:
  - Do NOT remove packages/* (needed for all packages)
  - Do NOT add individual package paths (use glob patterns)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple YAML configuration update

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Wave 5)
  - **Parallel Group**: Wave 6
  - **Blocks**: Task 23
  - **Blocked By**: Task 19 (harness moved to packages/)

  **References**:
  - File: `pnpm-workspace.yaml`
  - Remove `apps/*` line

  **Acceptance Criteria**:
  - [ ] apps/* removed from workspace
  - [ ] packages/* remains
  - [ ] `pnpm install` works

  **QA Scenarios**:
  ```
  Scenario: Verify workspace config updated
    Tool: Bash
    Steps:
      1. `cat pnpm-workspace.yaml`
      2. `pnpm install`
    Expected Result:
      - No apps/* in config
      - Install succeeds
    Evidence: .sisyphus/evidence/task-22-pnpm-workspace.txt
  ```

  **Commit**: NO (groups with Wave 6)

---

- [ ] 23. Update root package.json scripts

  **What to do**:
  - Update `package.json` (root) scripts that reference old paths:
    - `dev:harness` path: `apps/harness` → `packages/acp-harness-ui`
    - Any other script paths
  - Update any documentation references
  - Keep script names the same (just update paths)

  **Must NOT do**:
  - Do NOT change script names
  - Do NOT remove scripts

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple JSON path updates

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 22)
  - **Parallel Group**: Wave 6
  - **Blocks**: None
  - **Blocked By**: Task 22 (workspace must be correct first)

  **References**:
  - File: `package.json` (root)
  - Scripts section

  **Acceptance Criteria**:
  - [ ] All script paths updated
  - [ ] `pnpm dev:harness` works

  **QA Scenarios**:
  ```
  Scenario: Verify root scripts updated
    Tool: Bash
    Steps:
      1. `cat package.json | grep acp-harness-ui`
    Expected Result:
      - Scripts reference new path
    Evidence: .sisyphus/evidence/task-23-root-scripts.txt
  ```

  **Commit**: NO (groups with Wave 6)

---

- [ ] 24. Update tsconfig.json references

  **What to do**:
  - Update root `tsconfig.json`:
    - Update references to old package names in paths
    - Update any project references
  - Update individual package tsconfig.json files:
    - Update references to other packages
  - Ensure TypeScript can resolve all imports

  **Must NOT do**:
  - Do NOT change compiler options
  - Do NOT change module resolution strategy

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: JSON reference updates

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Wave 5)
  - **Parallel Group**: Wave 6
  - **Blocks**: Task 37
  - **Blocked By**: Wave 5 (package structure must be stable)

  **References**:
  - Root: `tsconfig.json`
  - Packages: `packages/*/tsconfig.json`

  **Acceptance Criteria**:
  - [ ] All tsconfig.json files updated
  - [ ] `tsc --noEmit` passes in root

  **QA Scenarios**:
  ```
  Scenario: Verify tsconfig references updated
    Tool: Bash
    Steps:
      1. `grep -r "@acp/" tsconfig.json packages/*/tsconfig.json | wc -l` (should be 0)
      2. `tsc --noEmit`
    Expected Result:
      - No old references
      - TypeScript compiles
    Evidence: .sisyphus/evidence/task-24-tsconfig.txt
  ```

  **Commit**: NO (groups with Wave 6)

---

- [ ] 25. Update Rust imports in harness-server

  **What to do**:
  - Update all Rust source files in `crates/acp-harness-server/src/`:
    - Replace `use acp_bridge::` with `use harms_haus_acp_ws_bridge::`
    - Replace `mod contract` (if still present) with imports from ws-bridge
    - Replace `mod server` (if still present) with imports from ws-bridge
  - Update `main.rs` to use new crate name in any CLI output
  - Use ast_grep_replace for systematic updates

  **Must NOT do**:
  - Do NOT change any logic (only imports)
  - Do NOT remove modes/ (those stay)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Careful import updates across Rust codebase

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 26)
  - **Parallel Group**: Wave 7
  - **Blocks**: Task 36, 38
  - **Blocked By**: Task 16 (harness-server must have ws-bridge dependency)

  **References**:
  - All files: `crates/acp-harness-server/src/**/*.rs`
  - Pattern: `use acp_bridge::` → `use harms_haus_acp_ws_bridge::`

  **Acceptance Criteria**:
  - [ ] All Rust imports updated
  - [ ] No `acp_bridge` references remain
  - [ ] `cargo check` passes

  **QA Scenarios**:
  ```
  Scenario: Verify Rust imports updated
    Tool: Bash
    Steps:
      1. `grep -r "use acp_bridge" crates/acp-harness-server/src/ | wc -l` (should be 0)
      2. `grep -r "use harms_haus_acp_ws_bridge" crates/acp-harness-server/src/ | wc -l` (should be >0)
      3. `cargo check -p harms_haus_acp_harness_server`
    Expected Result:
      - No old imports
      - New imports present
      - Build passes
    Evidence: .sisyphus/evidence/task-25-rust-imports.txt
  ```

  **Commit**: NO (groups with Wave 7)

---

- [ ] 26. Update Rust imports in ws-bridge

  **What to do**:
  - Verify all internal imports in `crates/acp-ws-bridge/src/` use correct paths
  - Update any self-references to use new crate name
  - Ensure no circular dependencies

  **Must NOT do**:
  - Do NOT add harness-specific imports (keep ws-bridge generic)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Simple verification and minor fixes

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 25)
  - **Parallel Group**: Wave 7
  - **Blocks**: Task 36, 38
  - **Blocked By**: Task 7 (lib.rs must be stable)

  **References**:
  - All files: `crates/acp-ws-bridge/src/**/*.rs`

  **Acceptance Criteria**:
  - [ ] All internal imports correct
  - [ ] `cargo check` passes
  - [ ] `cargo test` passes

  **QA Scenarios**:
  ```
  Scenario: Verify ws-bridge imports
    Tool: Bash
    Steps:
      1. `cargo check -p harms_haus_acp_ws_bridge`
      2. `cargo test -p harms_haus_acp_ws_bridge`
    Expected Result:
      - Build passes
      - Tests pass
    Evidence: .sisyphus/evidence/task-26-ws-bridge-imports.txt
  ```

  **Commit**: NO (groups with Wave 7)

---

- [ ] 27. Update TypeScript imports in chat-core

  **What to do**:
  - Update all TypeScript files in `packages/acp-chat-core/src/`:
    - Replace `@acp/` imports with `@harms-haus/` (if any cross-package imports)
    - Note: chat-core is the base, so mostly internal imports
  - Update exports to reference ws-bridge for bridge types:
    - Either re-export from ws-bridge
    - Or update imports to use ws-bridge
  - Remove bridge/ directory (types now in ws-bridge)
  - Update transport/ to use ws-bridge client (or keep local version temporarily)

  **Must NOT do**:
  - Do NOT break existing API surface (re-export if needed)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Careful import and export updates

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 28-30)
  - **Parallel Group**: Wave 7
  - **Blocks**: Task 37, 39
  - **Blocked By**: Task 10 (ws-bridge package must be ready)

  **References**:
  - All TS files: `packages/acp-chat-core/src/**/*.ts`
  - Pattern: `from '@acp/` → `from '@harms-haus/`
  - Use ast_grep_replace: `ast_grep_replace(lang="typescript", pattern="from '@acp/$$$'", rewrite="from '@harms-haus/$$$'")`

  **Acceptance Criteria**:
  - [ ] All imports updated
  - [ ] Bridge types re-exported from ws-bridge (or updated)
  - [ ] `tsc --noEmit` passes
  - [ ] Tests pass

  **QA Scenarios**:
  ```
  Scenario: Verify chat-core imports updated
    Tool: Bash
    Steps:
      1. `grep -r "from '@acp/" packages/acp-chat-core/src/ | wc -l` (should be 0)
      2. `cd packages/acp-chat-core && tsc --noEmit`
      3. `cd packages/acp-chat-core && vitest run`
    Expected Result:
      - No old imports
      - TypeScript compiles
      - Tests pass
    Evidence: .sisyphus/evidence/task-27-chat-core-imports.txt
  ```

  **Commit**: NO (groups with Wave 7)

---

- [ ] 28. Update TypeScript imports in chat-react

  **What to do**:
  - Update all TypeScript files in `packages/acp-chat-react/src/`:
    - Replace `@acp/chat-core` with `@harms-haus/acp-chat-core`
  - Update all imports to use new package names
  - Verify peerDependencies are correct

  **Must NOT do**:
  - Do NOT change component logic
  - Do NOT change component APIs

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Import updates across component library

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 27, 29, 30)
  - **Parallel Group**: Wave 7
  - **Blocks**: Task 37, 39
  - **Blocked By**: Task 21 (package.json must be updated)

  **References**:
  - All TS files: `packages/acp-chat-react/src/**/*.ts`, `packages/acp-chat-react/src/**/*.tsx`
  - Pattern: `from '@acp/chat-core'` → `from '@harms-haus/acp-chat-core'`

  **Acceptance Criteria**:
  - [ ] All imports updated
  - [ ] `tsc --noEmit` passes
  - [ ] Tests pass

  **QA Scenarios**:
  ```
  Scenario: Verify chat-react imports updated
    Tool: Bash
    Steps:
      1. `grep -r "from '@acp/" packages/acp-chat-react/src/ | wc -l` (should be 0)
      2. `cd packages/acp-chat-react && tsc --noEmit`
    Expected Result:
      - No old imports
      - TypeScript compiles
    Evidence: .sisyphus/evidence/task-28-chat-react-imports.txt
  ```

  **Commit**: NO (groups with Wave 7)

---

- [ ] 29. Update TypeScript imports in harness-ui

  **What to do**:
  - Update all TypeScript files in `packages/acp-harness-ui/src/`:
    - Replace `@acp/chat-core` with `@harms-haus/acp-chat-core`
    - Replace `@acp/chat-react` with `@harms-haus/acp-chat-react`
  - Update any references to old harness paths
  - Update App.tsx, components, etc.

  **Must NOT do**:
  - Do NOT change app logic
  - Do NOT remove any functionality

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Import updates in demo application

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 27, 28, 30)
  - **Parallel Group**: Wave 7
  - **Blocks**: Task 37, 39, 40
  - **Blocked By**: Task 19 (harness-ui must be moved)

  **References**:
  - All TS files: `packages/acp-harness-ui/src/**/*.ts`, `packages/acp-harness-ui/src/**/*.tsx`

  **Acceptance Criteria**:
  - [ ] All imports updated
  - [ ] `tsc --noEmit` passes
  - [ ] App builds: `pnpm build` in harness-ui

  **QA Scenarios**:
  ```
  Scenario: Verify harness-ui imports updated
    Tool: Bash
    Steps:
      1. `grep -r "from '@acp/" packages/acp-harness-ui/src/ | wc -l` (should be 0)
      2. `cd packages/acp-harness-ui && tsc --noEmit`
      3. `cd packages/acp-harness-ui && pnpm build`
    Expected Result:
      - No old imports
      - TypeScript compiles
      - Build succeeds
    Evidence: .sisyphus/evidence/task-29-harness-ui-imports.txt
  ```

  **Commit**: NO (groups with Wave 7)

---

- [ ] 30. Update TypeScript imports in integration-tests

  **What to do**:
  - Update all TypeScript files in `packages/integration-tests/src/`:
    - Replace `@acp/chat-core` with `@harms-haus/acp-chat-core`
  - Update any test imports
  - Ensure tests can still run

  **Must NOT do**:
  - Do NOT change test logic
  - Do NOT remove any tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Import updates in test suite

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 27-29)
  - **Parallel Group**: Wave 7
  - **Blocks**: Task 39
  - **Blocked By**: Task 20 (integration-tests package.json updated)

  **References**:
  - All TS files: `packages/integration-tests/src/**/*.ts`

  **Acceptance Criteria**:
  - [ ] All imports updated
  - [ ] `tsc --noEmit` passes
  - [ ] Tests can run: `vitest run` in integration-tests

  **QA Scenarios**:
  ```
  Scenario: Verify integration-tests imports updated
    Tool: Bash
    Steps:
      1. `grep -r "from '@acp/" packages/integration-tests/src/ | wc -l` (should be 0)
      2. `cd packages/integration-tests && vitest run`
    Expected Result:
      - No old imports
      - Tests run (may fail for other reasons, but imports work)
    Evidence: .sisyphus/evidence/task-30-integration-tests-imports.txt
  ```

  **Commit**: NO (groups with Wave 7)

---

- [ ] 31. Update wiki pages with new package names

  **What to do**:
  - Update all wiki files in `docs/wiki/`:
    - Replace `@acp/chat-core` with `@harms-haus/acp-chat-core`
    - Replace `@acp/chat-react` with `@harms-haus/acp-chat-react`
    - Replace `acp-bridge` with `harms_haus_acp_harness_server`
    - Update any code examples to use new import paths
  - Files to update (per AGENTS.md wiki structure):
    - `docs/wiki/Home.md`
    - `docs/wiki/acp-chat-core-Home.md`
    - `docs/wiki/acp-chat-core-Architecture.md`
    - `docs/wiki/acp-chat-core-Types-Reference.md`
    - `docs/wiki/acp-chat-core-Events.md`
    - `docs/wiki/acp-chat-core-Session-Management.md`
    - `docs/wiki/acp-chat-core-Implementation-Guide.md`
    - `docs/wiki/acp-chat-react-Home.md`
    - `docs/wiki/ACP-Protocol.md`

  **Must NOT do**:
  - Do NOT change technical content (only names/paths)
  - Do NOT remove any documentation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Documentation updates across multiple files

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 32-34)
  - **Parallel Group**: Wave 8
  - **Blocks**: Task 41
  - **Blocked By**: Wave 7 (code must be stable)

  **References**:
  - All files: `docs/wiki/*.md`
  - Pattern: `@acp/` → `@harms-haus/`, `acp-bridge` → `harms_haus_acp_harness_server`

  **Acceptance Criteria**:
  - [ ] All wiki pages updated
  - [ ] No `@acp/` references remain in wiki
  - [ ] No `acp-bridge` references remain in wiki
  - [ ] All code examples use new names

  **QA Scenarios**:
  ```
  Scenario: Verify wiki updated
    Tool: Bash
    Steps:
      1. `grep -r "@acp/" docs/wiki/*.md | wc -l` (should be 0)
      2. `grep -r "acp-bridge" docs/wiki/*.md | wc -l` (should be 0)
    Expected Result:
      - No old names in wiki
    Evidence: .sisyphus/evidence/task-31-wiki-updated.txt
  ```

  **Commit**: NO (groups with Wave 8)

---

- [ ] 32. Update AGENTS.md with new conventions

  **What to do**:
  - Update `AGENTS.md`:
    - Update package naming conventions section
    - Update examples to use `@harms-haus/` prefix
    - Update crate naming section
    - Update any file paths
  - Keep all guidelines intact, just update names

  **Must NOT do**:
  - Do NOT change agent guidelines (just update names)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Documentation update

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 31, 33, 34)
  - **Parallel Group**: Wave 8
  - **Blocks**: Task 41
  - **Blocked By**: Wave 7

  **References**:
  - File: `AGENTS.md`

  **Acceptance Criteria**:
  - [ ] AGENTS.md updated with new names
  - [ ] All examples use new package names

  **QA Scenarios**:
  ```
  Scenario: Verify AGENTS.md updated
    Tool: Bash
    Steps:
      1. `grep "@acp/" AGENTS.md | wc -l` (should be 0)
      2. `grep "@harms-haus/" AGENTS.md | wc -l` (should be >0)
    Expected Result:
      - No old names, new names present
    Evidence: .sisyphus/evidence/task-32-agents-md.txt
  ```

  **Commit**: NO (groups with Wave 8)

---

- [ ] 33. Update package README.md files

  **What to do**:
  - Update all `README.md` files in packages:
    - `packages/acp-chat-core/README.md`
    - `packages/acp-chat-react/README.md`
    - `packages/acp-ws-bridge/README.md` (create if doesn't exist)
    - `packages/acp-harness-ui/README.md` (create if doesn't exist)
  - Update installation instructions: `npm install @harms-haus/...`
  - Update import examples
  - Update any usage examples

  **Must NOT do**:
  - Do NOT change API documentation (just names)
  - Do NOT remove any sections

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: README updates across packages

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 31, 32, 34)
  - **Parallel Group**: Wave 8
  - **Blocks**: Task 41
  - **Blocked By**: Wave 7

  **References**:
  - Files: `packages/*/README.md`

  **Acceptance Criteria**:
  - [ ] All README files updated
  - [ ] Installation instructions use new names
  - [ ] Import examples use new names

  **QA Scenarios**:
  ```
  Scenario: Verify README files updated
    Tool: Bash
    Steps:
      1. `grep "npm install @acp/" packages/*/README.md | wc -l` (should be 0)
      2. `grep "from '@acp/" packages/*/README.md | wc -l` (should be 0)
    Expected Result:
      - No old install/import instructions
    Evidence: .sisyphus/evidence/task-33-readmes.txt
  ```

  **Commit**: NO (groups with Wave 8)

---

- [ ] 34. Update inline code comments

  **What to do**:
  - Search for and update any inline comments that reference old names:
    - `grep -r "@acp/" packages/*/src/` for comment references
    - `grep -r "acp-bridge" crates/*/src/` for comment references
  - Update any TODO comments
  - Update any FIXME comments
  - Be careful not to change actual code (only comments)

  **Must NOT do**:
  - Do NOT change code logic
  - Do NOT change actual import statements (already done in Wave 7)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Comment updates only

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 31-33)
  - **Parallel Group**: Wave 8
  - **Blocks**: Task 35
  - **Blocked By**: Wave 7

  **References**:
  - Use grep to find: `grep -rn "@acp/" packages/*/src/ | grep -v "^Binary"`
  - Use grep to find: `grep -rn "acp-bridge" crates/*/src/`

  **Acceptance Criteria**:
  - [ ] All comment references updated
  - [ ] No old names in comments

  **QA Scenarios**:
  ```
  Scenario: Verify comments updated
    Tool: Bash
    Steps:
      1. `grep -r "@acp/" packages/*/src/ | grep -v "^Binary" | grep -v "import" | wc -l` (should be 0 or minimal)
      2. `grep -r "acp-bridge" crates/*/src/ | grep -v "^Binary" | grep -v "use " | grep -v "extern " | wc -l` (should be 0)
    Expected Result:
      - No old names in comments
    Evidence: .sisyphus/evidence/task-34-comments.txt
  ```

  **Commit**: NO (groups with Wave 8)

---

- [ ] 35. Verify no old names remain (grep check)

  **What to do**:
  - Comprehensive grep search for old names:
    - `grep -r "@acp/" packages/` (TypeScript packages)
    - `grep -r "acp-bridge" crates/` (Rust crates)
    - `grep -r "apps/harness" .` (old harness path)
    - `grep -r "@acp/" docs/` (documentation)
    - Check package.json files, tsconfig.json, Cargo.toml
  - Any remaining references must be intentional (e.g., git history, comments explaining the rename)
  - Document any intentional exceptions

  **Must NOT do**:
  - Do NOT miss any references (this is critical)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Systematic verification via grep

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Wave 8)
  - **Parallel Group**: Wave 9
  - **Blocks**: Task 40, 41
  - **Blocked By**: Wave 8 (all updates complete)

  **References**:
  - Use grep comprehensively across entire codebase

  **Acceptance Criteria**:
  - [ ] No `@acp/` references in packages/ (except maybe in pnpm-lock.yaml which will be regenerated)
  - [ ] No `acp-bridge` references in crates/ (except git history)
  - [ ] No `apps/harness` references
  - [ ] Document any intentional exceptions

  **QA Scenarios**:
  ```
  Scenario: Comprehensive grep verification
    Tool: Bash
    Steps:
      1. `grep -r "@acp/" packages/ --include="*.json" --include="*.ts" --include="*.tsx" | wc -l` (should be 0)
      2. `grep -r "acp-bridge" crates/ --include="*.rs" --include="*.toml" | grep -v "target/" | wc -l` (should be 0)
      3. `grep -r "apps/harness" . --include="*.json" --include="*.yaml" --include="*.yml" --include="*.sh" | grep -v ".git/" | wc -l` (should be 0)
    Expected Result:
      - All counts are 0
    Evidence: .sisyphus/evidence/task-35-grep-verification.txt
  ```

  **Commit**: NO (groups with Wave 9)

---

- [ ] 36. Verify Rust builds (cargo check all crates)

  **What to do**:
  - Run `cargo check` for all crates:
    - `cargo check -p harms_haus_acp_ws_bridge`
    - `cargo check -p harms_haus_acp_harness_server`
  - Run `cargo build` to ensure full build works
  - Fix any compilation errors
  - Check for warnings

  **Must NOT do**:
  - Do NOT ignore warnings (fix them)
  - Do NOT proceed with errors

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Build verification

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 37)
  - **Parallel Group**: Wave 9
  - **Blocks**: Task 38
  - **Blocked By**: Tasks 25, 26 (imports must be updated)

  **References**:
  - Commands: `cargo check`, `cargo build`

  **Acceptance Criteria**:
  - [ ] `cargo check` passes for all crates
  - [ ] `cargo build` succeeds
  - [ ] No compilation errors
  - [ ] Minimal warnings (ideally 0)

  **QA Scenarios**:
  ```
  Scenario: Verify Rust builds
    Tool: Bash
    Steps:
      1. `cargo check --workspace`
      2. `cargo build --workspace`
    Expected Result:
      - Both commands succeed
      - No errors
    Evidence: .sisyphus/evidence/task-36-rust-build.txt
  ```

  **Commit**: NO (groups with Wave 9)

---

- [ ] 37. Verify TypeScript builds (tsc --noEmit all packages)

  **What to do**:
  - Run `tsc --noEmit` in all packages:
    - `cd packages/acp-ws-bridge && tsc --noEmit`
    - `cd packages/acp-chat-core && tsc --noEmit`
    - `cd packages/acp-chat-react && tsc --noEmit`
    - `cd packages/acp-harness-ui && tsc --noEmit`
    - `cd packages/integration-tests && tsc --noEmit`
  - Run `pnpm build` to verify full build
  - Fix any type errors

  **Must NOT do**:
  - Do NOT ignore type errors
  - Do NOT use @ts-ignore to suppress errors

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: TypeScript compilation verification

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 36)
  - **Parallel Group**: Wave 9
  - **Blocks**: Task 39
  - **Blocked By**: Tasks 27-30 (imports must be updated)

  **References**:
  - Commands: `tsc --noEmit`, `pnpm build`

  **Acceptance Criteria**:
  - [ ] `tsc --noEmit` passes in all packages
  - [ ] `pnpm build` succeeds
  - [ ] No type errors

  **QA Scenarios**:
  ```
  Scenario: Verify TypeScript builds
    Tool: Bash
    Steps:
      1. `tsc --noEmit` (root)
      2. `pnpm build`
    Expected Result:
      - Both commands succeed
      - No errors
    Evidence: .sisyphus/evidence/task-37-typescript-build.txt
  ```

  **Commit**: NO (groups with Wave 9)

---

- [ ] 38. Run all Rust tests (cargo test)

  **What to do**:
  - Run `cargo test` for all crates:
    - `cargo test -p harms_haus_acp_ws_bridge`
    - `cargo test -p harms_haus_acp_harness_server`
  - Run `cargo test --workspace` to run all tests
  - Fix any failing tests
  - Verify test coverage is maintained

  **Must NOT do**:
  - Do NOT skip failing tests
  - Do NOT delete tests to make them pass

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Test verification

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 36)
  - **Parallel Group**: Wave 9
  - **Blocks**: None
  - **Blocked By**: Task 36 (must build first)

  **References**:
  - Command: `cargo test --workspace`

  **Acceptance Criteria**:
  - [ ] All Rust tests pass
  - [ ] No test failures
  - [ ] Coverage maintained

  **QA Scenarios**:
  ```
  Scenario: Verify Rust tests pass
    Tool: Bash
    Steps:
      1. `cargo test --workspace`
    Expected Result:
      - All tests pass
      - Output shows test results
    Evidence: .sisyphus/evidence/task-38-rust-tests.txt
  ```

  **Commit**: NO (groups with Wave 9)

---

- [ ] 39. Run all TypeScript tests (vitest run)

  **What to do**:
  - Run tests in all packages:
    - `cd packages/acp-chat-core && vitest run`
    - `cd packages/acp-chat-react && vitest run`
    - `cd packages/integration-tests && vitest run`
  - Run `pnpm test` at root to run all tests
  - Fix any failing tests

  **Must NOT do**:
  - Do NOT skip failing tests
  - Do NOT modify test expectations without understanding why

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None
  - **Reason**: Test verification

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 37)
  - **Parallel Group**: Wave 9
  - **Blocks**: None
  - **Blocked By**: Task 37 (must build first)

  **References**:
  - Commands: `vitest run`, `pnpm test`

  **Acceptance Criteria**:
  - [ ] All TypeScript tests pass
  - [ ] No test failures

  **QA Scenarios**:
  ```
  Scenario: Verify TypeScript tests pass
    Tool: Bash
    Steps:
      1. `pnpm test`
    Expected Result:
      - All tests pass
      - Output shows test results
    Evidence: .sisyphus/evidence/task-39-typescript-tests.txt
  ```

  **Commit**: NO (groups with Wave 9)

---

- [ ] 40. Integration test: Start server and connect UI

  **What to do**:
  - Build and start the harness-server:
    - `cargo build -p harms_haus_acp_harness_server`
    - Run the server binary
  - Build and start the harness-ui:
    - `cd packages/acp-harness-ui && pnpm build && pnpm preview`
  - Verify WebSocket connection works:
    - UI should connect to server
    - Server should accept connections
    - Messages should flow correctly
  - Test both live mode and replay mode
  - Test extra-data mechanism (replay speed)

  **Must NOT do**:
  - Do NOT skip this test (critical integration check)
  - Do NOT ignore connection failures

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Integration testing requires running actual services

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Tasks 36-39)
  - **Parallel Group**: Wave 9
  - **Blocks**: Task 41
  - **Blocked By**: Tasks 36-39 (must build and test first)

  **References**:
  - Commands: `cargo run -p harms_haus_acp_harness_server`, `pnpm dev:harness`

  **Acceptance Criteria**:
  - [ ] Server starts successfully
  - [ ] UI builds and runs
  - [ ] WebSocket connection established
  - [ ] Messages flow correctly
  - [ ] Replay speed control works (extra-data mechanism)

  **QA Scenarios**:
  ```
  Scenario: Full integration test
    Tool: Bash (multiple terminals)
    Steps:
      1. Terminal 1: `cargo run -p harms_haus_acp_harness_server`
      2. Terminal 2: `cd packages/acp-harness-ui && pnpm dev`
      3. Open browser to harness-ui URL
      4. Click "Connect" or equivalent
      5. Verify connection status shows connected
      6. Test replay mode with speed slider
    Expected Result:
      - Server starts without errors
      - UI loads in browser
      - WebSocket connects successfully
      - Replay speed changes work
    Evidence: .sisyphus/evidence/task-40-integration-test.txt
  ```

  **Commit**: NO (groups with Wave 9)

---

- [ ] 41. Final documentation verification

  **What to do**:
  - Verify all documentation is accurate:
    - Wiki pages reflect actual code
    - AGENTS.md is up to date
    - README files are accurate
    - All examples work
  - Check for broken links
  - Verify code examples compile/run
  - Create summary of changes for users

  **Must NOT do**:
  - Do NOT skip documentation verification
  - Do NOT leave outdated documentation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: None
  - **Reason**: Final comprehensive documentation check

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Wave 9)
  - **Parallel Group**: Wave 9 (final task)
  - **Blocks**: None
  - **Blocked By**: Tasks 31-34, 40 (docs and integration must be complete)

  **References**:
  - All documentation files

  **Acceptance Criteria**:
  - [ ] All documentation verified
  - [ ] No broken links
  - [ ] Code examples work
  - [ ] Summary of changes documented

  **QA Scenarios**:
  ```
  Scenario: Final documentation verification
    Tool: Read files, manual verification
    Steps:
      1. Read docs/wiki/Home.md - verify accuracy
      2. Read AGENTS.md - verify accuracy
      3. Read packages/*/README.md - verify accuracy
      4. Try to follow installation instructions
      5. Try to follow quick start examples
    Expected Result:
      - All documentation accurate
      - Examples work as documented
    Evidence: .sisyphus/evidence/task-41-docs-verification.txt
  ```

  **Commit**: NO (groups with Wave 9)

---

## Final Verification Wave (MANDATORY - after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`

  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  
  **Verifications**:
  - [ ] New crate `harms_haus_acp_ws_bridge` exists in `crates/acp-ws-bridge/`
  - [ ] New package `@harms-haus/acp-ws-bridge` exists in `packages/acp-ws-bridge/`
  - [ ] Renamed crate `harms_haus_acp_harness_server` exists in `crates/acp-harness-server/`
  - [ ] Renamed package `@harms-haus/acp-harness-ui` exists in `packages/acp-harness-ui/`
  - [ ] All packages use `@harms-haus/` prefix
  - [ ] All crates use `harms_haus_` prefix
  - [ ] Extra-data mechanism implemented
  - [ ] Trace logging added
  - [ ] No `@acp/` references in packages/ (except pnpm-lock.yaml)
  - [ ] No `acp-bridge` references in crates/ (except target/)
  
  **Output**: `Must Have [10/10] | Must NOT Have [0/0] | Tasks [41/41] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`

  Run `cargo check --workspace`, `cargo clippy --workspace`, `tsc --noEmit` (root), `pnpm lint` (if exists). Review all changed files for: `as any`/`@ts-ignore`, empty catches, `println!` in production (should be `tracing::`), commented-out code, unused imports.
  
  **Checks**:
  - [ ] `cargo check --workspace` passes
  - [ ] `cargo clippy --workspace` passes (or minimal warnings)
  - [ ] `tsc --noEmit` passes in root
  - [ ] No `as any` without justification
  - [ ] No `println!` in library code (use tracing)
  - [ ] No unused imports
  - [ ] No commented-out code
  
  **Output**: `Build [PASS/FAIL] | Clippy [PASS/FAIL] | TypeScript [PASS/FAIL] | Code Quality [CLEAN/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI tests exist)

  Start from clean state. Execute integration test (Task 40): build and run harness-server, build and run harness-ui, verify WebSocket connection, test replay speed control, capture evidence.
  
  **Test Scenarios**:
  - [ ] Server starts: `cargo run -p harms_haus_acp_harness_server`
  - [ ] UI builds: `cd packages/acp-harness-ui && pnpm build`
  - [ ] UI connects to server via WebSocket
  - [ ] Replay mode loads and plays
  - [ ] Speed slider changes playback rate
  - [ ] Live mode works (if testable)
  
  **Output**: `Scenarios [6/6 pass] | Integration [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`

  For each task: read "What to do", read actual code. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination.
  
  **Verifications**:
  - [ ] ws-bridge contains only generic WebSocket code (no replay logic)
  - [ ] harness-server contains replay modes and CLI
  - [ ] No behavior changes (only moves and renames)
  - [ ] Extra-data is truly free-form (not typed to replay)
  - [ ] All renames complete (no partial updates)
  
  **Output**: `Tasks [41/41 compliant] | Scope [CLEAN/N creep] | VERDICT`

---

## Commit Strategy

Given the complexity and number of changes, commits will be grouped by wave:

### Wave 1 Commit (Tasks 1-4)
```bash
git add crates/acp-ws-bridge/ packages/acp-ws-bridge/ pnpm-workspace.yaml Cargo.toml
git commit -m "feat: create acp-ws-bridge crate and package structure

- Add harms_haus_acp_ws_bridge Rust crate
- Add @harms-haus/acp-ws-bridge TypeScript package
- Update workspace configuration
- Design extra-data types for generic extensions

Part of: extract-ws-bridge-and-rename-packages"
```

### Wave 2 Commit (Tasks 5-8)
```bash
git add crates/acp-ws-bridge/src/ packages/acp-ws-bridge/src/
git commit -m "feat: extract WebSocket contract and server code to ws-bridge

- Extract contract types (BridgeEnvelope, BridgeMessage)
- Add extra_data field for generic extensions
- Extract server implementation (generic only, no replay)
- Extract TypeScript types and client

Part of: extract-ws-bridge-and-rename-packages"
```

### Wave 3 Commit (Tasks 9-12)
```bash
git add crates/acp-ws-bridge/ packages/acp-ws-bridge/
git commit -m "feat: complete ws-bridge package and add trace logging

- Extract TransportClient to ws-bridge package
- Add package exports and build configuration
- Add trace logging to Rust ws-bridge
- Add trace logging to TypeScript ws-bridge

Part of: extract-ws-bridge-and-rename-packages"
```

### Wave 4 Commit (Tasks 13-16)
```bash
git add crates/acp-harness-server/
git commit -m "refactor: rename acp-bridge to acp-harness-server

- Rename directory: crates/acp-bridge -> crates/acp-harness-server
- Update package name: harms_haus_acp_harness_server
- Add dependency on harms_haus_acp_ws_bridge
- Update all imports and references
- Remove duplicate code (now in ws-bridge)

Part of: extract-ws-bridge-and-rename-packages"
```

### Wave 5 Commit (Tasks 17-20)
```bash
git add packages/acp-chat-core/package.json packages/acp-chat-react/package.json \
        packages/acp-harness-ui/ packages/integration-tests/package.json
git commit -m "refactor: add @harms-haus prefix to all TypeScript packages

- Rename @acp/chat-core -> @harms-haus/acp-chat-core
- Rename @acp/chat-react -> @harms-haus/acp-chat-react
- Move and rename apps/harness -> packages/acp-harness-ui (@harms-haus/acp-harness-ui)
- Rename @acp/integration-tests -> @harms-haus/integration-tests

Part of: extract-ws-bridge-and-rename-packages"
```

### Wave 6 Commit (Tasks 21-24)
```bash
git add pnpm-workspace.yaml package.json tsconfig.json packages/*/package.json
git commit -m "chore: update workspace and package configurations

- Update all package.json dependencies to @harms-haus/*
- Update pnpm-workspace.yaml (remove apps/*)
- Update root package.json scripts
- Update tsconfig.json references

Part of: extract-ws-bridge-and-rename-packages"
```

### Wave 7 Commit (Tasks 25-30)
```bash
git add crates/acp-harness-server/src/ crates/acp-ws-bridge/src/ \
        packages/*/src/
git commit -m "refactor: update all imports to use new package names

- Update Rust imports in harness-server and ws-bridge
- Update TypeScript imports in all packages
- Remove duplicate type definitions (now in ws-bridge)
- Ensure all imports resolve correctly

Part of: extract-ws-bridge-and-rename-packages"
```

### Wave 8 Commit (Tasks 31-34)
```bash
git add docs/wiki/ AGENTS.md packages/*/README.md crates/*/src/
git commit -m "docs: update all documentation with new package names

- Update wiki pages with @harms-haus/* references
- Update AGENTS.md with new conventions
- Update all README.md files
- Update inline code comments

Part of: extract-ws-bridge-and-rename-packages"
```

### Wave 9 Commit (Tasks 35-41)
```bash
git commit -m "chore: final verification and validation

- Verify no old package names remain
- Verify all builds pass (cargo check, tsc --noEmit)
- Verify all tests pass (cargo test, vitest run)
- Integration test: server and UI work correctly
- Final documentation verification

Closes: extract-ws-bridge-and-rename-packages"
```

---

## Success Criteria

### Verification Commands

**Rust Verification**:
```bash
# Check all crates compile
cargo check --workspace

# Build all crates
cargo build --workspace

# Run all Rust tests
cargo test --workspace

# Verify crate names
cargo metadata --format-version 1 | jq '.packages[].name' | grep harms_haus
```

**TypeScript Verification**:
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type check all packages
pnpm exec tsc --noEmit

# Run all tests
pnpm test
```

**Name Verification**:
```bash
# Verify no old TypeScript package names remain
grep -r "@acp/" packages/ --include="*.json" --include="*.ts" --include="*.tsx" | wc -l
# Expected: 0

# Verify no old Rust crate names remain
grep -r "acp-bridge" crates/ --include="*.rs" --include="*.toml" | grep -v "target/" | grep -v ".git/" | wc -l
# Expected: 0

# Verify no old paths remain
grep -r "apps/harness" . --include="*.json" --include="*.yaml" --include="*.sh" | grep -v ".git/" | wc -l
# Expected: 0
```

**Integration Verification**:
```bash
# Terminal 1: Start server
cargo run -p harms_haus_acp_harness_server

# Terminal 2: Build and run UI
cd packages/acp-harness-ui && pnpm dev

# Verify:
# - Server starts without errors
# - UI loads in browser
# - WebSocket connection works
# - Replay mode functions
# - Speed control works
```

### Final Checklist

- [ ] **Crate Structure**: 
  - [ ] `crates/acp-ws-bridge/` exists with `harms_haus_acp_ws_bridge`
  - [ ] `crates/acp-harness-server/` exists with `harms_haus_acp_harness_server`
  
- [ ] **Package Structure**:
  - [ ] `packages/acp-ws-bridge/` exists with `@harms-haus/acp-ws-bridge`
  - [ ] `packages/acp-chat-core/` uses `@harms-haus/acp-chat-core`
  - [ ] `packages/acp-chat-react/` uses `@harms-haus/acp-chat-react`
  - [ ] `packages/acp-harness-ui/` uses `@harms-haus/acp-harness-ui`
  - [ ] `packages/integration-tests/` uses `@harms-haus/integration-tests`
  
- [ ] **Build Status**:
  - [ ] `cargo check --workspace` passes
  - [ ] `cargo build --workspace` succeeds
  - [ ] `tsc --noEmit` passes
  - [ ] `pnpm build` succeeds
  
- [ ] **Test Status**:
  - [ ] `cargo test --workspace` passes
  - [ ] `pnpm test` passes
  
- [ ] **Name Cleanup**:
  - [ ] No `@acp/` references in packages/
  - [ ] No `acp-bridge` references in crates/
  - [ ] No `apps/harness` references
  
- [ ] **Documentation**:
  - [ ] Wiki pages updated
  - [ ] AGENTS.md updated
  - [ ] All README.md files updated
  - [ ] Inline comments updated
  
- [ ] **Functionality**:
  - [ ] WebSocket server works
  - [ ] WebSocket client connects
  - [ ] Extra-data mechanism works (replay speed)
  - [ ] Trace logging present
  
- [ ] **Integration**:
  - [ ] harness-server runs
  - [ ] harness-ui builds and runs
  - [ ] WebSocket connection works
  - [ ] Replay mode works

---

## Assumptions and Dependencies

### Assumptions
1. **Clean separation is possible**: WebSocket code can be cleanly separated from replay-specific code
2. **No circular dependencies**: Creating ws-bridge won't create circular deps with harness-server
3. **Git history preservation**: `git mv` will preserve history correctly
4. **pnpm workspace compatibility**: All packages work with pnpm workspace

### External Dependencies
- **Rust toolchain**: Must have cargo, rustc installed
- **Node.js**: Must have Node.js >=20.0.0
- **pnpm**: Must have pnpm >=9.0.0
- **Git**: Must have git for history-preserving moves

### Blocking Dependencies
- Task 1-4 (Wave 1) → Can start immediately
- Task 5-8 (Wave 2) → Needs Task 1-4
- Task 9-12 (Wave 3) → Needs Task 5-8
- Task 13-16 (Wave 4) → Needs Task 9-12
- Task 17-20 (Wave 5) → Can run parallel with Wave 4
- Task 21-24 (Wave 6) → Needs Wave 5
- Task 25-30 (Wave 7) → Needs Wave 4 and Wave 6
- Task 31-34 (Wave 8) → Needs Wave 7
- Task 35-41 (Wave 9) → Needs Wave 8

---

## Rollback Strategy

If issues are discovered:

1. **Per-Wave Rollback**: Each wave is committed separately, so can revert individual commits
2. **Git Revert**: Use `git revert <commit-hash>` to undo specific waves
3. **Branch Strategy**: Recommend creating feature branch for this work
4. **Backup**: Ensure all changes are in git before proceeding to next wave

### Emergency Rollback Commands
```bash
# Revert last commit
git revert HEAD

# Revert specific wave
git revert <wave-commit-hash>

# Hard reset to pre-work state (DESTRUCTIVE - use with caution)
git reset --hard <pre-work-commit>
```
