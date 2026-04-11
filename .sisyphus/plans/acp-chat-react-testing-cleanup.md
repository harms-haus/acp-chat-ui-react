# Plan: ACP Chat React - Testing & Cleanup

## TL;DR

> **Comprehensive cleanup and testing overhaul for the React UI library.**
>
> **Deliverables:**
> - Dead code removed (`/src/client/` directory - 228 lines)
> - Event hook tests completed (currently TODO)
> - Comprehensive component tests (15+ test files)
> - Hook testing documentation
> - Component testing patterns
> - 80%+ test coverage for public API
> - `pnpm test-react` command working with coverage
>
> **Estimated Effort:** Large (35-40 tasks across 5 waves)
> **Parallel Execution:** YES - 5-7 tasks per wave
> **Critical Path:** Cleanup → Unit Tests → Hook Tests → Integration Tests → Documentation

---

## Context

### Current State Analysis

**Package:** `@harms-haus/acp-chat-react`  
**Location:** `/packages/acp-chat-react`  
**Version:** 0.0.1  
**Size:** 78 source files, 13 test files

**Existing Test Files (13):**
1. `src/store/react-store-adapter.test.ts` - 526 lines - Comprehensive store tests
2. `src/composer/composer-flow.test.tsx` - 498 lines - Composer interaction tests
3. `src/thread/virtualized-thread.test.tsx` - 289 lines - Thread virtualization tests
4. `src/message/message-rendering.test.tsx` - 243 lines - Message display tests
5. `src/settings/settings.test.tsx` - 342 lines - Settings panel tests
6. `src/events/hooks.test.ts` - 442 lines - **Contains TODO for real tests**
7. `src/smoke/ssr.test.tsx` - SSR compatibility tests
8. `src/smoke/basic-exports.test.ts` - Basic export tests
9. `src/slash/slash-and-actions.test.tsx` - Slash command tests
10. Plus 4 more test files

**Critical Issues Found:**
1. **Dead code:** `/src/client/` directory is NOT exported from package.json (228 lines unused)
2. **Incomplete tests:** Event hooks test file contains TODO comments for real renderHook tests
3. **Missing component tests:** Some components may lack comprehensive coverage
4. **Test pattern inconsistency:** Some tests use different patterns

**Architecture:**
- **Entry Points:** 2 (SSR-safe `index.ts`, browser-only `index.browser.ts`)
- **Components:** 18 feature directories
- **Hooks:** 15 React hooks for data access
- **Styling:** CSS variable-based with inline fallbacks

### Component Inventory

**Core Components:**
- `Composer` - Input with slash commands, auto-expanding textarea
- `VirtualizedThread` - Virtual scrolling message list
- `MessageCard` - Message display with content rendering
- `SettingsPanel` - Configuration panel
- `SessionList` - Session management UI

**Content Renderers:**
- `ContentRenderer` - Dispatches to type-specific renderers
- `TextContent` - Markdown rendering
- `ResourceContent` - Resource block display
- `ResourceLinkContent` - Resource link display

**Specialized Components:**
- `ThoughtGroup` - Thought display
- `ToolCallItem` - Tool call display
- `PermissionRequest` - Permission UI
- `UpdateIndicator` - Status indicators

### Hook Inventory (15 hooks)

**Data Access Hooks:**
- `useMessages()`, `useMessage()`, `useMessageByTurnId()`
- `useThoughts()`, `useToolCalls()`, `useToolCall()`
- `useTimeline()`, `useTimelineItems()`
- `usePermissionRequests()`, `usePendingPermissionRequests()`

**Session State Hooks:**
- `useSessionState()`, `useIsConnected()`, `useIsInitialized()`
- `useSessionId()`, `useStoreVersion()`

**Utility Hooks:**
- `useSnapshotSelector()`, `useMessagesCount()`, `useThoughtsCount()`
- `useToolCallsCount()`, `useActiveStreamingMessage()`
- `useTextHeight()`, `usePermissionResponse()`

**Event Hooks:**
- `useChatEvent()`, `useThoughtEvents()`, `useToolCallEvents()`

---

## Work Objectives

### Core Objective
Transform acp-chat-react from a library with "good test coverage but dead code and incomplete tests" to a production-grade React library with 80%+ test coverage, clean codebase, comprehensive documentation, and established testing patterns for future development.

### Concrete Deliverables

**Cleanup:**
- [ ] Remove dead `/src/client/` directory (228 lines)
- [ ] Audit for any other dead code
- [ ] Verify all exports are used
- [ ] Clean up any TODO comments that should be addressed

**Unit Tests:**
- [ ] Complete event hooks tests (currently TODO)
- [ ] Add missing component tests
- [ ] Add hook unit tests (where not covered by component tests)
- [ ] Add utility function tests
- [ ] Ensure 80%+ coverage for all public hooks and components

**Integration Tests:**
- [ ] Component interaction tests
- [ ] Store integration tests
- [ ] Event system integration tests
- [ ] Slash command flow tests

**Documentation:**
- [ ] React component testing guide
- [ ] Hook testing patterns
- [ ] Test fixture usage
- [ ] Mocking strategies for ACP core
- [ ] Coverage guide

### Definition of Done
- [ ] `pnpm test-react` runs successfully with all tests passing
- [ ] Coverage report shows 80%+ for lines, 75%+ for branches
- [ ] Dead code removed (verified by audit)
- [ ] All new tests include agent-executed QA scenarios
- [ ] Documentation complete and accurate
- [ ] No regression in existing functionality
- [ ] SSR compatibility maintained

### Must Have (Non-Negotiable)
- 80%+ test coverage for public API (hooks and components)
- All existing tests must pass
- Dead code removed
- Event hooks tests completed (no more TODO)
- Comprehensive documentation
- Both entry points (SSR and browser) tested

### Must NOT Have (Explicit Exclusions)
- No Playwright/E2E tests (out of scope)
- No CI/CD setup (out of scope)
- No harness UI testing (out of scope)
- No cross-library shared test code (per requirements)
- No visual regression tests (out of scope)
- No breaking API changes

---

## Verification Strategy

### Testing Framework Decision
- **Framework:** Vitest 2.1.0 (already configured)
- **Environment:** jsdom (for DOM testing)
- **Coverage:** v8 provider
- **React Testing:** React Testing Library + @testing-library/jest-dom
- **Hook Testing:** renderHook from @testing-library/react

### Test Commands
```bash
# Run all tests
pnpm test-react

# Run with coverage
pnpm test-react:coverage

# Run specific test file
pnpm vitest run packages/acp-chat-react/src/store/react-store-adapter.test.ts

# Watch mode for development
pnpm vitest --filter=acp-chat-react
```

### QA Policy
Every task MUST include agent-executed QA scenarios:

- **Component tests:** Render component, interact, assert DOM
- **Hook tests:** renderHook, assert return values and side effects
- **Integration tests:** Full component tree with store
- **Coverage:** Generate and verify coverage reports
- **SSR tests:** Verify server-side rendering works

**Evidence:** All test results, coverage reports saved to `.sisyphus/evidence/acp-chat-react/`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Cleanup):
├── Task 1: Remove dead /src/client/ directory
├── Task 2: Audit and remove any other dead code
├── Task 3: Fix any critical TODOs in test files
├── Task 4: Set up coverage collection with thresholds
└── Task 5: Update test utilities if needed

Wave 2 (Hook Tests - MAX PARALLEL):
├── Task 6: Complete useChatEvent hook tests
├── Task 7: Complete useThoughtEvents hook tests
├── Task 8: Complete useToolCallEvents hook tests
├── Task 9: Add useSettings hook tests
├── Task 10: Add useMessages and data hooks tests
└── Task 11: Add useSessionState hooks tests

Wave 3 (Component Tests):
├── Task 12: ContentRenderer component tests
├── Task 13: ThoughtGroup component tests
├── Task 14: ToolCallItem component tests
├── Task 15: SessionList component tests
├── Task 16: PermissionRequest component tests
└── Task 17: Slash command component tests

Wave 4 (Integration & Utilities):
├── Task 18: Composer integration tests
├── Task 19: Thread integration tests
├── Task 20: Settings integration tests
├── Task 21: Message integration tests
├── Task 22: Store integration tests
└── Task 23: Utility function tests

Wave 5 (Documentation & Finalization):
├── Task 24: Write React component testing guide
├── Task 25: Write hook testing patterns doc
├── Task 26: Write mocking strategies doc
├── Task 27: Write test fixture usage doc
├── Task 28: Write coverage guide
└── Task 29: Update package.json scripts

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Coverage verification (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix

- **1-5**: No dependencies (can run in parallel)
- **6-11**: Depends on 5 (test utilities)
- **12-17**: Depends on 5
- **18-23**: Depends on 6-17 (hooks and components tested)
- **24-29**: Depends on 6-23 (tests complete)
- **F1-F4**: Depends on ALL tasks 1-29

### Agent Dispatch Summary

- **Wave 1**: 5 tasks → `quick` (cleanup, config)
- **Wave 2**: 6 tasks → `deep` (complex hook logic)
- **Wave 3**: 6 tasks → `visual-engineering` (React components)
- **Wave 4**: 6 tasks → `deep` (integration complexity)
- **Wave 5**: 6 tasks → `writing` (documentation)
- **Wave FINAL**: 4 tasks → `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

### Wave 1: Foundation - Cleanup

- [ ] **1. Remove dead /src/client/ directory**

  **What to do:**
  - Delete `/packages/acp-chat-react/src/client/` directory entirely
  - This directory is NOT exported from package.json
  - Contains 228 lines of unused code
  - Built to dist/client/ but inaccessible to consumers

  **Files to delete:**
  - `packages/acp-chat-react/src/client/index.ts`
  - `packages/acp-chat-react/src/client/` (entire directory)

  **Must NOT do:**
  - Don't just comment out - delete entirely
  - Don't remove if it's actually used somewhere (verify first)

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - `packages/acp-chat-react/src/client/index.ts` - Content to verify unused
  - `packages/acp-chat-react/package.json` - Exports (shows it's not exported)

  **Acceptance Criteria:**
  - [ ] `/src/client/` directory removed
  - [ ] Build still succeeds
  - [ ] Tests still pass
  - [ ] No references to `/client` in codebase (except git history)

  **QA Scenarios:**
  ```
  Scenario: Verify client directory removed
    Tool: Bash
    Steps:
      1. Run: ls packages/acp-chat-react/src/client/ 2>&1
      2. Run: grep -r "from.*client" packages/acp-chat-react/src/ --include="*.ts" --include="*.tsx"
    Expected Result: Directory doesn't exist, no references found
    Evidence: .sisyphus/evidence/task-1-client-removed.txt
  ```

  **Commit:** YES
  - Message: `refactor(react): remove unused /client directory`
  - Files: Deletion of `packages/acp-chat-react/src/client/`

- [ ] **2. Audit and remove any other dead code**

  **What to do:**
  - Run static analysis to find unused exports
  - Check for any deprecated code
  - Look for TODO/FIXME comments that indicate dead code
  - Verify all exports from index.ts are used

  **Files to examine:**
  - `src/index.ts` - All public exports
  - `src/index.browser.ts` - Browser exports
  - All source files for unused functions

  **Must NOT do:**
  - Don't remove public API without careful consideration
  - Don't break existing functionality

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - All source files

  **Acceptance Criteria:**
  - [ ] Document any dead code found
  - [ ] If removed, commit with clear message
  - [ ] No breaking changes to public API

  **QA Scenarios:**
  ```
  Scenario: Audit for dead code
    Tool: Bash (grep)
    Steps:
      1. Run: grep -r "@deprecated" packages/acp-chat-react/src/ --include="*.ts" --include="*.tsx"
      2. Run: grep -r "TODO.*remove" packages/acp-chat-react/src/ --include="*.ts" --include="*.tsx"
    Expected Result: Lists any deprecated/TODO items found
    Evidence: .sisyphus/evidence/task-2-dead-code-audit.txt
  ```

  **Commit:** YES (if code removed)
  - Message: `refactor(react): remove dead code [describe what was removed]`
  - Files: Any files with dead code

- [ ] **3. Fix any critical TODOs in test files**

  **What to do:**
  - Review TODO comments in test files
  - Address critical TODOs (especially in hooks.test.ts)
  - Document which TODOs are left for future work

  **Files to examine:**
  - All test files for TODO comments

  **Must NOT do:**
  - Don't try to fix every TODO - some may be future work
  - Focus on critical gaps

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **Acceptance Criteria:**
  - [ ] Critical TODOs addressed or documented
  - [ ] No blocking TODOs remaining

  **QA Scenarios:**
  ```
  Scenario: Review TODOs in tests
    Tool: Bash (grep)
    Steps:
      1. Run: grep -r "TODO" packages/acp-chat-react/src/**/*.test.ts --include="*.test.ts" --include="*.test.tsx"
    Expected Result: Lists remaining TODOs with explanations
    Evidence: .sisyphus/evidence/task-3-todos-reviewed.txt
  ```

  **Commit:** YES (if TODOs addressed)
  - Message: `chore(react): address critical TODOs in test files`
  - Files: Modified test files

- [ ] **4. Set up coverage collection with thresholds**

  **What to do:**
  - Add coverage configuration to vitest.config.ts
  - Set thresholds: 80% lines, 75% branches
  - Configure reporters: text, json, html, lcov
  - Ensure coverage works with React/jsdom environment

  **Files to modify:**
  - `packages/acp-chat-react/vitest.config.ts`

  **Must NOT do:**
  - Don't use istanbul provider (slower than v8)

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **References:**
  - Current vitest.config.ts

  **Acceptance Criteria:**
  - [ ] `pnpm vitest run --coverage` generates coverage report
  - [ ] HTML report generated
  - [ ] Thresholds configured

  **QA Scenarios:**
  ```
  Scenario: Verify coverage collection
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run --coverage packages/acp-chat-react
      2. Check: ls packages/acp-chat-react/coverage/
    Expected Result: Coverage report generated
    Evidence: .sisyphus/evidence/task-4-coverage.txt
  ```

  **Commit:** YES
  - Message: `chore(react): add coverage configuration`
  - Files: `packages/acp-chat-react/vitest.config.ts`

- [ ] **5. Update test utilities if needed**

  **What to do:**
  - Review existing test utilities
  - Add any missing helpers for React testing
  - Ensure custom render with providers is available
  - Add ACP store mocking utilities

  **Files to create/modify:**
  - `packages/acp-chat-react/src/test-utils/` (if doesn't exist)

  **Must NOT do:**
  - Don't export test utilities from main index

  **Recommended Agent Profile:**
  - **Category:** `quick`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES
  - **Parallel Group:** Wave 1
  - **Blocked By:** None

  **Acceptance Criteria:**
  - [ ] Test utilities available
  - [ ] Custom render with providers works
  - [ ] Store mocking utilities available

  **QA Scenarios:**
  ```
  Scenario: Verify test utilities
    Tool: Bash
    Steps:
      1. Check test-utils directory exists
      2. Verify can import from test files
    Expected Result: Utilities working
    Evidence: .sisyphus/evidence/task-5-test-utils.txt
  ```

  **Commit:** YES
  - Message: `feat(react): add test utilities`
  - Files: `packages/acp-chat-react/src/test-utils/`

### Wave 2: Hook Tests

- [ ] **6. Complete useChatEvent hook tests**

  **What to do:**
  - Replace TODO comments with real renderHook tests
  - Test event subscription
  - Test event callback invocation
  - Test cleanup on unmount
  - Test multiple event types

  **Files to modify:**
  - `packages/acp-chat-react/src/events/hooks.test.ts`

  **Must NOT do:**
  - Don't test implementation details
  - Focus on behavior

  **Recommended Agent Profile:**
  - **Category:** `deep`
  - **Skills:** None needed

  **Parallelization:**
  - **Can Run In Parallel:** YES (with 7-11)
  - **Parallel Group:** Wave 2
  - **Blocked By:** Task 5

  **References:**
  - `src/events/hooks.ts` - Implementation
  - `src/events/hooks.test.ts` - Existing tests with TODOs
  - React Testing Library hook testing docs

  **Acceptance Criteria:**
  - [ ] All TODOs replaced with real tests
  - [ ] Event subscription tested
  - [ ] Cleanup tested
  - [ ] Coverage >= 80% for hooks.ts

  **QA Scenarios:**
  ```
  Scenario: Run event hook tests
    Tool: Bash
    Steps:
      1. Run: pnpm vitest run packages/acp-chat-react/src/events/hooks.test.ts
    Expected Result: All tests pass, no TODOs
    Evidence: .sisyphus/evidence/task-6-event-hooks.txt
  ```

  **Commit:** YES
  - Message: `test(react): complete event hook tests`
  - Files: `packages/acp-chat-react/src/events/hooks.test.ts`

### Wave FINAL: Verification

- [ ] **F1. Plan compliance audit (oracle)**

  Verify all requirements met, deliverables present.

  **Recommended Agent Profile:** `oracle`

  **Evidence:** `.sisyphus/evidence/acp-chat-react/f1-compliance.md`

- [ ] **F2. Code quality review (unspecified-high)**

  Type check, tests, lint.

  **Recommended Agent Profile:** `unspecified-high`

  **Evidence:** `.sisyphus/evidence/acp-chat-react/f2-quality.md`

- [ ] **F3. Coverage verification (unspecified-high)**

  Verify 80%+ coverage.

  **Recommended Agent Profile:** `unspecified-high`

  **Evidence:** `.sisyphus/evidence/acp-chat-react/f3-coverage.md`

- [ ] **F4. Scope fidelity check (deep)**

  Verify no scope creep.

  **Recommended Agent Profile:** `deep`

  **Evidence:** `.sisyphus/evidence/acp-chat-react/f4-fidelity.md`

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
pnpm test-react

# Coverage meets thresholds
pnpm test-react:coverage
# Expected: >= 80% lines, >= 75% branches

# Type check passes
cd packages/acp-chat-react && pnpm check

# Dead code removed
ls packages/acp-chat-react/src/client/ 2>&1
# Expected: No such file or directory
```

### Final Checklist
- [ ] All 29 tasks complete
- [ ] F1-F4 verification passed
- [ ] User approval received
- [ ] Coverage >= 80% lines, >= 75% branches
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Dead code removed
- [ ] pnpm test-react works from root

---

## Notes

### Related Plans
- See `acp-chat-core-testing-cleanup.md` for core package plan
- See `acp-ws-bridge-testing-cleanup.md` for bridge plan
