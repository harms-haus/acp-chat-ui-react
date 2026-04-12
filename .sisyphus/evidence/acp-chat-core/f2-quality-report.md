# F2 Quality Report - ACP Chat Core

**Date:** April 11, 2026  
**Wave:** FINAL F2 (Second Verification Gate)  
**Package:** @harms-haus/acp-chat-core

---

## Summary

| Metric | Status | Details |
|--------|--------|---------|
| **Build** | ❌ FAIL | 76 TypeScript errors |
| **Lint** | ⚠️ N/A | No linter configured |
| **Tests** | ❌ FAIL | 590 pass / 23 fail (613 total) |
| **Critical Issues** | ⚠️ 3 | Type errors in production tests |

---

## 1. Type Check Results

**Status:** ❌ FAIL

**Total Errors:** 76 TypeScript compilation errors

### Error Breakdown by File:

| File | Error Count | Category |
|------|-------------|----------|
| `src/helpers/thought-stack-logic.test.ts` | 44 | Test file |
| `src/session/session-controller.test.ts` | 3 | Test file |
| `src/test-utils/__tests__/replay-infrastructure.test.ts` | 2 | Test file |
| `src/test-utils/fixture-loader.ts` | 2 | **Production code** |
| `src/test-utils/replay-runner.ts` | 1 | **Production code** |
| `src/bridge/parser.test.ts` | 3 | Test file |
| `src/__tests__/integration/acp-protocol.test.ts` | 1 | Test file |
| `src/__tests__/integration/session-lifecycle.test.ts` | 1 | Test file |

### Production Code Type Errors (4 total):

**1. `src/test-utils/fixture-loader.ts` (2 errors)**
- Line 280: Type 'string | undefined' is not assignable to type 'string'
- Line 292: Type 'string | undefined' is not assignable to type 'string'

**2. `src/test-utils/replay-runner.ts` (1 error)**
- Line 385: Type 'string | undefined' is not assignable to type 'string' (error property in ReplayOutcome)

### Test File Type Errors:

**Major Issues:**
- `thought-stack-logic.test.ts`: 44 errors - mostly "Object is possibly 'undefined'" and type incompatibility with `exactOptionalPropertyTypes: true`
- `session-controller.test.ts`: Type errors with 'ready' vs BridgeStatus, JsonValue incompatibility
- Integration tests: State type mismatches ("connecting" not assignable to "disconnected" | "connected")

---

## 2. Lint Results

**Status:** ⚠️ NOT CONFIGURED

No linter command found in package.json. ESLint or similar tooling not configured for this package.

---

## 3. Test Results

**Status:** ❌ FAIL

```
Test Files:  3 failed | 18 passed (21)
Tests:       23 failed | 590 passed (613)
Pass Rate:   96.2%
```

### Failing Test Files:

| File | Failed | Total | Pass Rate |
|------|--------|-------|-----------|
| `src/__tests__/replay-controller.test.ts` | 7 | 31 | 77% |
| `src/session/session-controller.test.ts` | 6 | 55 | 89% |
| `src/test-utils/__tests__/replay-infrastructure.test.ts` | 10 | 13 | 23% |

### Test Failure Categories:

**1. Replay Infrastructure Tests (10 failures)**
- **Cause:** Missing fixture directory `/fixtures/replay-data/tool-calling/session-1`
- **Impact:** Test infrastructure not properly set up
- **Error:** `Fixture directory not found`

**2. Session Controller Tests (6 failures)**
- Permission request handlers not being called (3 tests)
- Session ID not being updated correctly (1 test)
- Filesystem operation handlers not being called (2 tests)
- Session update handler not emitting (1 test)

**3. Replay Controller Tests (7 failures)**
- Timeout issues: 2 tests timed out at 5000ms
- Permission handlers not being called (1 test)
- Traffic direction incorrect: "in" instead of "out" (1 test)
- Response format issues: jsonrpc property undefined (2 tests)
- Session ID not being set correctly (1 test)

### Notable Issues:

**Timeout Failures:**
- `createSession sets sessionId` - 5000ms timeout
- `sendPrompt sends prompt with correct structure` - 5000ms timeout

**Handler Not Called:**
Multiple tests expect handlers to be called but they never execute, suggesting:
- Event emission not working correctly
- Handler registration failing
- Async timing issues

---

## 4. Code Quality Anti-Patterns

### 4.1 `as any` Usage

**Count:** 71 occurrences

**Location:** ALL in test files (✅ acceptable for tests)

**Breakdown:**
- `src/__tests__/integration/error-handling.test.ts`: 22 occurrences
- `src/__tests__/integration/acp-protocol.test.ts`: 20 occurrences
- `src/__tests__/integration/session-lifecycle.test.ts`: 7 occurrences
- `src/transport/client.test.ts`: 6 occurrences
- `src/session/session-controller.test.ts`: 4 occurrences
- `src/__tests__/replay-controller.test.ts`: 4 occurrences
- `src/__tests__/test-utils.test.ts`: 3 occurrences
- `src/__tests__/integration/capture-replay-flow.test.ts`: 1 occurrence
- `src/__tests__/capture-interceptor.test.ts`: 1 occurrence
- `src/test-utils/factories.ts`: 2 occurrences

**Assessment:** ✅ ACCEPTABLE - All usages are in test files for mocking and type coercion in test scenarios.

### 4.2 `@ts-ignore` Usage

**Count:** 0 occurrences in production code
**Found:** 3 unused `@ts-expect-error` directives in `src/bridge/parser.test.ts` (test file)

**Assessment:** ✅ CLEAN - No `@ts-ignore` in production code.

### 4.3 `console.log` Usage

**Count:** 2 occurrences

**Location:** Test file only
- `src/test-utils/__tests__/replay-infrastructure.test.ts`: Lines 212, 224

**Assessment:** ✅ ACCEPTABLE - Debug logging only in test files for error reporting.

### 4.4 Empty Catch Blocks

**Count:** 0

**Assessment:** ✅ CLEAN - No empty catch blocks found in production code.

### 4.5 Unused Imports

**Assessment:** Not detected by type check (TypeScript would error on unused imports with strict config). No obvious dead code patterns found.

---

## 5. Critical Issues Summary

### 🔴 High Priority (Blocking)

1. **Type errors in production code (4 errors)**
   - `fixture-loader.ts`: 2 type mismatches with undefined
   - `replay-runner.ts`: 1 type mismatch with undefined
   - **Action Required:** Fix type definitions or add proper null checks

2. **Test failures (23 tests)**
   - Missing fixture data for replay tests
   - Handler registration/emission issues in session controller
   - Timeout issues in replay controller
   - **Action Required:** Investigate and fix failing tests

### 🟡 Medium Priority

3. **Unused `@ts-expect-error` directives (3 occurrences)**
   - Location: `src/bridge/parser.test.ts` (lines 79, 93, 107)
   - **Action Required:** Remove unused directives

4. **Extensive `as any` in tests (71 occurrences)**
   - While acceptable in tests, high count suggests potential type coverage gaps
   - **Action Required:** Consider improving type safety in test utilities

### 🟢 Low Priority

5. **No linter configured**
   - **Recommendation:** Add ESLint with React/TypeScript rules

---

## 6. Recommendations

### Immediate Actions (Before Merge)

1. ✅ Fix 4 type errors in production code (`fixture-loader.ts`, `replay-runner.ts`)
2. ✅ Remove 3 unused `@ts-expect-error` directives from parser tests
3. ✅ Investigate 23 failing tests - prioritize:
   - Timeout failures (indicate real bugs or performance issues)
   - Handler not called failures (event system issues)
   - Missing fixtures (test infrastructure setup)

### Follow-up Actions

4. ⏳ Consider adding ESLint configuration
5. ⏳ Reduce `as any` usage in tests by improving test utility types
6. ⏳ Add fixture data for replay infrastructure tests
7. ⏳ Investigate strict `exactOptionalPropertyTypes` issues in tests

---

## 7. Evidence Files

- Type check output: See bash command output above
- Test output: Full vitest run output captured
- Anti-pattern searches: grep results for `as any`, `@ts-ignore`, `console.log`, empty catch blocks

---

**Report Generated:** April 11, 2026  
**Verification Gate:** FINAL F2  
**Status:** ❌ REQUIRES FIXES BEFORE PROCEEDING
