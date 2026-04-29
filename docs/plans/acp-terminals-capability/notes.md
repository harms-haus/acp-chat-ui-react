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

### Execution (2026-04-28)

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
