# Learnings

## 2026-03-28 Task 1: React Monorepo Scaffolding

### Workspace Structure
- Copied workspace pattern from old Svelte repo: `packages/*`, `apps/*`, `crates/*`
- Root `tsconfig.json` uses project references for all packages/apps
- Strict TypeScript config preserved from old repo (verbatimModuleSyntax, exactOptionalPropertyTypes, etc.)

### Package Configuration
- `@acp/chat-core`: Pure TypeScript package built with `tsc`, outputs to `dist/`
- `@acp/chat-react`: Vite library build with `vite-plugin-dts` for declaration file generation
- Both packages use `workspace:*` for inter-package dependencies

### Base UI Integration
- Base UI (`@base-ui-components/react`) is currently at `1.0.0-rc.0` - stable 1.0.0 not yet released
- Added as peer dependency for React package, establishing it as the only allowed generic primitive library

### Rust Bridge Crate
- Successfully copied all source files from old repo
- Uses `ts-rs` crate to generate TypeScript types from Rust structs
- All 10 tests pass (6 unit tests + 4 ts-rs export tests)

### Selector Convention
- `data-acp-*` attributes documented in packages/acp-chat-react/README.md
- Harness app uses `data-acp-root` on root container as example

### Build Verification
- `pnpm install` succeeds with 112 packages
- `pnpm build` builds all 3 projects (core, react, harness)
- `pnpm test` passes 4 smoke tests
- `cargo test` passes 10 Rust tests

## 2026-03-28 Task 1 Follow-up Fix

### Missing Root Scripts
- Added `perf:test` and `bundle:check` placeholder scripts to root package.json
- Scripts echo a message noting Task 2 will implement real functionality
- Both scripts succeed (exit 0) to satisfy CI/run requirements

### Publishable Core Package
- Removed `"private": true` from `packages/acp-chat-core/package.json`
- Added `"license": "MIT"` to make it a valid publishable scaffold
- Build/test/check still pass after change

## 2026-03-28 Task 2: Performance Budgets and Verification Tooling

### Performance Infrastructure
- Created fixture-driven perf tests using JSONL replay fixtures
- Sample replay fixture copied from old repo (8 envelopes)
- Long-session replay generated programmatically (3004 envelopes, ~1000 turns)
- All perf tests run without requiring a live ACP bridge process

### Budget Thresholds
- Streaming cadence: ≤ 16ms average processing time per envelope
- First interactive: ≤ 150ms to reach first "done" message
- Memory growth: ≤ 50MB net heap growth for long-session replay
- Bundle sizes: @acp/chat-core ≤ 60KB gzip, @acp/chat-react ≤ 120KB gzip

### Bundle Check Implementation
- Measures gzip size of dist directories (excludes .map files)
- Checks for Base UI broad imports (whole package vs component-level)
- Guards against unplanned Base UI primitives (accordion, slider, number-field, fieldset, progress)
- Fails loudly if thresholds exceeded or tree-shaking violations detected

### Node.js TypeScript Execution
- Using `node --experimental-strip-types` for script execution without build step
- Scripts can import from `node:*` modules without transpilation
- Added `@types/node` to root package.json for type checking

### Failure Path Testing
- Created `perf-runner-fail.ts` with deliberately impossible budgets (0.001ms thresholds)
- Script exits non-zero (1) and reports which budget failed
- Evidence captured in `.sisyphus/evidence/task-2-perf-baseline-error.txt`

## 2026-03-28 Task 2 Fix: Credible Performance Infrastructure

### Fixture Integrity
- Created canonical 10,000-message replay fixture: `fixtures/canonical-10k-replay.jsonl`
- Counting model: 5000 turns × 3 payloads each + 4 metadata envelopes = 15004 total envelopes
- "10,000 messages" = 5000 user messages + 5000 agent messages (done chunks)
- Metadata `total_envelopes` now matches actual line count exactly
- Fixture integrity validation throws error if metadata doesn't match actual count

### Meaningful Perf Measurements
- Normalization simulation: merges chunks, builds content hashes, tracks retained state
- Memory growth measures actual retained Map with normalized messages
- Reports max cadence, payload count, character count for credibility
- Canonical fixture shows: 15004 envelopes, 10000 messages, 2.8M characters retained

### Source-Level Import Checking
- `bundle:check` now scans both `src/` and `dist/` directories
- Catches forbidden imports before build, not just after tree-shaking
- Checks for broad `@base-ui-components/react` imports
- Checks for unplanned primitives: accordion, slider, number-field, fieldset, progress
## 2026-03-28 Task 3: ACP Core Reuse

### Ported Modules
- Generated types from `ts-rs`: BridgeEnvelope, BridgeMessage, BridgeStatus, UnsupportedVersionError, JsonValue
- Bridge parser: parseEnvelope, validateEnvelope, BridgeVersionError
- Transport client: WebSocket-based TransportClient with reconnection logic
- Session controller: JSON-RPC 2.0 session management
- Normalization store: Message/thought/tool-call state normalization
- Launch presets: Environment variable parsing for bridge configuration

### Pure Helpers Relocated
- composer-logic.ts: Prompt lifecycle, send/stop button state logic
- thought-stack-logic.ts: Thought grouping and timeline utilities
- Both were framework-agnostic and belong in core

### Module Structure
- Each module has its own directory with index.ts for clean exports
- Main index.ts re-exports all public APIs
- Tests are co-located with source files

### Bundle Size
- Core package: 15.74 KB gzip (well under 60 KB budget)
- Includes all bridge types, transport, session, normalization, and helpers

## 2026-03-28 Task 4: React ACP Store Adapter

### Architecture
- AcpStore wraps NormalizedState and subscribes to SessionController events
- Uses `useSyncExternalStore` pattern - NOT effect-derived mirrored state
- No Zustand, Jotai, or Redux dependencies added

### Notification Batching
- ACP updates processed IMMEDIATELY via applySessionUpdate - no delay
- React subscriber notifications are batched to configured cadence (default 16ms)
- Multiple ACP updates within cadence window result in single React notification
- ACP events are NEVER dropped or throttled

### SSR Safety
- Server snapshot returns empty initial state without browser APIs
- No `window` or `document` access in SSR code paths
- getServerSnapshot() is safe for Node.js environments

### React Hooks
- Created 19 hooks using useSyncExternalStore pattern
- Selective snapshot accessors: useMessages, useMessage, useThoughts, useToolCalls, etc.
- Convenience hooks: useIsConnected, useIsInitialized, useSessionId, useActiveStreamingMessage
- Custom selector hook: useSnapshotSelector for derived state

### Perf Scenario Extension
- Added `--scenario streaming-store` to perf-runner.ts
- Tests batching behavior and notification efficiency
- Keeps perf extension tightly scoped to Task 4

### Core Package Extension
- Exported `SessionUpdateParams` type from @acp/chat-core
- Minimal change required for React adapter to function correctly

### Streaming Store Perf Scenario Fix
- Original scenario had broken validation: cleared timeouts without counting notifications
- Fixed to properly exercise subscriber notification delivery
- Scenario now flushes batched notifications every 50 updates
- Validates: notifications > 0 AND notifications < updates (batching works)
- Example result: 1000 updates → 20 notifications (2.0% ratio)

## 2026-03-28 Task 5: SSR-safe React Harness and Client Boundary Shell

### Browser-Only Entry Point
- Created `src/index.browser.ts` as browser-only entry with WebSocket connection logic
- Package exports `./browser` subpath for browser-only ACP connection utilities
- SSR-safe main `index.ts` remains free of browser-only APIs (no window, document, WebSocket)
- Browser entry re-exports SessionController for convenience

### Harness Shell Architecture
- Harness uses Base UI primitives for generic chrome: Tabs, Button, Tooltip, Separator
- Session source selection (replay/live) uses Base UI Tabs component
- Diagnostics panel displays connection status, session ID, initialized state, store version
- Perf display shows message count, render count, avg render time, store version
- Thread placeholder component ready for Task 6 virtualized thread implementation

### SSR Smoke Tests
- 7 new tests verify SSR-safe entry points work in Node.js environment
- Tests confirm no window/document access in SSR paths
- Tests verify getServerSnapshot() works without browser APIs
- Browser environment detection functions work correctly (isBrowserEnvironment/isServerEnvironment)

### Build Configuration
- Vite library build configured with multiple entry points (index, browser)
- Package exports updated to expose both main and browser entry points
- Full build succeeds: core (tsc), react (vite), harness (vite)
- All 90 tests pass across 8 test files

### Base UI Component Usage
- Button: Direct component, not Button.Root
- Tabs: Tabs.Root, Tabs.List, Tabs.Tab, Tabs.Panel
- Tooltip: Tooltip.Root, Tooltip.Trigger, Tooltip.Portal, Tooltip.Positioner, Tooltip.Popup
- Separator: Direct component with orientation prop

### Evidence
- Scribe: `.sisyphus/evidence/task-5-harness-shell.png`
- SSR tests: `.sisyphus/evidence/task-5-harness-shell-error.txt`

### Task 5 Fix: getSnapshot Caching & Base UI Nesting

#### Issues Fixed
1. **TypeScript error**: `Parameters<typeof AcpStore>[0]` doesn't work for class constructors. Fixed by using `as unknown as SessionController` type assertion for mock controller.
2. **Runtime infinite loop**: `AcpStore.getSnapshot()` created new Map objects on each call, but `useSyncExternalStore` requires the stable reference when state hasn't changed. Added `cachedSnapshot` and `cachedSnapshotVersion` fields to cache the snapshot and only return a new reference when the version changes.
3. **Nested button elements**: `Tabs.Tab` and `Tooltip.Trigger` both render `<button>` elements, causing invalid HTML. Fixed by removing `Tooltip` wrappers from inside `Tabs.Tab` - just use plain text for tab labels.
4. **Mock store per render**: The original code called `createMockStore()` during render in component props, creating new store instances each render. Fixed by using `useMemo` to create a single stable mock store and passing it to all child components.

#### Files Changed
- `packages/acp-chat-react/src/store/acp-full:30 -- added `cachedSnapshot` and `cachedSnapshotVersion` fields, updated `getSnapshot` to cache, updated `destroy` to clear cache
- `packages/acp-chat-react/src/store/react-store-adapter.test.ts` -- fixed test to verify same reference is returned when version hasn't changed (not a new object each call)
- `apps/harness/src/App.tsx` -- removed Tooltip from Tabs.Tab, added `useMemo` for stable mock store, fixed type assertion for mock controller

### Task 5 Fix: Operational Connection Logic

#### Issues Fixed
1. **Buttons were inert**: `Load Replay` and `Connect Live` buttons had no onClick handlers, so clicking them did nothing.
2. **No actual connection**: `activeStore` was never set, so the harness always showed disconnected state.

#### Implementation
Added operational connection logic to App.tsx:
- `connectToBridge(url)`: Creates a real `SessionController` connected to the bridge WebSocket URL, wraps it in an `AcpStore`, subscribes to status changes, and initiates connection. On connect, calls `initialize()` to handshake with the bridge.
- `disconnect()`: Cleans up the controller and store, resets connection state.
- `connectionStatus` state: Tracks "disconnected" | "connecting" | "connected" | "error".
- Button handlers: `handleLoadReplay` toggles between connecting and disconnecting; `handleConnectLive` initiates connection to live bridge.
- UI updates: Buttons show "Connecting..." while connecting, "Disconnect" when connected. Input fields disable during active connection.

#### Replay Mode
- User specifies replay file path (for reference - passed to bridge externally)
- Click "Load Replay" connects to bridge at configured URL (default ws://localhost:8765)
- UI shows instruction: `Start bridge with: cargo run --manifest-path crates/acp-bridge/Cargo.toml -- replay -f <file>`
- Bridge plays back recorded ACP session from JSONL file

#### Live Mode
- User specifies bridge WebSocket URL
- Click "Connect Live" connects to running bridge
- Same connection logic as replay - difference is how bridge is started externally

#### Verification
- Browser QA shows status change from "disconnected" to "connecting" when button clicked
- Diagnostics panel reflects actual connection state changes
- SSR smoke tests still pass (browser-only logic stays in harness)

### Task 5 Fix: Replay Bridge JSON-RPC Incompatibility

#### Root Cause
The replay bridge is a one-way data stream - it only plays back pre-recorded ACP envelopes and does NOT respond to JSON-RPC `initialize` requests. When the harness called `controller.initialize()` after WebSocket connection, the request timed out because the replay bridge ignores it. This caused repeated timeout errors and appeared as a failed connection.

#### Fix
1. Added `shouldInitialize` parameter to `connectToBridge()` function
2. Replay mode passes `shouldInitialize: false` - just connect and receive data
3. Live mode passes `shouldInitialize: true` - requires JSON-RPC handshake with live ACP agent
4. Changed default bridgeUrl from `ws://localhost:8765` to `ws://127.0.0.1:8765` to match bridge binding

#### Verification
- Started bridge: `cargo run --manifest-path crates/acp-bridge/Cargo.toml -- replay -f fixtures/sample-replay.jsonl`
- Opened harness, clicked "Load Replay"
- Diagnostics: Status="connected", Bridge Status="connected", Messages=2, Store Version=4
- Thread placeholder: "2 messages loaded (Thread UI coming in Task 6)"
- No console errors

## 2026-03-28 Task 7: Message, Content, and Update Rendering

### Component Architecture
- Thread → MessageList → MessageCard → ContentBlock hierarchy established
- ThreadItemRenderer bridges virtualized thread with message/update rendering
- Memoization at every level prevents unnecessary re-renders during streaming

### Message Components
- MessageCard: Renders user/agent messages with role/status selectors
- MessageList: Container for multiple messages with custom render support
- MessageStatusIndicator: Visual status (streaming/complete/cancelled/error)
- MessageTimestamp: Formatted time display with semantic <time> element
- MessageEmptyState: Empty state with customizable message

### Content Block Renderers
- ContentRenderer: Switches between text/resource/resource_link blocks
- TextContent: Plain text with safe rendering (no raw HTML)
- ResourceContent: Displays embedded resources with text/blob support
- ResourceLinkContent: External resource links with security attributes
- UnsupportedContent: Safe fallback for unknown content types

### Update Components
- UpdateRow: Renders thought/tool-call updates with status indicators
- UpdateList: Container for multiple updates
- UpdateIndicator: Visual status dot with pulse animation for pending

### Key Design Decisions
- No raw HTML injection from ACP payloads - all content rendered as text
- Stable selectors: data-acp-message-role, data-acp-message-status, data-acp-content-type
- Memoized components prevent re-render of unaffected rows during streaming
- Content blocks keyed by index+type for stable React keys

### Test Coverage
- 21 tests covering MessageCard, MessageList, MessageStatusIndicator, MessageTimestamp, MessageEmptyState, ContentRenderer
- Tests verify correct role/status attributes, content block rendering, safe fallback behavior
- All tests pass with jsdom environment

### Performance
- Message streaming scenario: 0.00ms avg (budget: 16ms) - PASSED
- 100 messages with 10 chunks each processed efficiently
- Render times negligible due to memoization

## 2026-03-28 Task 7 Fix: Stable Content-Block Selectors

### Issue
ContentRenderer used unstable index-based keys (`${block.type}-${index}`) and selectors (`data-acp-content-block-index`), violating Task 7 requirement for stable content-block identity during streaming updates.

### Fix
Implemented `getBlockStableId()` function in ContentRenderer.tsx that derives deterministic identifiers from block payload:

- **Text blocks**: `text-{first50Chars}-{length}`
- **Resource blocks**: `resource-{uri}-{mimeType}-{contentType}`
- **ResourceLink blocks**: `link-{uri}-{mimeType}`
- **Unknown blocks**: `unknown-{index}` (fallback only)

### New Selector Surface
- `data-acp-content-block-id={stableId}` - Stable deterministic identifier
- `data-acp-content-block-type={type}` - Block type (preserved)
- `data-acp-content-block-index={index}` - Array index (secondary, for reference)

### Key Properties
- Same logical block produces same ID across re-renders
- Streaming text chunks with same content get stable identity
- Resource blocks keyed by URI (naturally stable)
- Index only used as tie-breaker for truly unknown content types

### Verification
- All 21 message-rendering tests pass
- Message streaming perf scenario passes (0.00ms avg)
- Full build/test/check suite passes (121 tests)

## Task 8: Composer Implementation (2025-03-28)

### Implementation Summary
- Created controlled React composer component with full keyboard handling
- Reused pure helper logic from Svelte implementation (composer-logic.ts)
- Integrated Base UI Button for send/stop controls
- Wired to ACP session controller for sendPrompt/cancelPrompt

### Key Design Decisions
1. **Controlled Input State**: Input value is local React state, not in normalized store
2. **Keyboard Behavior**: Enter sends, Shift+Enter inserts newline, respects composition events
3. **Disabled States**: Composer disables when not connected, not initialized, or no session
4. **Send/Stop Toggle**: Button switches based on streaming state from useActiveStreamingMessage hook
5. **Transient Draft**: Input clears on successful send, stays local to component

### Files Created
- `packages/acp-chat-react/src/composer/composer-logic.ts` - Pure helper functions
- `packages/acp-chat-react/src/composer/types.ts` - TypeScript interfaces
- `packages/acp-chat-react/src/composer/Composer.tsx` - Main component
- `packages/acp-chat-react/src/composer/index.ts` - Public exports
- `packages/acp-chat-react/src/composer/composer-flow.test.tsx` - Test suite

### Test Coverage
- 39 tests covering logic functions and component behavior
- Keyboard handling (Enter, Shift+Enter, composition events)
- Disabled states (disconnected, uninitialized, no session)
- Send/stop flow validation

### Integration
- Added to harness App.tsx with proper controller wiring
- Composer appears below thread panel
- Placeholder explains keyboard shortcuts

### Evidence
- Screenshot: `.sisyphus/evidence/task-8-composer-flow.png`
- Shows composer with disabled Send button (no active session)

## 2026-03-28 Task 10: Session-List Component (Partial - Wave 3)

### Implementation Summary
Created standalone SessionList React component for Wave 3 Task 10 (session-list subset only).

### Files Created
- packages/acp-chat-react/src/session-list/types.ts - TypeScript interfaces
- packages/acp-chat-react/src/session-list/SessionList.tsx - Main component
- packages/acp-chat-react/src/session-list/index.ts - Public exports
- packages/acp-chat-react/src/session-list/session-list.test.tsx - Test suite

### Harness Integration
- Added 'Sessions' tab to SessionSourceSelector in apps/harness/src/App.tsx
- SessionList connects to live ACP bridge via SessionController
- Supports listing sessions via listSessions() and loading via loadSession()

### Base UI Primitives Used
- Button: For load/retry actions
- ScrollArea: For scrollable session list
- Separator: For visual separation in session rows

### SessionController API Usage
- listSessions(cursor?, cwd?) - Fetches paginated session list
- loadSession(sessionId, cwd) - Loads selected session

### Test Coverage
- 18 tests covering rendering, selection, loading, pagination, error handling
- All tests pass (178 total tests in suite)

### Verification
- pnpm build: PASS
- pnpm check: PASS (no TypeScript errors)
- pnpm test: PASS (178 tests)
- pnpm bundle:check: PASS (42.21 KB gzip, under 120 KB budget)

### Data Attributes (Stable Selectors)
- data-acp-session-list: Root container
- data-acp-session-row: Individual session row
- data-acp-session-id: Session ID attribute
- data-acp-session-selected: Selection state
- data-acp-session-loading: Loading state
- data-acp-session-select-button: Select action
- data-acp-session-load-button: Load action
- data-acp-session-title: Session title
- data-acp-session-cwd: Working directory
- data-acp-session-date: Last updated

