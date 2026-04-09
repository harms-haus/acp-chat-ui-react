# Status Tracking Implementation for ACP Chat Core

## TL;DR

> **Quick Summary**: Add automatic status tracking to normalized thoughts, tools, and messages in `acp-chat-core`. Status transitions will be inferred from ACP event flow when not explicitly provided.
> 
> **Deliverables**:
> - `NormalizedThought` with `status` field and `ThoughtStatus` type
> - Enhanced `ToolCallStatus` supporting `"executing"`, `"failed"`, `"cancelled"`
> - Status inference logic in normalization handlers
> - Updated wiki documentation for all modified types
> 
> **Estimated Effort**: Medium (3-4 hours)
> **Parallel Execution**: NO - Sequential dependencies on type changes
> **Critical Path**: Type Definitions → Thought Status Logic → Tool Status Logic → Wiki Updates

---

## Context

### Original Request
Add automatic status tracking for normalized thoughts, tools, and messages in `acp-chat-core`. Status should track the lifecycle from creation through streaming/execution to completion.

### Interview Summary
**Key Decisions**:
- Status values: `undefined` (initial), `"streaming"` (receiving chunks), `"executing"` (tool running), `"completed"` (finished)
- Thoughts support same statuses as messages: `"streaming"`, `"complete"`, `"cancelled"`, `"error"`
- Tool calls support ACP lifecycle: `"pending"`, `"executing"`, `"completed"`, `"failed"`, `"cancelled"`
- Initial state is `undefined` to distinguish entity creation from streaming start
- Status inferred from event flow when not explicitly provided in ACP events

**Research Findings**:
- Current: `NormalizedMessage` has `status`, `NormalizedThought` has NONE, `NormalizedToolCall` has limited status
- ACP Protocol maps: `in_progress` → `"executing"`, terminal states → appropriate completions
- React layer already has `onThoughtCreated/Completed` and `onToolCreated/Completed` callbacks
- Main file: `src/normalization/store.ts` with `applySessionUpdate()` entry point

### Metis Review
**Identified Gaps** (addressed):
- Tool status should include `"failed"` and `"cancelled"` per ACP protocol
- Need clear documentation of status transition rules
- Wiki documentation must be updated for type changes
- Completion detection needs careful handling of edge cases

---

## Work Objectives

### Core Objective
Implement automatic status tracking that transitions entities through their lifecycle states based on ACP event flow, with graceful fallback to inference when explicit status is not provided.

### Concrete Deliverables
1. `ThoughtStatus` type definition (`"streaming" | "complete" | "cancelled" | "error"`)
2. `NormalizedThought` interface with optional `status?: ThoughtStatus`
3. Enhanced `ToolCallStatus` type with `"executing"`, `"failed"`, `"cancelled"`
4. Status mapping functions for ACP protocol states
5. Status inference logic in `applyAgentThoughtChunk()` and `applyToolCall()`
6. Completion detection when new entities arrive
7. Updated wiki documentation for all modified types

### Definition of Done
- [ ] TypeScript compiles without errors
- [ ] All normalized entities (thoughts, tools, messages) have proper status tracking
- [ ] Status transitions follow ACP protocol semantics
- [ ] Wiki documentation reflects all type changes
- [ ] No regressions in existing functionality

### Must Have
- Status field on `NormalizedThought`
- `"executing"` status for tool calls
- Status inference from ACP event flow
- Wiki documentation updates

### Must NOT Have (Guardrails)
- NO UI/visual indicator changes (React components out of scope)
- NO event emission modifications for callbacks
- NO new status types beyond defined set
- NO modifications to `NormalizedMessage` status handling
- NO changes to replay/capture systems
- NO refactoring of unrelated code

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test configured)
- **Automated tests**: YES (Tests after implementation)
- **Framework**: bun test

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Type checking**: Use Bash (`bun tsc --noEmit`) to verify type correctness
- **Logic verification**: Use Bash (`bun test`) to run unit tests
- **Documentation**: Use Read to verify wiki updates

---

## Execution Strategy

### Sequential Execution Waves

This work has type dependencies that require sequential execution:

```
Wave 1 (Foundation - Type Definitions):
└── Task 1: Define ThoughtStatus type and update NormalizedThought

Wave 2 (Core Logic - Thought Status):
└── Task 2: Implement status inference in applyAgentThoughtChunk()

Wave 3 (Core Logic - Tool Status):
└── Task 3: Enhance ToolCallStatus and update applyToolCall()

Wave 4 (Integration - Wiki Documentation):
└── Task 4: Update wiki documentation for modified types

Wave FINAL (Verification):
└── Task 5: Final type checking and validation

Critical Path: Task 1 → Task 2 → Task 3 → Task 4 → Task 5
```

### Agent Dispatch Summary

- **1**: `quick` - Type definitions (Task 1)
- **2**: `deep` - Thought status logic (Task 2)
- **3**: `deep` - Tool status logic (Task 3)
- **4**: `writing` - Wiki documentation (Task 4)
- **5**: `quick` - Final verification (Task 5)

---

## TODOs

- [x] 1. Define ThoughtStatus Type and Update NormalizedThought Interface

  **What to do**:
  - Add `ThoughtStatus` type definition matching `MessageStatus`: `"streaming" | "complete" | "cancelled" | "error"`
  - Add optional `status?: ThoughtStatus` field to `NormalizedThought` interface
  - Export `ThoughtStatus` from `src/index.ts` if not already exported
  - Update `ToolCallStatus` to include: `"pending" | "executing" | "completed" | "failed" | "cancelled"`
  
  **Must NOT do**:
  - Do NOT modify `NormalizedMessage` interface
  - Do NOT change existing `MessageStatus` values
  - Do NOT add implementation logic yet (types only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward type definition changes
  - **Skills**: `ts-bug-fixer`
    - `ts-bug-fixer`: Ensure type definitions are correct and exports work

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (Foundation)
  - **Blocks**: Tasks 2, 3, 4, 5
  - **Blocked By**: None

  **References**:
  - `src/normalization/store.ts:3` - Current `MessageStatus` type to match
  - `src/normalization/store.ts:44-50` - `NormalizedThought` interface location
  - `src/normalization/store.ts:54` - `ToolCallStatus` to enhance
  - `src/index.ts` - Export location
  - `docs/wiki/acp-chat-core-Types-Reference.md` - Wiki to update later

  **Acceptance Criteria**:
  - [ ] `ThoughtStatus` type defined as `"streaming" | "complete" | "cancelled" | "error"`
  - [ ] `NormalizedThought` has `status?: ThoughtStatus` field
  - [ ] `ToolCallStatus` includes `"executing"`, `"failed"`, `"cancelled"`
  - [ ] `bun tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Type definitions compile
    Tool: Bash
    Steps:
      1. bun tsc --noEmit
    Expected Result: No TypeScript errors
    Evidence: .sisyphus/evidence/task-1-types-compile.txt
  ```

  **Commit**: YES
  - Message: `feat(types): add ThoughtStatus and update NormalizedThought`
  - Files: `packages/acp-chat-core/src/normalization/store.ts`, `packages/acp-chat-core/src/index.ts`

- [x] 2. Implement Status Inference in applyAgentThoughtChunk()

  **What to do**:
  - Modify `applyAgentThoughtChunk()` to track status transitions
  - On first chunk (new thought): Set `status: "streaming"` (was `undefined`)
  - On subsequent chunks: Keep `status: "streaming"`
  - Map ACP status to thought status using same logic as messages:
    - `"in_progress"` → `"streaming"`
    - `"done"` → `"complete"`
    - `"cancelled"` → `"cancelled"`
    - `"error"` → `"error"`
  - Create helper function `inferThoughtStatus()` for status inference
  - Add completion detection: When new thought arrives with different `turnId`, mark previous thought as `"completed"`
  - Handle edge case: Thoughts without `turnId` never auto-complete

  **Must NOT do**:
  - Do NOT modify message handling logic
  - Do NOT add UI-related code
  - Do NOT change function signature of `applyAgentThoughtChunk()`

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex logic with edge cases and state management
  - **Skills**: `ts-bug-fixer`
    - `ts-bug-fixer`: Ensure type-safe implementation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (Core Logic)
  - **Blocks**: Task 4, 5
  - **Blocked By**: Task 1

  **References**:
  - `src/normalization/store.ts:248-297` - `applyAgentMessageChunk()` for reference patterns
  - `src/normalization/store.ts:299-311` - `mapChunkStatus()` to replicate for thoughts
  - `src/normalization/store.ts:349-378` - `applyAgentThoughtChunk()` to modify
  - ACP Protocol (section 5): `agent_thought_chunk` event structure

  **Acceptance Criteria**:
  - [ ] New thoughts start with `status: undefined`
  - [ ] First chunk sets `status: "streaming"`
  - [ ] ACP status `"done"` sets `status: "complete"`
  - [ ] New thought with different `turnId` marks previous as complete
  - [ ] `bun tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Thought status transitions correctly
    Tool: Bash (bun test or manual verification)
    Steps:
      1. Create test case creating thought via applyAgentThoughtChunk
      2. Verify initial status is undefined
      3. Send first chunk, verify status becomes "streaming"
      4. Send ACP status "done", verify status becomes "complete"
    Expected Result: Status transitions follow expected flow
    Evidence: .sisyphus/evidence/task-2-thought-status.txt
  ```

  **Commit**: YES
  - Message: `feat(normalization): implement status inference for thoughts`
  - Files: `packages/acp-chat-core/src/normalization/store.ts`

- [x] 3. Enhance Tool Call Status Tracking

  **What to do**:
  - Update `mapToolCallStatus()` to handle ACP protocol states:
    - `"pending"` → `"pending"` (initial state)
    - `"in_progress"` → `"executing"`
    - `"completed"` → `"completed"`
    - `"failed"` → `"failed"`
    - `"cancelled"` → `"cancelled"`
  - Modify `applyToolCall()` to set initial `status: undefined` (not `"pending"`)
  - Modify `applyToolCallUpdate()` to handle status transitions
  - Add completion detection for tool calls when new tool call arrives
  - Ensure tool calls without explicit status stay in current state

  **Must NOT do**:
  - Do NOT change how tool calls are created (except initial status)
  - Do NOT modify permission request handling
  - Do NOT add new tool call fields beyond status

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: State machine logic with multiple status transitions
  - **Skills**: `ts-bug-fixer`
    - `ts-bug-fixer`: Ensure exhaustive status handling

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (Core Logic)
  - **Blocks**: Task 4, 5
  - **Blocked By**: Task 1, 2

  **References**:
  - `src/normalization/store.ts:500` - `mapToolCallStatus()` to enhance
  - `src/normalization/store.ts:480-520` - `applyToolCall()` function
  - `src/normalization/store.ts:520-560` - `applyToolCallUpdate()` function
  - ACP Protocol (section 8): Tool call lifecycle states

  **Acceptance Criteria**:
  - [ ] Tool calls start with `status: undefined`
  - [ ] ACP `"in_progress"` maps to `"executing"`
  - [ ] ACP `"failed"` maps to `"failed"`
  - [ ] ACP `"cancelled"` maps to `"cancelled"`
  - [ ] `bun tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Tool call status follows ACP lifecycle
    Tool: Bash (bun test or manual verification)
    Steps:
      1. Create tool call via applyToolCall
      2. Verify initial status is undefined
      3. Update with ACP status "in_progress", verify becomes "executing"
      4. Update with ACP status "completed", verify becomes "completed"
    Expected Result: Tool status matches ACP protocol
    Evidence: .sisyphus/evidence/task-3-tool-status.txt
  ```

  **Commit**: YES
  - Message: `feat(normalization): enhance tool call status tracking`
  - Files: `packages/acp-chat-core/src/normalization/store.ts`

- [x] 4. Update Wiki Documentation

  **What to do**:
  - Update `acp-chat-core-Types-Reference.md`:
    - Add `ThoughtStatus` type documentation
    - Update `NormalizedThought` to include `status` field
    - Update `ToolCallStatus` with new values
  - Update `acp-chat-core-Events.md`:
    - Document status transition rules
    - Explain inference logic for thoughts/tools
  - Update examples in wiki to show status fields
  - Ensure all links between pages work correctly

  **Must NOT do**:
  - Do NOT create new wiki pages (update existing)
  - Do NOT modify unrelated documentation
  - Do NOT change ACP Protocol documentation (external spec)

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation writing task
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (Documentation)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1, 2, 3

  **References**:
  - `docs/wiki/acp-chat-core-Types-Reference.md` - Type documentation
  - `docs/wiki/acp-chat-core-Events.md` - Event system docs
  - `src/normalization/store.ts` - Source of truth for types

  **Acceptance Criteria**:
  - [ ] `ThoughtStatus` documented with all values
  - [ ] `NormalizedThought` shows `status` field
  - [ ] `ToolCallStatus` shows all 5 values
  - [ ] Status transition rules explained
  - [ ] Examples updated

  **QA Scenarios**:
  ```
  Scenario: Wiki documentation is complete
    Tool: Read
    Steps:
      1. Read docs/wiki/acp-chat-core-Types-Reference.md
      2. Verify ThoughtStatus section exists
      3. Verify NormalizedThought includes status field
      4. Verify ToolCallStatus includes all 5 values
    Expected Result: All types properly documented
    Evidence: .sisyphus/evidence/task-4-wiki-check.txt
  ```

  **Commit**: YES
  - Message: `docs(wiki): update type documentation for status tracking`
  - Files: `docs/wiki/acp-chat-core-Types-Reference.md`, `docs/wiki/acp-chat-core-Events.md`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. Verify implementation:
  - `ThoughtStatus` type exists with all 4 values
  - `NormalizedThought` has `status?: ThoughtStatus` field
  - `ToolCallStatus` includes `"executing"`, `"failed"`, `"cancelled"`
  - Status mapping functions exist for thoughts and tools
  - Completion detection logic implemented
  - Wiki documentation updated for all types
  Output: `Types [4/4] | Functions [2/2] | Docs [2/2] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `quick`
  Run `bun tsc --noEmit` to verify TypeScript compilation.
  Check for:
  - Type errors or mismatches
  - Missing exports
  - `any` type usage
  - Unused imports
  Output: `Build [PASS/FAIL] | Type Errors [N] | VERDICT`

- [ ] F3. **Wiki Documentation Check** — `quick`
  Verify wiki files updated:
  - `acp-chat-core-Types-Reference.md` has `ThoughtStatus` section
  - `NormalizedThought` includes `status` field documentation
  - `ToolCallStatus` shows all 5 values
  - `acp-chat-core-Events.md` has status transition rules
  Output: `Docs [4/4 updated] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `quick`
  Verify no out-of-scope changes:
  - No React component modifications
  - No event emission logic changes
  - No test file additions
  - No unrelated refactoring
  - Only `store.ts`, `index.ts`, and wiki files touched
  Output: `Scope [CLEAN/N violations] | VERDICT`

---

## Commit Strategy

- **1**: `feat(types): add ThoughtStatus and update NormalizedThought` - store.ts, index.ts
- **2**: `feat(normalization): implement status inference for thoughts` - store.ts
- **3**: `feat(normalization): enhance tool call status tracking` - store.ts
- **4**: `docs(wiki): update type documentation for status tracking` - docs/wiki/*.md
- **5**: `chore(verify): final type checking and validation` - all files

---

## Success Criteria

### Verification Commands
```bash
# Type checking - must pass
cd packages/acp-chat-core && bun tsc --noEmit

# Check exports exist
grep -n "ThoughtStatus" src/index.ts
grep -n "ToolCallStatus" src/index.ts

# Wiki verification
grep -n "ThoughtStatus" docs/wiki/acp-chat-core-Types-Reference.md
grep -n "status.*ThoughtStatus" docs/wiki/acp-chat-core-Types-Reference.md
grep -n "executing" docs/wiki/acp-chat-core-Types-Reference.md
```

### Final Checklist
- [ ] All "Must Have" present:
  - [ ] `ThoughtStatus` type defined
  - [ ] `NormalizedThought.status` field added
  - [ ] `ToolCallStatus` enhanced with new values
  - [ ] Status inference logic implemented
  - [ ] Wiki documentation updated
- [ ] All "Must NOT Have" absent:
  - [ ] No React component changes
  - [ ] No event emission changes
  - [ ] No test additions
  - [ ] No unrelated refactoring
- [ ] TypeScript compiles without errors
- [ ] All files properly exported
- [ ] Wiki documentation accurate and complete
