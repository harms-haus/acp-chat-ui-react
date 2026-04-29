# Implementation Notes: ACP Terminals Capability

## User Decisions (2026-04-28)

1. **clientCapabilities scope:** Wire up only `terminal: boolean`. Do not refactor the general `ClientCapabilities` interface for other features.
2. **Transport limitation:** FIX it. Extend Transport interface to support raw JSON-RPC response sending.
3. **Testing strategy:** Test-after (code first, then tests).
4. **Commit strategy:** Single commit at the end.
5. **Git worktree:** No — work on main branch directly.

## Research Findings Summary

- Terminal types already exist in `protocol/types.ts` (from `@agentclientprotocol/sdk`)
- Terminal methods already in `ACPMethod` type union
- FileSystem feature is the exact pattern to follow
- `sendJsonRpcResponse`/`sendJsonRpcErrorResponse` currently broken (console.warn only)
- `initialize()` hardcodes `clientCapabilities: {}` — needs `terminal: boolean` support

## Implementation Log

### CRA Review Iterations

**Round 1:** 0 critical, 1 high, 10 medium, 7 low
- Fixed: DRY violation (extracted handleTerminalRequest helper), input validation (command/cwd/env)
- Fixed: Test coverage (handler rejection, null returns, requestId validation, optional params, sendRawResponse)

**Round 2:** 0 critical, 4 high, 7 medium, 8 low
- Fixed: Missing validation tests (empty command, cwd path traversal, invalid env entries)

**Round 3 (final):** 0 critical, 1 high (style DRY), 5 medium, 9 low
- Remaining findings accepted as future work:
  - DRY style issue: repeated validation pattern for sessionId/terminalId across 4 methods (stylistic)
  - Security edge cases: symlink bypass, encoded paths, args contents, negative outputByteLimit
  - Test gaps: requestId validation for other terminal methods, sessionId in create request
  - Style: magic numbers, type casting, initialize() breaking change (documented, intentional for 0.0.1)

**Group A (parallel):** Task 1 (Types) + Task 3 (Transport Fix)
- Task 1: Created `src/terminals/types.ts` — 10 SDK type re-exports, 5 handler type aliases, TerminalSubscription interface
- Task 3: Added `sendRawResponse()` to Transport interface, updated SessionController to use it, updated MockTransport

**Group B:** Task 2 (Manager)
- Created `src/terminals/subscription-manager.ts` — 5 Map stores, 5 subscribe methods, 5 getHandlers methods

**Group C:** Task 4 (Controller Integration)
- Added terminalManager field, 5 public subscribe methods, 5 dispatch branches in handleAcpPayload, 5 private handler methods
- Updated initialize() to accept clientCapabilities option
- Minor plan deviations: added sessionId to CreateTerminalRequest (SDK requires it), fixed env type cast to Array<{name, value}>

**Group D+E (parallel):** Task 5 (Tests) + Task 6 (Exports)
- Task 5: 7 manager tests + 15 controller integration tests + 2 clientCapabilities tests = 24 new tests total. Updated 10 existing initialize() calls for new signature.
- Task 6: Added terminal type exports + TerminalSubscriptionManager to src/index.ts

### Final Verification
- TypeScript: 0 errors
- Tests: 309 passed (12 test files) — up from 285
- Commit: f080e0b on main
- Pre-commit hooks (eslint + tsc): passed

### Files Changed
- **New:** `src/terminals/types.ts`, `src/terminals/subscription-manager.ts`, `src/__tests__/terminal-subscription.test.ts`
- **Modified:** `src/transport/transport-interface.ts`, `src/session/controller.ts`, `src/test-utils/mocks.ts`, `src/index.ts`, `src/session/session-controller.test.ts`
