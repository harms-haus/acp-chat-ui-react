

- [x] 10. React Event Hooks

  **What to do**:
  Create React hooks in `packages/acp-chat-react/src/events/hooks.ts`:
  - `useChatEvent(type)` - Subscribe to specific event type
  - `useThoughtEvents(thoughtId)` - Subscribe to thought lifecycle
  - `useToolCallEvents(toolCallId)` - Subscribe to tool call events
  - `useActiveItems()` - Get currently active thoughts/tools
  - Hooks use `useSyncExternalStore` pattern

  **Must NOT do**:
  - Don't integrate with components yet
  - Don't create context provider yet (Task 11)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: React hooks, observables

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 11)
  - **Blocked By**: Tasks 5-9
  - **Blocks**: Tasks 12, 13, 15

  **Acceptance Criteria**:
  - [ ] useChatEvent hook works with event bus
  - [ ] Hooks unsubscribe on unmount
  - [ ] Tests pass

  **QA Scenarios**:
  ```
  Scenario: Hook receives events
    Tool: Bash (bun test)
    Steps:
      1. Render component with useChatEvent
      2. Emit event from event bus
      3. Assert component received event
    Expected Result: Hook receives and returns event
    Evidence: .sisyphus/evidence/task-10-hooks.log
  ```

  **Commit**: YES
  - Message: `feat(react): add event hooks`
  - Files: `packages/acp-chat-react/src/events/hooks.ts`, test files

- [x] 11. Event Context Provider

  **What to do**:
  Create React context provider in `packages/acp-chat-react/src/events/EventProvider.tsx`:
  - `EventProvider` component
  - `useEventBus()` hook to access event bus
  - Initialize event bus from SessionController

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: React context

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 10)
  - **Blocked By**: Task 2
  - **Blocks**: Tasks 12, 13, 15

  **Acceptance Criteria**:
  - [ ] EventProvider wraps app
  - [ ] useEventBus hook works
  - [ ] Event bus accessible throughout component tree

  **QA Scenarios**:
  ```
  Scenario: Context provides event bus
    Tool: Bash (bun test)
    Steps:
      1. Wrap component with EventProvider
      2. Use useEventBus hook
      3. Assert bus is defined
    Expected Result: Hook returns event bus instance
    Evidence: .sisyphus/evidence/task-11-context.log
  ```

  **Commit**: YES
  - Message: `feat(react): add event context provider`
  - Files: `packages/acp-chat-react/src/events/EventProvider.tsx`

- [x] 12. Update ThoughtStack for Events

  **What to do**:
  Rewrite `packages/acp-chat-react/src/thought/ThoughtStack.tsx`:
  - Use `useActiveItems()` hook to get active state
  - Remove `isActive` prop (use event-based state instead)
  - Update expansion logic based on events
  - Remove `useRef` tracking hacks

  **Must NOT do**:
  - Don't keep old heuristic logic
  - Don't use timeline position for active detection

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: React, complex component refactoring

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Tasks 6, 7, 10, 11
  - **Blocks**: Tasks 14, 15, 19

  **Acceptance Criteria**:
  - [ ] ThoughtStack uses event-based active state
  - [ ] No `isActive` prop passed from parent
  - [ ] Auto-expand works with follow

  **QA Scenarios**:
  ```
  Scenario: Thought stack follows events
    Tool: Playwright
    Steps:
      1. Mount ThoughtStack with follow=true
      2. Emit ThoughtStartedEvent
      3. Assert stack expanded
      4. Emit ThoughtEndedEvent
      5. Assert stack collapsed
    Expected Result: Stack follows event state
    Evidence: .sisyphus/evidence/task-12-thought-stack.png
  ```

  **Commit**: YES
  - Message: `feat(thought): use event-based active state`
  - Files: `packages/acp-chat-react/src/thought/ThoughtStack.tsx`

- [x] 13. Update ThoughtContent/ToolCallContent

  **What to do**:
  Update content components in ThoughtStack:
  - Use event hooks for individual item state
  - Remove `hasEmittedCreated` ref hacks
  - Update expansion based on event state

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: React

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Tasks 6, 7, 10
  - **Blocks**: Task 15

  **Acceptance Criteria**:
  - [ ] Content components use event hooks
  - [ ] No useRef tracking for created state
  - [ ] Proper expand/collapse on event changes

  **Commit**: GROUP with Task 12

- [x] 14. Remove Old isActive Prop

  **What to do**:
  Clean up `isActive` prop usage:
  - Remove from `ThoughtStackProps` in types.ts
  - Remove `isThoughtGroupActive` helper (unused)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: TypeScript, cleanup

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Tasks 12, 13
  - **Blocks**: Task 15

  **Acceptance Criteria**:
  - [ ] isActive prop removed from types
  - [ ] No references to old isActive logic

  **Commit**: YES
  - Message: `refactor(thought): remove isActive prop`
  - Files: `packages/acp-chat-react/src/thought/types.ts`

- [x] 15. Update Thread Integration

  **What to do**:
  Update `packages/acp-chat-react/src/thread/Thread.tsx`:
  - Remove `isActive` computation logic
  - Pass follow prop through to ThoughtStack
  - Use event hooks for any needed state

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: React

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Tasks 8, 10, 12, 14
  - **Blocks**: Task F1-F4

  **Acceptance Criteria**:
  - [ ] Thread no longer computes isActive
  - [ ] Follow prop passed correctly
  - [ ] Thread renders without errors

  **QA Scenarios**:
  ```
  Scenario: Thread renders with events
    Tool: Playwright
    Steps:
      1. Mount Thread with follow=true
      2. Emit various events
      3. Assert thread renders correctly
    Expected Result: Thread works with event system
    Evidence: .sisyphus/evidence/task-15-thread.png
  ```

  **Commit**: YES
  - Message: `feat(thread): integrate event stream`
  - Files: `packages/acp-chat-react/src/thread/Thread.tsx`

- [x] 16. Update ThreadItemRenderer

  **What to do**:
  Update `packages/acp-chat-react/src/thread/ThreadItemRenderer.tsx`:
  - Remove isActive prop passing
  - Pass follow prop to ThoughtStack

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: React

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 15)
  - **Blocked By**: Task 10
  - **Blocks**: Task F1-F4

  **Acceptance Criteria**:
  - [ ] No isActive prop passed
  - [ ] Follow prop passed correctly

  **Commit**: GROUP with Task 15

- [x] 17. Clean Up Old SessionController Events

  **What to do**:
  Remove old event emission from SessionController:
  - Replace sessionUpdate events with event bus
  - Update SessionController to emit to event bus

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: Core logic

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 15, 16)
  - **Blocked By**: Tasks 5-9
  - **Blocks**: Task F1-F4

  **Acceptance Criteria**:
  - [ ] SessionController emits to event bus
  - [ ] Old sessionUpdate events removed
  - [ ] Components still work

  **Commit**: YES
  - Message: `refactor(session): use event bus`
  - Files: `packages/acp-chat-core/src/session/controller.ts`

- [x] 18. Add Event Stream Tests

  **What to do**:
  Create comprehensive tests for event stream:
  - Unit tests for event bus
  - Integration tests for event emission
  - Tests for all 13 event types

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: Testing

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 15-17)
  - **Blocked By**: Tasks 5-9
  - **Blocks**: Task F1-F4

  **Acceptance Criteria**:
  - [ ] All 13 event types have tests
  - [ ] Event bus tests pass
  - [ ] Coverage > 80%

  **QA Scenarios**:
  ```
  Scenario: Event tests pass
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test packages/acp-chat-core/src/events/
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-18-tests.log
  ```

  **Commit**: YES
  - Message: `test(events): add event stream tests`
  - Files: `packages/acp-chat-core/src/events/*.test.ts`

- [x] 19. Update Existing Tests

  **What to do**:
  Update existing tests for compatibility:
  - Update ThoughtStack tests to use events
  - Update Thread tests
  - Fix any broken tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: Testing

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17, 18)
  - **Blocked By**: Tasks 12-16
  - **Blocks**: Task F1-F4

  **Acceptance Criteria**:
  - [ ] All existing tests pass
  - [ ] No test failures

  **QA Scenarios**:
  ```
  Scenario: All tests pass
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-19-all-tests.log
  ```

  **Commit**: YES
  - Message: `test: update existing tests`
  - Files: Various test files

---

## Final Verification Wave

- [x] F1. Plan Compliance Audit (oracle)
  Read plan end-to-end. For each task: verify implementation exists. Check evidence files. Verify all 13 event types implemented. Check ThoughtStack uses events not isActive.
  Output: `VERDICT: APPROVE/REJECT`

- [x] F2. Code Quality Review (unspecified-high)
  Run `tsc --noEmit` + linter + `bun test`. Review for `as any`, empty catches, console.log. Check AI slop patterns.
  Output: Build [PASS/FAIL] | Tests [N pass/N fail] | VERDICT

- [x] F3. Real Manual QA (unspecified-high)
  Start harness app. Test follow feature with actual chat. Verify auto-expand/collapse. Test all event types.
  Output: `Scenarios [N/N pass] | VERDICT`

- [x] F4. Scope Fidelity Check (deep)
  Verify all tasks completed. Check for scope creep. Verify isActive removed. Verify event stream emits all 13 types.
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

Wave 1 (Tasks 1-4): 
- Commit each task individually (foundation work)

Wave 2 (Tasks 5-9):
- Commit each task individually (core emission)

Wave 3 (Tasks 10-14):
- Commit 10, 11 separately
- Commit 12, 13 together (same file)
- Commit 14 separately

Wave 4 (Tasks 15-19):
- Commit 15, 16 together (Thread changes)
- Commit 17 separately
- Commit 18, 19 together (tests)

Final Verification:
- No commits, just verification

---

## Success Criteria

### Verification Commands
```bash
# Type checking
bun tsc --noEmit

# All tests pass
bun test

# Follow feature works
# (Manual QA in harness app)
```

### Final Checklist
- [ ] All 13 event types implemented and emitting
- [ ] NormalizedThought has status field
- [ ] ThoughtStack uses event-based active state
- [ ] isActive prop removed
- [ ] Follow feature auto-expands/collapses correctly
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Visual regression tests pass

---

**Plan saved to**: `.sisyphus/plans/event-stream-follow-plan.md`

**Draft preserved at**: `.sisyphus/drafts/event-stream-follow-draft.md`

To begin execution, run: `/start-work`
