# ACP Chat UI React - Architecture Refactoring Plan

**Goal:** Enforce strict package boundaries so each published package has a single, clear responsibility. Replay logic must exist EXCLUSIVELY in the Rust controller.

**Date:** 2026-04-23  
**Status:** Planned

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RUST LAYER                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              acp-harness-server (Rust Controller)               │  │
│  │  - Replay Logic (EXCLUSIVE - nowhere else)                      │  │
│  │  - Live Mode Controller                                         │  │
│  │  - Custom Event Handlers (replay_speed, replay_init, etc.)      │  │
│  │  - Uses: acp-ws-bridge (rust), acp-sdk (rust)                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬─────────────────────────────────────────┘
                              │ WebSocket (BridgeEnvelope)
                              │
┌─────────────────────────────▼─────────────────────────────────────────┐
│                      TYPESCRIPT LAYER                                  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │         @agentclientprotocol/sdk (EXTERNAL NPM PACKAGE)           │ │
│  │  - ACP protocol types ONLY                                        │ │
│  │  - JSON-RPC 2.0, Notification, Response, Request, SessionUpdate   │ │
│  │  - Source: https://agentclientprotocol.com/libraries/typescript   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│         ▲                              ▲                               │
│         │ (depends on)                 │ (depends on)                  │
│         │                              │                               │
│  ┌──────┴────────────────┐   ┌────────┴──────────────────────────┐    │
│  │ @harms-haus/          │   │ @harms-haus/                      │    │
│  │   acp-chat-core       │   │   acp-ws-bridge (TS)              │    │
│  │                       │   │                                   │    │
│  │ - SessionController   │   │ - WsTransport                     │    │
│  │ - Normalization Layer │   │ - BridgeEnvelope types            │    │
│  │ - FileSystem Subs     │   │ - Generic custom event passthrough│    │
│  │ - Test Utilities      │   │ - NO ACP knowledge                │    │
│  │                       │   │ - NO replay knowledge             │    │
│  │ Uses: acp-sdk ONLY    │   │ Uses: NONE (pure WS client)       │    │
│  │ NO bridge knowledge   │   │ NO core knowledge                 │    │
│  └───────────────────────┘   └───────────────────────────────────┘    │
│         ▲                              ▲                               │
│         │ (depends on)                 │ (depends on)                  │
│         │                              │                               │
│  ┌──────┴──────────────────────────────┴──────────────────────────┐   │
│  │                   @harms-haus/acp-chat-react                      │  │
│  │  - AcpStore (snapshot-based state management)                     │  │
│  │  - Components: Thread, Composer, MessageCard, ThoughtStack, etc.  │  │
│  │  - Hooks: useMessages, useThoughts, useSessionState, etc.         │  │
│  │  - Uses: acp-chat-core ONLY                                       │  │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │              @harms-haus/acp-harness-ui                            │ │
│  │  - GLUE LAYER: Bridges ws-bridge ↔ acp-chat-core                   │ │
│  │  - Custom replay logic (shared with Rust controller)               │ │
│  │  - Event translation: BridgeEnvelope → ACP notifications           │ │
│  │  - Uses: acp-ws-bridge, acp-chat-core, acp-chat-react, acp-sdk     │ │
│  │  - NOT PUBLISHED - demo/test application only                      │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

1. **acp-chat-core is pure ACP** - Only knows about `@agentclientprotocol/sdk` types. No bridge protocol, no replay, no WebSocket.

2. **acp-ws-bridge (TS) is pure transport** - Generic WebSocket client with envelope handling. No ACP knowledge, no replay logic.

3. **acp-chat-react is pure UI** - Only consumes acp-chat-core. No direct bridge knowledge.

4. **acp-harness-ui is the glue** - The ONLY package that knows about both ws-bridge AND acp-chat-core. Contains all custom/demo logic.

5. **Replay is Rust-exclusive** - No ReplayController in TypeScript. Replay state, speed control, and event sequencing live only in Rust.

6. **Custom events are generic** - The bridge supports arbitrary custom events. Replay-specific events are defined in harness-ui, not in bridge.

---

## Phase 1: Clean Up acp-chat-core

**Goal:** Remove all bridge protocol and replay knowledge. Core should only use `@agentclientprotocol/sdk`.

### 1.1 Delete Replay Files

- [ ] **DELETE** `packages/acp-chat-core/src/replay/types.ts`
  - Contains: `ReplayEvent`, `ACPReplayEvent`, `ReplaySessionMetadata`, `ReplayManifest`
  - These are replay concerns - not core ACP functionality

- [ ] **DELETE** `packages/acp-chat-core/src/test-utils/fixtures.ts`
  - Contains: `loadReplayFixture()`, `loadReplayFixtureMetadata()`
  - Fixture loading is a test harness concern, not core

- [ ] **DELETE** `packages/acp-chat-core/src/replay/` directory (if empty after deletion)

### 1.2 Update Test Utilities

- [ ] **UPDATE** `packages/acp-chat-core/src/test-utils/mocks.ts`
  - **REMOVE** lines 12-33: `BridgeEnvelope` interface (duplicated type)
  - **KEEP** `MockTransport` and `MockSessionController`
  - Mock should only use ACP types from `@agentclientprotocol/sdk`

- [ ] **UPDATE** `packages/acp-chat-core/src/test-utils/index.ts`
  - **REMOVE** any exports related to fixtures, replay-assertions, replay-runner
  - **KEEP** only: `MockTransport`, `MockSessionController`, `createMockTransport`, `createMockController`

### 1.3 Update Session Controller

- [ ] **UPDATE** `packages/acp-chat-core/src/session/controller.ts`
  - **CHANGE** imports from local protocol types to acp-sdk:
    ```typescript
    // BEFORE
    import type { ACPNotification, ACPResponse } from "../protocol/types.js";
    
    // AFTER
    import type {
      Notification as ACPNotification,
      Response as ACPResponse,
      Request as ACPRequest,
    } from "@agentclientprotocol/sdk";
    ```
  - **REMOVE** any references to bridge envelope or bridge-specific handling
  - **VERIFY** no imports from `@harms-haus/acp-ws-bridge`

- [ ] **UPDATE** `packages/acp-chat-core/src/protocol/types.ts` (if keeping local types)
  - Re-export types from `@agentclientprotocol/sdk` for convenience
  - Or remove entirely and import directly from sdk

### 1.4 Update Launch Preset

- [ ] **UPDATE** `packages/acp-chat-core/src/presets/launch.ts`
  - **REMOVE** `bridgeMode: "proxy" | "replay" | null` field from `LaunchPreset`
  - **REMOVE** `replayFile: string | null` field from `LaunchPreset`
  - **KEEP** only generic connection config: `bridgeUrl`, `launchCmd`, `sessionId`, `cwd`, `autoConnect`
  - **UPDATE** `isPresetValid()` to remove replay mode validation logic

### 1.5 Update Tests

- [ ] **UPDATE** `packages/acp-chat-core/src/presets/launch.test.ts`
  - **REMOVE** all tests related to replay mode validation
  - **KEEP** tests for proxy mode and generic config

- [ ] **UPDATE** `packages/acp-chat-core/src/test-utils/__tests__/fixtures.test.ts`
  - **DELETE** this file (fixtures moved to harness-ui)

- [ ] **UPDATE** any other test files that import from deleted replay modules

### 1.6 Update Package Dependencies

- [ ] **UPDATE** `packages/acp-chat-core/package.json`
  ```json
  {
    "name": "@harms-haus/acp-chat-core",
    "dependencies": {
      "@agentclientprotocol/sdk": "^0.1.0"
    },
    "devDependencies": {
      // Remove any bridge-related dev deps
    }
  }
  ```

### 1.7 Verification

- [ ] **VERIFY** no imports from `@harms-haus/acp-ws-bridge`:
  ```bash
  grep -r "acp-ws-bridge" packages/acp-chat-core/src/ || echo "PASS: No bridge imports"
  ```

- [ ] **VERIFY** acp-sdk is used:
  ```bash
  grep -r "@agentclientprotocol/sdk" packages/acp-chat-core/src/ || echo "FAIL: No sdk imports"
  ```

- [ ] **VERIFY** TypeScript compiles without errors:
  ```bash
  cd packages/acp-chat-core && pnpm build
  ```

- [ ] **VERIFY** tests pass:
  ```bash
  cd packages/acp-chat-core && pnpm test
  ```

---

## Phase 2: Clean Up acp-ws-bridge (TypeScript)

**Goal:** Remove ReplayController and make the bridge a generic WebSocket transport with custom event support.

### 2.1 Delete Replay Controller

- [ ] **DELETE** `packages/acp-ws-bridge/src/replay-controller.ts`
  - Entire file (635 lines) - replay logic moves to Rust + harness-ui

### 2.2 Update Exports

- [ ] **UPDATE** `packages/acp-ws-bridge/src/index.ts`
  - **REMOVE** ReplayController export
  - **REMOVE** ReplayControllerOptions, ReplayControllerState, ReplayMode, ReplayModel type exports
  - **KEEP** WsTransport, TransportClient, factory functions, bridge protocol types

### 2.3 Update Transport Client

- [ ] **UPDATE** `packages/acp-ws-bridge/src/client.ts`
  - **REMOVE** `initReplay()` method
  - **REMOVE** `initLive()` method (or move to harness-ui)
  - **ADD** generic `sendCustomEvent()` method:
    ```typescript
    sendCustomEvent(type: string, data: unknown): void {
      const payload = {
        type: 'custom',
        custom_type: type,
        custom_data: data,
      };
      this.send(JSON.stringify(payload));
    }
    ```
  - **VERIFY** no imports from `@harms-haus/acp-chat-core`

### 2.4 Update Generated Types

- [ ] **VERIFY** `packages/acp-ws-bridge/src/generated/` contains only bridge protocol types:
  - `BridgeEnvelope.ts`
  - `BridgeMessage.ts`
  - `BridgeStatus.ts`
  - `UnsupportedVersionError.ts`
  - `serde_json/JsonValue.ts`
  - These are auto-generated from Rust via `ts-rs` - ensure they're up to date

- [ ] **REGENERATE** TypeScript bindings from Rust if needed:
  ```bash
  cd crates/acp-ws-bridge && cargo test  # Should regenerate bindings
  ```

### 2.5 Update Test Utilities

- [ ] **UPDATE** `packages/acp-ws-bridge/src/test-utils.ts`
  - **KEEP** `MockWebSocket`, `EnvelopeBuilder`, `MessageBuilder`, `TestConstants`, `AsyncTestHelpers`
  - **REMOVE** any replay-specific test helpers
  - **ADD** helper for custom events if needed

### 2.6 Update Tests

- [ ] **UPDATE** `packages/acp-ws-bridge/src/client.test.ts`
  - **REMOVE** tests for `initReplay()`, `initLive()`
  - **ADD** tests for `sendCustomEvent()`

- [ ] **UPDATE** `packages/acp-ws-bridge/src/envelope.test.ts`
  - **VERIFY** tests still pass with updated envelope types

### 2.7 Update Package Dependencies

- [ ] **UPDATE** `packages/acp-ws-bridge/package.json`
  ```json
  {
    "name": "@harms-haus/acp-ws-bridge",
    "dependencies": {
      // NO dependency on acp-chat-core
      // NO dependency on acp-sdk
    }
  }
  ```

### 2.8 Verification

- [ ] **VERIFY** no imports from `@harms-haus/acp-chat-core`:
  ```bash
  grep -r "acp-chat-core" packages/acp-ws-bridge/src/ || echo "PASS: No core imports"
  ```

- [ ] **VERIFY** no imports from `@agentclientprotocol/sdk`:
  ```bash
  grep -r "@agentclientprotocol/sdk" packages/acp-ws-bridge/src/ || echo "PASS: No sdk imports"
  ```

- [ ] **VERIFY** TypeScript compiles without errors:
  ```bash
  cd packages/acp-ws-bridge && pnpm build
  ```

- [ ] **VERIFY** tests pass:
  ```bash
  cd packages/acp-ws-bridge && pnpm test
  ```

---

## Phase 3: Clean Up acp-chat-react

**Goal:** Remove hardcoded replay mode and ensure react only depends on acp-chat-core.

### 3.1 Update Settings Types

- [ ] **UPDATE** `packages/acp-chat-react/src/settings/types.ts`
  - **REMOVE** hardcoded replay mode from `AcpMode` type:
    ```typescript
    // BEFORE
    export interface AcpMode {
      id: "proxy" | "replay" | "live";
      name: string;
      description?: string;
    }
    
    // AFTER
    export interface AcpMode {
      id: string;  // Dynamic - provided by controller
      name: string;
      description?: string;
    }
    ```
  - **REMOVE** any default mode arrays that include replay

### 3.2 Update Components

- [ ] **REVIEW** all components in `packages/acp-chat-react/src/` for replay references
  - **UPDATE** any component that assumes specific modes
  - **ENSURE** modes are received from controller state, not hardcoded

### 3.3 Update Package Dependencies

- [ ] **UPDATE** `packages/acp-chat-react/package.json`
  ```json
  {
    "name": "@harms-haus/acp-chat-react",
    "dependencies": {
      "@harms-haus/acp-chat-core": "workspace:*",
      "@agentclientprotocol/sdk": "^0.1.0"
    }
  }
  ```

### 3.4 Verification

- [ ] **VERIFY** no imports from `@harms-haus/acp-ws-bridge`:
  ```bash
  grep -r "acp-ws-bridge" packages/acp-chat-react/src/ || echo "PASS: No bridge imports"
  ```

- [ ] **VERIFY** TypeScript compiles without errors:
  ```bash
  cd packages/acp-chat-react && pnpm build
  ```

- [ ] **VERIFY** tests pass:
  ```bash
  cd packages/acp-chat-react && pnpm test
  ```

---

## Phase 4: Create Bridge Adapter in acp-harness-ui

**Goal:** Create the glue layer that connects ws-bridge to acp-chat-core. This is where custom replay logic lives.

### 4.1 Create Bridge Adapter

- [ ] **CREATE** `packages/acp-harness-ui/src/bridge-adapter.ts`
  ```typescript
  /**
   * BridgeAdapter - The glue between ws-bridge and acp-chat-core
   * 
   * This class:
   * 1. Subscribes to BridgeEnvelope events from WsTransport
   * 2. Translates acp_payload envelopes → ACP notifications → SessionController
   * 3. Handles custom events (replay_speed, replay_status, etc.)
   * 4. Provides methods to send custom events to Rust controller
   * 
   * Replay logic lives HERE and in Rust - NOT in bridge or core.
   */
  
  import { TransportClient, type BridgeEnvelope } from '@harms-haus/acp-ws-bridge';
  import { SessionController } from '@harms-haus/acp-chat-core';
  import type { Notification as ACPNotification } from '@agentclientprotocol/sdk';
  
  export interface ReplayConfig {
    replayDataPath: string;
    replaySpeed?: number;
    sessionId?: string;
  }
  
  export interface ReplayStatus {
    status: 'idle' | 'loading' | 'playing' | 'paused' | 'complete' | 'error';
    currentEvent?: number;
    totalEvents?: number;
    error?: string;
  }
  
  export class BridgeAdapter {
    private transport: TransportClient;
    private controller: SessionController;
    private onCustomEvent?: (type: string, data: unknown) => void;
    private replayStatus: ReplayStatus;
  
    constructor(
      transport: TransportClient,
      controller: SessionController,
      options?: {
        onCustomEvent?: (type: string, data: unknown) => void;
      }
    );
  
    private handleEnvelope(envelope: BridgeEnvelope): void;
    sendCustomEvent(type: string, data: unknown): void;
    initReplay(config: ReplayConfig): void;
    setReplaySpeed(speed: number): void;
    getController(): SessionController;
    getStatus(): ReplayStatus;
  }
  ```

### 4.2 Create Replay Types

- [ ] **CREATE** `packages/acp-harness-ui/src/replay-types.ts`
  ```typescript
  /**
   * Replay-specific types - ONLY known to harness-ui and Rust controller
   * These are NOT exposed in any published package
   */
  
  export interface ReplayInitEvent {
    type: 'replay_init';
    data: {
      replayDataPath: string;
      replaySpeed?: number;
      sessionId?: string;
    };
  }
  
  export interface ReplaySpeedEvent {
    type: 'replay_speed';
    data: {
      speed: number; // 0-100
    };
  }
  
  export interface ReplayPauseEvent {
    type: 'replay_pause';
    data: {};
  }
  
  export interface ReplayResumeEvent {
    type: 'replay_resume';
    data: {};
  }
  
  export interface ReplaySeekEvent {
    type: 'replay_seek';
    data: {
      eventIndex: number;
    };
  }
  
  export interface ReplayStatusEvent {
    type: 'replay_status';
    data: ReplayStatus;
  }
  
  export type HarnessCustomEvent =
    | ReplayInitEvent
    | ReplaySpeedEvent
    | ReplayPauseEvent
    | ReplayResumeEvent
    | ReplaySeekEvent
    | ReplayStatusEvent;
  
  export interface ReplayStatus {
    status: 'idle' | 'loading' | 'playing' | 'paused' | 'complete' | 'error';
    currentEvent?: number;
    totalEvents?: number;
    error?: string;
  }
  ```

### 4.3 Update ReplayPanel Component

- [ ] **UPDATE** `packages/acp-harness-ui/src/components/ReplayPanel.tsx`
  - **REMOVE** direct `ReplayController` import
  - **ADD** `BridgeAdapter` usage
  - **UPDATE** connection logic to use adapter
  - **UPDATE** speed change to use `adapter.setReplaySpeed()`

### 4.4 Update LivePanel Component

- [ ] **UPDATE** `packages/acp-harness-ui/src/components/LivePanel.tsx`
  - **UPDATE** to use `BridgeAdapter` for consistency
  - **ADD** custom event support if needed for live mode

### 4.5 Update App Component

- [ ] **UPDATE** `packages/acp-harness-ui/src/App.tsx`
  - **REMOVE** direct `ReplayController` imports and state
  - **ADD** `BridgeAdapter` state and management
  - **UPDATE** connection/disconnection logic to use adapter
  - **UPDATE** store creation to use controller from adapter

### 4.6 Update Package Dependencies

- [ ] **UPDATE** `packages/acp-harness-ui/package.json`
  ```json
  {
    "name": "@harms-haus/acp-harness-ui",
    "private": true,
    "dependencies": {
      "@harms-haus/acp-chat-core": "workspace:*",
      "@harms-haus/acp-chat-react": "workspace:*",
      "@harms-haus/acp-ws-bridge": "workspace:*",
      "@agentclientprotocol/sdk": "^0.1.0"
    }
  }
  ```

### 4.7 Verification

- [ ] **VERIFY** harness-ui imports from all three packages:
  ```bash
  grep -r "acp-chat-core" packages/acp-harness-ui/src/ && echo "PASS: Core imported"
  grep -r "acp-ws-bridge" packages/acp-harness-ui/src/ && echo "PASS: Bridge imported"
  grep -r "acp-chat-react" packages/acp-harness-ui/src/ && echo "PASS: React imported"
  ```

- [ ] **VERIFY** TypeScript compiles without errors:
  ```bash
  cd packages/acp-harness-ui && pnpm build
  ```

- [ ] **VERIFY** Playwright tests pass:
  ```bash
  cd packages/acp-harness-ui && pnpm test:e2e
  ```

---

## Phase 5: Update Integration Tests

**Goal:** Move replay tests to use BridgeAdapter instead of deleted ReplayController.

### 5.1 Update Long Context Replay Test

- [ ] **UPDATE** `packages/integration-tests/src/long-context-replay.test.ts`
  - **REMOVE** `ReplayController` import
  - **ADD** `BridgeAdapter` import from harness-ui
  - **UPDATE** test setup to use adapter
  - **NOTE:** May need to move this test to harness-ui package since it now depends on harness-specific code

### 5.2 Consider Test Relocation

- [ ] **DECIDE** whether to:
  - Option A: Move integration tests to `packages/acp-harness-ui/tests/`
  - Option B: Keep in `integration-tests` but add harness-ui as dependency
  - Option C: Create separate `packages/e2e-tests` for full integration tests

### 5.3 Update Test Helpers

- [ ] **UPDATE** `packages/integration-tests/src/helpers/bridge.ts`
  - **VERIFY** bridge spawning logic still works
  - **UPDATE** if needed for new custom event flow

### 5.4 Verification

- [ ] **VERIFY** integration tests compile:
  ```bash
  cd packages/integration-tests && pnpm build
  ```

- [ ] **VERIFY** integration tests pass:
  ```bash
  cd packages/integration-tests && pnpm test
  ```

---

## Phase 6: Rust Controller Verification

**Goal:** Ensure replay logic is EXCLUSIVE to Rust controller.

### 6.1 Verify Rust Replay Implementation

- [ ] **REVIEW** `crates/acp-harness-server/src/modes/replay.rs`
  - **ENSURE** all replay logic is here (event sequencing, speed control, etc.)
  - **ENSURE** custom event handlers for `replay_init`, `replay_speed`, etc.

- [ ] **REVIEW** `crates/acp-harness-server/src/modes/replay_streaming.rs`
  - **ENSURE** streaming replay logic is complete

- [ ] **REVIEW** `crates/acp-harness-server/src/script/`
  - **ENSURE** script parsing and event generation is complete

### 6.2 Verify Custom Event Handlers

- [ ] **VERIFY** Rust controller handles these custom events:
  - `replay_init` - Initialize replay with config
  - `replay_speed` - Change playback speed
  - `replay_pause` - Pause playback
  - `replay_resume` - Resume playback
  - `replay_seek` - Seek to specific event

- [ ] **VERIFY** Rust controller sends these custom events:
  - `replay_status` - Status updates to UI

### 6.3 Verify TypeScript Bindings

- [ ] **VERIFY** `ts-rs` bindings are up to date:
  ```bash
  cd crates/acp-ws-bridge && cargo test
  cd crates/acp-harness-server && cargo test
  ```

- [ ] **VERIFY** generated TypeScript types in:
  - `packages/acp-ws-bridge/src/generated/`
  - `crates/acp-harness-server/bindings/`

### 6.4 Verification

- [ ] **VERIFY** Rust tests pass:
  ```bash
  cargo test --workspace
  ```

- [ ] **VERIFY** no replay logic in TypeScript bridge:
  ```bash
  grep -r "replay" packages/acp-ws-bridge/src/ --include="*.ts" | grep -v "custom" | grep -v "test" || echo "PASS: No replay logic in bridge"
  ```

---

## Phase 7: Documentation Updates

**Goal:** Update wiki documentation to reflect new architecture.

### 7.1 Update Wiki Pages

- [ ] **UPDATE** `docs/wiki/acp-chat-core-Architecture.md`
  - **ADD** clear statement: "Core only knows about @agentclientprotocol/sdk"
  - **REMOVE** any references to bridge protocol
  - **REMOVE** any references to replay functionality

- [ ] **UPDATE** `docs/wiki/acp-chat-core-Types-Reference.md`
  - **REMOVE** replay type definitions
  - **UPDATE** type sources to reference acp-sdk

- [ ] **UPDATE** `docs/wiki/acp-chat-core-Session-Management.md`
  - **REMOVE** replay-specific methods
  - **UPDATE** examples to use generic connection

- [ ] **UPDATE** `docs/wiki/acp-chat-react-Home.md`
  - **REMOVE** hardcoded mode examples
  - **UPDATE** to show dynamic mode handling

- [ ] **CREATE** `docs/wiki/harness-ui-Bridge-Adapter.md` (new page)
  - Document BridgeAdapter pattern
  - Show how to connect ws-bridge to acp-chat-core
  - Explain custom event mechanism

- [ ] **CREATE** `docs/wiki/harness-ui-Replay-Architecture.md` (new page)
  - Document replay architecture (Rust-exclusive)
  - Show custom event flow
  - Explain harness-ui role as glue layer

### 7.2 Update AGENTS.md

- [ ] **UPDATE** `AGENTS.md`
  - **ADD** architecture diagram showing package boundaries
  - **ADD** clear rules about what each package can/cannot know
  - **ADD** checklist for verifying no cross-boundary imports

### 7.3 Update README Files

- [ ] **UPDATE** `packages/acp-chat-core/README.md`
  - **ADD** clear statement about acp-sdk dependency
  - **ADD** architecture diagram

- [ ] **UPDATE** `packages/acp-ws-bridge/README.md`
  - **ADD** clear statement about generic transport
  - **ADD** custom event documentation

- [ ] **UPDATE** `packages/acp-harness-ui/README.md`
  - **ADD** explanation of glue layer role
  - **ADD** BridgeAdapter documentation

---

## Phase 8: Final Verification

**Goal:** Comprehensive verification of all package boundaries.

### 8.1 Dependency Graph Verification

- [ ] **VERIFY** acp-chat-core dependencies:
  ```bash
  cd packages/acp-chat-core
  cat package.json | jq '.dependencies'
  # Should only show @agentclientprotocol/sdk
  ```

- [ ] **VERIFY** acp-ws-bridge dependencies:
  ```bash
  cd packages/acp-ws-bridge
  cat package.json | jq '.dependencies'
  # Should be empty or minimal (no core, no sdk)
  ```

- [ ] **VERIFY** acp-chat-react dependencies:
  ```bash
  cd packages/acp-chat-react
  cat package.json | jq '.dependencies'
  # Should show acp-chat-core and @agentclientprotocol/sdk
  ```

- [ ] **VERIFY** acp-harness-ui dependencies:
  ```bash
  cd packages/acp-harness-ui
  cat package.json | jq '.dependencies'
  # Should show all three packages + sdk
  ```

### 8.2 Import Analysis

- [ ] **RUN** full import analysis:
  ```bash
  # Check core doesn't import bridge
  echo "=== acp-chat-core imports ==="
  grep -r "from.*acp-ws-bridge" packages/acp-chat-core/src/ || echo "PASS"
  
  # Check bridge doesn't import core
  echo "=== acp-ws-bridge imports ==="
  grep -r "from.*acp-chat-core" packages/acp-ws-bridge/src/ || echo "PASS"
  
  # Check react doesn't import bridge
  echo "=== acp-chat-react imports ==="
  grep -r "from.*acp-ws-bridge" packages/acp-chat-react/src/ || echo "PASS"
  
  # Check harness imports all three
  echo "=== acp-harness-ui imports ==="
  grep -r "from.*acp-ws-bridge" packages/acp-harness-ui/src/ && echo "PASS: Bridge"
  grep -r "from.*acp-chat-core" packages/acp-harness-ui/src/ && echo "PASS: Core"
  grep -r "from.*acp-chat-react" packages/acp-harness-ui/src/ && echo "PASS: React"
  ```

### 8.3 Build Verification

- [ ] **BUILD** all packages:
  ```bash
  pnpm build --filter "@harms-haus/*"
  ```

### 8.4 Test Verification

- [ ] **TEST** all packages:
  ```bash
  pnpm test --filter "@harms-haus/*"
  ```

### 8.5 E2E Verification

- [ ] **RUN** Playwright tests:
  ```bash
  cd packages/acp-harness-ui && pnpm test:e2e
  ```

### 8.6 Manual Verification

- [ ] **TEST** replay mode manually:
  - Start harness-ui
  - Connect to replay
  - Change replay speed
  - Verify events flow correctly

- [ ] **TEST** live mode manually:
  - Start harness-ui
  - Connect to live agent
  - Send prompts
  - Verify events flow correctly

---

## Rollback Plan

If issues are discovered during refactoring:

1. **Git checkpoint** at each phase completion
2. **Revert** individual phases if needed:
   ```bash
   git checkout HEAD~N -- packages/acp-chat-core/src/
   ```
3. **Fallback** to working state if build/tests fail

---

## Success Criteria

- [ ] acp-chat-core has NO imports from acp-ws-bridge
- [ ] acp-ws-bridge has NO imports from acp-chat-core
- [ ] acp-chat-react has NO imports from acp-ws-bridge
- [ ] acp-harness-ui is the ONLY package importing all three
- [ ] No ReplayController in TypeScript packages
- [ ] All replay logic is in Rust controller
- [ ] Custom events work for replay speed control
- [ ] All builds pass
- [ ] All tests pass
- [ ] E2E tests pass
- [ ] Documentation updated

---

## Timeline Estimate

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Phase 1: acp-chat-core cleanup | 2-3 hours | None |
| Phase 2: acp-ws-bridge cleanup | 2-3 hours | Phase 1 |
| Phase 3: acp-chat-react cleanup | 1-2 hours | Phase 1 |
| Phase 4: Bridge adapter (harness-ui) | 3-4 hours | Phase 1, 2 |
| Phase 5: Integration tests | 2-3 hours | Phase 4 |
| Phase 6: Rust verification | 1-2 hours | None |
| Phase 7: Documentation | 2-3 hours | All phases |
| Phase 8: Final verification | 1-2 hours | All phases |
| **Total** | **14-22 hours** | |

---

## Notes

- **DO NOT** create new packages - use existing acp-sdk from npm/crates.io
- **DO** keep acp-chat-core and acp-ws-bridge completely independent
- **DO** put all custom/demo logic in acp-harness-ui
- **DO** keep replay logic EXCLUSIVE to Rust controller
- **DO** use custom events for harness↔Rust communication

---

**Last Updated:** 2026-04-23  
**Author:** Hermes Agent  
**Status:** Ready for implementation
