# ACP React Chat UI Library

## TL;DR
> **Summary**: Build a React-first ACP chat UI library from a fresh architecture, reusing only the framework-agnostic ACP bridge/core pieces from `old-acp-svelte-chat-ui/`, redesigning the UI layer around React-native performance patterns, and standardizing on Base UI primitives everywhere they do not conflict with ACP-specific rendering or virtualization.
> **Deliverables**:
> - Publishable `@acp/chat-react` package that is SSR-safe, always virtualized in v1, built from Base UI primitives where appropriate, and styled with shipped CSS variables plus class hooks
> - Reused and hardened `@acp/chat-core` package for bridge envelopes, ACP transport, session control, normalization, and launch presets
> - Vite-based harness app for replay/live ACP testing, Chrome DevTools QA, perf evidence, and wave breakpoints
> - Performance infrastructure: benchmark fixtures, render/memory/bundle budgets, and verification scripts that prove the React rewrite meets the stated constraints
> **Effort**: XL
> **Parallel**: YES - 4 waves
> **Critical Path**: 1 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 12 → 13 → 14

## Context
### Original Request
Review `.sisyphus/plans/acp-react-chat-library.md` and completely rewrite it from scratch using React instead of Svelte. The previous plan failed performance requirements in another project. Start fresh for the UI, reuse as much as makes sense from `old-acp-svelte-chat-ui/` with the ACP websocket as the primary target for reuse, identify what else can be reused, and do it the right way for React without cutting corners for simplicity.

### Interview Summary
- The current plan file is Svelte-oriented and must be replaced, not incrementally edited as architecture guidance.
- Safe reuse should prioritize framework-agnostic assets from `old-acp-svelte-chat-ui/`: Rust bridge, generated bridge types, ACP parser, transport/session logic, normalization logic, launch presets, and pure helper logic where present.
- The React library itself must be SSR-safe, while the developer harness should remain a lightweight Vite app.
- Thread rendering in v1 must be always virtualized rather than treating virtualization as a later optimization.
- Testing should keep the prior philosophy of small waves with checkpoints, use TDD for non-browser/core logic, and rely on Chrome DevTools plus explicit user breakpoints between waves for browser verification.

### Metis Review (gaps addressed)
- Added explicit performance budgets and validation commands instead of relying on “feels fast” checks.
- Locked the React state integration pattern to `useSyncExternalStore` over the reused ACP core instead of ad hoc effect wiring.
- Locked thread rendering to `@tanstack/react-virtual` from the start, with stable keys, memoized rows, and no fallback non-virtualized implementation path in v1.
- Added guardrails against effect-derived state, Svelte-style mechanical porting, and browser-only APIs leaking into SSR paths.
- Locked Base UI adoption to overlays, controls, disclosure patterns, and non-ACP-specific chrome while explicitly excluding virtualization core and ACP-specific content rendering.

## Work Objectives
### Core Objective
Deliver a performant React ACP chat component library that preserves the reusable ACP bridge/core assets from the legacy Svelte repo, rewrites the UI layer specifically for React, and proves performance through explicit render, memory, and bundle verification.

### Deliverables
- `packages/acp-chat-core`: reusable TypeScript ACP core containing generated bridge types, envelope parser, WebSocket transport client, session controller, normalization store, launch presets, and pure shared logic moved out of the old Svelte package where appropriate
- `packages/acp-chat-react`: publishable React library exporting SSR-safe chat components, hooks, Base UI-backed primitives where appropriate, CSS assets, class hooks, and renderer overrides
- `apps/harness`: Vite + React development harness for replay/live ACP sessions, Chrome DevTools QA, and performance measurement
- `crates/acp-bridge`: retained Rust WebSocket bridge for ACP stdio proxying and replay support
- Root workspace tooling and perf infrastructure: pnpm workspaces, strict TypeScript, Vitest, React Testing Library, benchmark scripts, bundle budget scripts, and `.sisyphus/evidence/` conventions

### Base UI Adoption Policy
- **Task 5 shell and non-thread chrome**: use [Base UI Button](https://base-ui.com/components/button/), [Tabs](https://base-ui.com/components/tabs/), [Toolbar](https://base-ui.com/components/toolbar/), [Popover](https://base-ui.com/components/popover/), [Dialog](https://base-ui.com/components/dialog/), [Tooltip](https://base-ui.com/components/tooltip/), and [Separator](https://base-ui.com/components/separator/) where the surface is generic application chrome rather than ACP content rendering.
- **Task 6 thread container**: `@tanstack/react-virtual` remains mandatory for the thread itself; [Base UI Scroll Area](https://base-ui.com/components/scroll-area/) may wrap the viewport only if it does not interfere with virtualization, measurement, or follow-scroll behavior.
- **Task 8 composer**: keep ACP-specific input orchestration custom, but use [Base UI Button](https://base-ui.com/components/button/) and [Toolbar](https://base-ui.com/components/toolbar/) where they improve the non-thread control surface without introducing extra render churn.
- **Task 9 thought/tool disclosure**: use [Base UI Collapsible](https://base-ui.com/components/collapsible/), [Tooltip](https://base-ui.com/components/tooltip/), [Menu](https://base-ui.com/components/menu/), [Context Menu](https://base-ui.com/components/context-menu/), and [Separator](https://base-ui.com/components/separator/) for expandable and contextual controls.
- **Task 10 settings and session list**: use [Base UI Select](https://base-ui.com/components/select/), [Checkbox](https://base-ui.com/components/checkbox/), [Switch](https://base-ui.com/components/switch/), [Tabs](https://base-ui.com/components/tabs/), [Scroll Area](https://base-ui.com/components/scroll-area/), [Menu](https://base-ui.com/components/menu/), [Context Menu](https://base-ui.com/components/context-menu/), [Button](https://base-ui.com/components/button/), and [Separator](https://base-ui.com/components/separator/).
- **Task 11 slash commands and message actions**: use [Base UI Autocomplete](https://base-ui.com/components/autocomplete/), [Popover](https://base-ui.com/components/popover/), [Menu](https://base-ui.com/components/menu/), [Tooltip](https://base-ui.com/components/tooltip/), [Button](https://base-ui.com/components/button/), and [Separator](https://base-ui.com/components/separator/).
- **Task 12 filesystem requests**: keep request/update semantics custom, but use [Base UI Button](https://base-ui.com/components/button/), [Dialog](https://base-ui.com/components/dialog/), and [Tooltip](https://base-ui.com/components/tooltip/) for generic action/confirmation affordances where needed.
- **Task 13 terminal surfaces**: use [Base UI Scroll Area](https://base-ui.com/components/scroll-area/), [Collapsible](https://base-ui.com/components/collapsible/), [Button](https://base-ui.com/components/button/), and [Separator](https://base-ui.com/components/separator/) around the custom incremental terminal renderer.
- **Custom-only exclusions**: do not use Base UI as a substitute for task 6 virtualization core, task 7 ACP message/content rendering, most of task 8 composer state orchestration, or task 12 ACP request-state semantics.

### Definition of Done (verifiable conditions with commands)
- `pnpm install` succeeds from repo root.
- `pnpm build` succeeds for all workspace packages/apps.
- `pnpm test` succeeds for core and React library tests.
- `pnpm perf:test` succeeds and reports all planned budgets within thresholds.
- `pnpm bundle:check` succeeds with documented size budgets.
- `cargo test --manifest-path crates/acp-bridge/Cargo.toml` succeeds.
- `pnpm --filter @acp/harness build` succeeds.
- Chrome DevTools MCP evidence exists in `.sisyphus/evidence/` for every completed wave before the next wave begins.

### Must Have
- React-only UI package; no Svelte runtime or component reuse.
- SSR-safe library exports with browser-only ACP connection behavior isolated behind client effects/hooks.
- Reuse of the existing ACP websocket/bridge stack where it is framework-agnostic: Rust bridge, generated types, ACP envelope parsing, transport client, session controller, normalization store, and launch preset parsing.
- `useSyncExternalStore` adapter layer for React subscriptions to ACP state.
- `@tanstack/react-virtual`-based thread rendering in v1.
- Base UI primitives adopted everywhere possible for generic controls, overlays, disclosure patterns, and settings/navigation surfaces, with direct official docs links preserved in task references.
- Stable keyed IDs, memoized message rows/cards, and batched React notifications for streamed ACP updates.
- CSS-variable-based theming plus class hooks; no Tailwind dependency.
- Performance budgets with commands for render, memory, and bundle checks.
- Small execution waves with explicit user checkpoint pauses between waves.
- TDD for non-browser/core logic and agent-run browser QA via Chrome DevTools.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No Svelte component porting, no runes-to-hooks mechanical rewrites, and no framework-locking assumptions from the old UI layer.
- No v1 non-virtualized thread implementation.
- No Base UI primitive replacing `@tanstack/react-virtual` as the thread virtualization core.
- No Base UI usage that replaces ACP-specific message/content rendering, normalization logic, or filesystem request semantics.
- No effect-derived state for normalized ACP data.
- No throttling or dropping of ACP receipt itself; only React notification/render cadence may be batched.
- No direct `window`/`document` access in SSR code paths.
- No Tailwind, shadcn codegen dependency, or CSS-in-JS runtime requirement; Base UI must remain the only primitive library added for generic UI surfaces.
- No image/audio ACP rendering in v1.
- No required app shell/sidebar shell in the published package.
- No scope expansion into CI/CD, deployment, hosted services, or unrelated ACP protocol features.

## Verification Strategy
> ZERO HUMAN INTERVENTION for agent-run checks. User checkpoints still happen between waves, but they are not part of task acceptance criteria.
- Test decision: TDD for `acp-chat-core`, store adapters, and other non-browser logic; React Testing Library/Vitest for component integration; Chrome DevTools MCP for harness/browser QA.
- QA policy: Every task includes both happy-path and failure-path evidence. After each wave, pause for user review before starting the next wave.
- Performance policy: Every wave touching render paths must preserve or improve the tracked perf baselines.
- Base UI policy: every adopted Base UI primitive must be verified for SSR safety, CSS-variable theming compatibility, and non-regression against bundle/perf budgets.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

### Performance Budgets
- Streaming render cadence: React subscriber notifications align to a max 16ms cadence; no ACP payloads are dropped.
- Long-thread budget: the canonical 10,000-message replay reaches first interactive virtualized render in under 150ms and remains smooth during scripted scrolling.
- Memory budget: canonical long-session replay must stay under 50 MB net heap growth for the scripted perf run.
- Bundle budget: `@acp/chat-core` ≤ 60 kB gzip and `@acp/chat-react` ≤ 120 kB gzip at release sign-off.

## Execution Strategy
### Parallel Execution Waves
> Each wave is intentionally narrow enough for a checkpoint before the next wave starts.
> Within each wave, independent tasks may run in parallel once their prerequisites land.

Wave 1: foundation, Base UI dependency/doc policy, reuse audit, performance budgets, React store integration

Wave 2: harness shell, SSR boundary, virtualized thread, message/content, basic composer

Wave 3: chain-of-thought/tool surfaces, settings/session list, slash commands/action bars

Wave 4: file-system surfaces, terminal surfaces, packaging/docs/final perf hardening

### Dependency Matrix (full, all tasks)
- 1 blocks 2-14
- 2 blocks 6-14
- 3 blocks 4-14
- 4 blocks 5-14
- 5 blocks 6-14
- 6 blocks 7-14
- 7 blocks 8-14
- 8 blocks 9-14
- 9 blocks 10-14
- 10 blocks 11-14
- 11 blocks 12-14
- 12 blocks 14
- 13 blocks 14

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 4 tasks → `unspecified-high`, `deep`
- Wave 2 → 4 tasks → `unspecified-high`, `visual-engineering`
- Wave 3 → 3 tasks → `visual-engineering`, `deep`
- Wave 4 → 3 tasks → `deep`, `visual-engineering`, `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.
> After every wave, present evidence and stop for user approval before starting the next wave.

- [x] 1. Scaffold the React monorepo and strict workspace foundation

  **What to do**: Create a pnpm workspace with `packages/acp-chat-core`, `packages/acp-chat-react`, `apps/harness`, and `crates/acp-bridge`. Keep Vite, Vitest, and strict TypeScript from the old repo where they still fit. Add React 18.3+/19-compatible peer dependency ranges, React Testing Library, the official Base UI React dependency set needed by this plan, and root scripts for `build`, `test`, `perf:test`, `bundle:check`, `dev:harness`, and `dev:bridge`. Preserve the existing `data-acp-*` selector convention as a documented contract, and establish Base UI as the only generic primitive library allowed in the React package.
  **Must NOT do**: Do not add Svelte packages, Tailwind, Storybook, server components, CI workflows, or any source implementation beyond workspace/tooling scaffolding. Do not add a second primitive library beside Base UI.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Cross-cutting workspace setup touches package boundaries, build tooling, test tooling, and publish configuration.
  - Skills: [] — Base workspace planning does not require a special skill.
  - Omitted: [`frontend-design`] — No UI styling decisions belong in this task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2-14 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/pnpm-workspace.yaml` — Existing monorepo layout worth preserving.
  - `old-acp-svelte-chat-ui/package.json` — Existing workspace script structure and dev dependency baseline.
  - `old-acp-svelte-chat-ui/tsconfig.json` — Existing strict TypeScript/project-reference model.
  - `old-acp-svelte-chat-ui/vitest.config.ts` — Existing test runner configuration style.
  - `https://base-ui.com/components/button/` — Base UI button primitive for generic actions used later in tasks 5, 8, 11, 12, and 13.
  - `https://base-ui.com/components/popover/` — Base UI overlay positioning primitive used later for slash suggestions and anchored controls.
  - `https://base-ui.com/components/menu/` — Base UI generic menu primitive for message actions and settings menus.
  - `https://base-ui.com/components/context-menu/` — Base UI contextual action primitive for right-click/long-press surfaces.
  - `https://base-ui.com/components/autocomplete/` — Base UI autocomplete primitive for slash-command suggestions.
  - `https://base-ui.com/components/select/` — Base UI select primitive for settings/model/mode selectors.
  - `https://base-ui.com/components/checkbox/` — Base UI checkbox primitive for settings/config options.
  - `https://base-ui.com/components/switch/` — Base UI switch primitive for settings toggles.
  - `https://base-ui.com/components/tabs/` — Base UI tabs primitive for settings sections and shell organization.
  - `https://base-ui.com/components/dialog/` — Base UI dialog primitive for generic confirmations.
  - `https://base-ui.com/components/tooltip/` — Base UI tooltip primitive for icon/action affordances.
  - `https://base-ui.com/components/separator/` — Base UI separator primitive for settings/action grouping.
  - `https://base-ui.com/components/scroll-area/` — Base UI scroll-area primitive for non-virtualized scroll surfaces and optional wrappers around virtualized viewports.
  - `https://base-ui.com/components/collapsible/` — Base UI collapsible primitive for thought/tool and terminal disclosure.
  - `https://base-ui.com/components/toolbar/` — Base UI toolbar primitive for composer and shell action rows.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm install` succeeds from repo root.
  - [ ] `pnpm build` succeeds with stub outputs for `@acp/chat-core`, `@acp/chat-react`, and `@acp/harness`.
  - [ ] `pnpm test` succeeds with at least one smoke test in both `packages/acp-chat-core` and `packages/acp-chat-react`.
  - [ ] `cargo test --manifest-path crates/acp-bridge/Cargo.toml` succeeds.
  - [ ] Workspace docs/config clearly establish Base UI as the standard primitive library for the React package and do not add competing primitive systems.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Workspace bootstraps cleanly
    Tool: Bash
    Steps: Run `pnpm install && pnpm build && pnpm test && cargo test --manifest-path crates/acp-bridge/Cargo.toml` from repo root.
    Expected: All commands exit 0 and all workspace packages are discovered correctly.
    Evidence: .sisyphus/evidence/task-1-workspace-smoke.txt

  Scenario: Out-of-scope tooling stays absent
    Tool: Bash
    Steps: Run `test ! -d .storybook && test ! -e tailwind.config.js && test ! -d .github/workflows` from repo root.
    Expected: Command exits 0, confirming Storybook, Tailwind, and CI scaffolding were not added.
    Evidence: .sisyphus/evidence/task-1-scope-guard.txt
  ```

  **Commit**: YES | Message: `chore(workspace): scaffold react monorepo foundation` | Files: `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `vitest.config.ts`, `packages/*`, `apps/harness/*`, `crates/acp-bridge/*`

- [x] 2. Establish explicit performance budgets and perf verification tooling

  **What to do**: Add local-only performance infrastructure before React UI work begins. Define budget scripts and fixtures for render time, streaming update cadence, memory growth, and bundle size. Require commands `pnpm perf:test` and `pnpm bundle:check`. Capture baseline fixture-driven measurements so later waves can prove they did not regress performance. Ensure bundle checks explicitly catch Base UI tree-shaking failures or accidental broad imports before component-heavy waves begin.
  **Must NOT do**: Do not guess at “fast enough”, do not defer perf tooling to the release wave, do not add hosted/CI perf infrastructure, and do not leave Base UI bundle impact unmeasured until the release wave.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: Performance budgets and measurement harness shape all later implementation decisions.
  - Skills: [`debugging-strategies`] — Useful for choosing deterministic perf evidence and failure-path checks.
  - Omitted: [`frontend-design`] — This task is measurement infrastructure, not UI work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6-14 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/fixtures/sample-replay.jsonl` — Existing replay fixture model to reuse for deterministic perf runs.
  - `https://react.dev/reference/react/memo` — Official memoization guidance to align budgets with render boundaries.
  - `https://react.dev/reference/react/useSyncExternalStore` — Official guidance for external-store subscriptions that affect render cadence.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm perf:test` succeeds and reports render, memory, and streaming cadence budgets.
  - [ ] `pnpm bundle:check` succeeds with documented size thresholds for `@acp/chat-core` and `@acp/chat-react`.
  - [ ] A replay fixture can be reused by the perf harness without requiring a live ACP process.
  - [ ] Bundle checks fail loudly if Base UI usage pulls in unplanned primitives or exceeds the package-level gzip budgets.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Perf scripts produce reproducible local evidence
    Tool: Bash
    Steps: Run `pnpm perf:test && pnpm bundle:check` twice from repo root using the same replay fixture.
    Expected: Both runs exit 0 and generate comparable evidence artifacts with no missing metrics.
    Evidence: .sisyphus/evidence/task-2-perf-baseline.txt

  Scenario: Budget failure is visible and blocks progress
    Tool: Bash
    Steps: Run the perf suite against a deliberately over-budget fixture or threshold override.
    Expected: The command exits non-zero and prints which budget failed.
    Evidence: .sisyphus/evidence/task-2-perf-baseline-error.txt
  ```

  **Commit**: YES | Message: `test(perf): add local performance budgets and checks` | Files: `perf/*`, `fixtures/*`, `package.json`, `scripts/*`

- [x] 3. Reuse and harden the framework-agnostic ACP core

  **What to do**: Port or copy the reusable ACP core from `old-acp-svelte-chat-ui` into `packages/acp-chat-core`: generated bridge types, envelope parser, transport client, session controller, normalization store, launch presets, and any pure helper logic currently trapped in the old Svelte package. Preserve behavior while moving reusable helper logic into framework-agnostic locations where needed.
  **Must NOT do**: Do not port any `.svelte` file, do not copy framework-coupled harness code into the package, and do not change ACP semantics during this reuse pass.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: This task defines the reuse boundary and must preserve ACP behavior exactly.
  - Skills: [] — Protocol and code-reading discipline matter more than a specialized skill.
  - Omitted: [`frontend-design`] — No component rendering belongs here.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4-14 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/generated/BridgeEnvelope.ts` — Reusable bridge envelope typing.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/bridge/parser.ts` — Reusable ACP envelope parsing/version checks.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/transport/client.ts` — Reusable WebSocket transport logic.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/session/controller.ts` — Reusable ACP JSON-RPC session logic.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/normalization/store.ts` — Reusable normalization model and update application logic.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/presets/launch.ts` — Reusable launch preset parsing.
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/composer/composer-logic.ts` — Pure helper candidate to relocate.
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/thought/thought-stack-logic.ts` — Pure helper candidate to relocate.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run bridge-contract` succeeds.
  - [ ] `pnpm test -- --run session-controller` succeeds.
  - [ ] `pnpm test -- --run normalization` succeeds.
  - [ ] No Svelte runtime import exists under `packages/acp-chat-core`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Reused ACP core passes parity tests
    Tool: Bash
    Steps: Run `pnpm test -- --run bridge-contract && pnpm test -- --run session-controller && pnpm test -- --run normalization`.
    Expected: All targeted tests pass, proving the reused ACP core still behaves correctly.
    Evidence: .sisyphus/evidence/task-3-core-reuse.txt

  Scenario: Framework leakage is rejected
    Tool: Bash
    Steps: Run a search that fails if `svelte` imports or `.svelte` references appear under `packages/acp-chat-core`.
    Expected: Search returns no matches.
    Evidence: .sisyphus/evidence/task-3-core-reuse-error.txt
  ```

  **Commit**: YES | Message: `feat(core): reuse framework-agnostic acp core` | Files: `packages/acp-chat-core/src/*`

- [x] 4. Build the React ACP store adapter and batched notification layer

  **What to do**: Wrap the reused ACP core with a React-specific adapter built around `useSyncExternalStore`. Add a stable store instance, selective snapshot APIs, and React-notification batching that aligns streaming updates to render cadence without delaying ACP receipt. Establish the official React hook surfaces that later UI tasks consume.
  **Must NOT do**: Do not use effect-derived mirrored state, do not add Zustand/Jotai unless this plan is explicitly changed, and do not throttle or drop raw ACP events.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: This is the most important React architectural seam and directly impacts performance.
  - Skills: [] — Official React patterns should drive the implementation.
  - Omitted: [`ts-bug-fixer`] — Types should follow the store contract by design.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5-14 | Blocked By: 1, 3

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/transport/client.ts` — Transport events that must feed the adapter.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/session/controller.ts` — Existing session lifecycle and event interface.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/normalization/store.ts` — Existing normalized state shape.
  - `https://react.dev/reference/react/useSyncExternalStore` — Required subscription model.
  - `https://react.dev/learn/you-might-not-need-an-effect` — Guardrail against mirrored/derived state effects.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run react-store-adapter` succeeds.
  - [ ] `pnpm perf:test -- --scenario streaming-store` succeeds and proves render notifications stay within the configured cadence budget.
  - [ ] Server-side snapshot tests succeed without `window` or `document` access.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Streamed ACP updates reach React through the external store
    Tool: Bash
    Steps: Run the adapter integration test and the streaming-store perf scenario.
    Expected: ACP updates are processed immediately, React subscribers update on the planned cadence, and no event loss is reported.
    Evidence: .sisyphus/evidence/task-4-react-store.txt

  Scenario: SSR snapshot path is browser-safe
    Tool: Bash
    Steps: Run the SSR-oriented test suite for the React store adapter in a Node environment.
    Expected: Tests pass without `window`/`document` access or hydration snapshot mismatches.
    Evidence: .sisyphus/evidence/task-4-react-store-error.txt
  ```

  **Commit**: YES | Message: `feat(react): add useSyncExternalStore acp adapter` | Files: `packages/acp-chat-react/src/store/*`, `packages/acp-chat-react/src/hooks/*`, `packages/acp-chat-core/src/*`

- [x] 5. Build the SSR-safe React harness and client boundary shell

  **What to do**: Create a Vite + React harness that can load replay or live ACP bridge sessions and cleanly separates SSR-safe package code from browser-only runtime behavior. Add route/state structure for session source selection, diagnostics, and perf display. Use Base UI primitives wherever the harness needs generic shell chrome or controls: Button for actions, Tabs for panel grouping, Toolbar for action rows, Popover/Dialog for anchored or modal utility surfaces, Tooltip for compact affordances, and Separator for layout divisions. The harness should exercise the same exported library APIs that consumers will use.
  **Must NOT do**: Do not make the harness a dependency of the published package, do not put browser-only ACP logic in shared package entry points, and do not add feature surfaces not yet planned.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: This is the integration shell for all later browser QA and needs correct package/runtime boundaries.
  - Skills: [] — This is app wiring, not visual polish.
  - Omitted: [`frontend-design`] — Harness utility matters more than aesthetics here.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 6-14 | Blocked By: 4

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/apps/harness/package.json` — Prior harness package boundary.
  - `old-acp-svelte-chat-ui/scripts/debug.sh` — Existing bridge/harness local workflow.
  - `https://react.dev/reference/react/useSyncExternalStore` — Library-side boundary expectations for external state.
  - `https://base-ui.com/components/button/` — Use for generic harness actions and shell controls.
  - `https://base-ui.com/components/tabs/` — Use for SSR-safe panel grouping where tabs are helpful.
  - `https://base-ui.com/components/toolbar/` — Use for shell action rows instead of custom toolbar markup.
  - `https://base-ui.com/components/popover/` — Use for anchored utility content in harness chrome.
  - `https://base-ui.com/components/dialog/` — Use for generic harness confirmations and modal diagnostics only.
  - `https://base-ui.com/components/tooltip/` — Use for icon-only control affordances.
  - `https://base-ui.com/components/separator/` — Use for section delineation in harness chrome.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @acp/harness build` succeeds.
  - [ ] The harness can switch between replay and live bridge modes without code changes in the library package.
  - [ ] SSR smoke tests for the library entry points succeed.
  - [ ] Harness shell controls use Base UI primitives for generic chrome rather than bespoke overlay/menu/control implementations.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Harness connects to replay and live ACP sources
    Tool: Chrome DevTools MCP
    Steps: Start the bridge and harness, open the harness, switch between replay and live source controls, and inspect the diagnostics region.
    Expected: Both modes initialize correctly, diagnostics are visible, and the library package remains the shared rendering path.
    Evidence: .sisyphus/evidence/task-5-harness-shell.png

  Scenario: Browser-only behavior stays out of SSR path
    Tool: Bash
    Steps: Run the SSR smoke tests for package entry points in Node.
    Expected: Tests pass without `window`/`document` access errors.
    Evidence: .sisyphus/evidence/task-5-harness-shell-error.txt
  ```

  **Commit**: YES | Message: `feat(harness): add react harness shell and runtime boundaries` | Files: `apps/harness/*`, `packages/acp-chat-react/src/index*`

- [x] 6. Build the always-virtualized thread foundation

  **What to do**: Implement the core thread container around `@tanstack/react-virtual`, stable message IDs, viewport tracking, bottom-follow behavior, and dynamic row measurement. This task establishes the permanent thread architecture for v1; every later message surface plugs into this virtualized list rather than replacing it. If a scroll-area primitive is helpful for non-virtualization chrome, use Base UI Scroll Area only as a wrapper around the virtualized viewport, never as the rendering strategy.
  **Must NOT do**: Do not ship a non-virtualized thread path, do not key rows by index, do not auto-scroll when the user has intentionally left the bottom of the thread, and do not let Base UI displace or obscure the `@tanstack/react-virtual` measurement/follow-scroll architecture.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: This is the primary performance-sensitive UI surface.
  - Skills: [`frontend-design`] — Needed to keep the thread usable and readable while still performance-first.
  - Omitted: [`canvas-design`] — Static artwork is irrelevant.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 7-14 | Blocked By: 2, 4, 5

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/thread/Thread.svelte` — Prior scroll/follow behavior to preserve conceptually, not syntactically.
  - `https://react.dev/reference/react/memo` — Memoization requirements for thread rows.
  - `https://react.dev/learn/rendering-lists` — Stable key requirements.
  - `https://tanstack.com/virtual/latest` — Virtualization implementation guidance.
  - `https://base-ui.com/components/scroll-area/` — Optional wrapper primitive only; must not replace virtualization.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run virtualized-thread` succeeds.
  - [ ] `pnpm perf:test -- --scenario virtualized-thread` succeeds within the defined thread/render budgets.
  - [ ] The harness thread uses virtualization for all rendered sessions, including small ones.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Virtualized thread remains responsive during long replay
    Tool: Chrome DevTools MCP
    Steps: Open a harness replay with a long thread, inspect `[data-acp-thread]` and `[data-acp-thread-scroll-viewport]`, then scroll through the list while messages are present.
    Expected: The DOM only contains the virtualized window, scrolling remains smooth, and stable message IDs are preserved.
    Evidence: .sisyphus/evidence/task-6-virtualized-thread.png

  Scenario: Follow-scroll respects user opt-out
    Tool: Chrome DevTools MCP
    Steps: Scroll away from the bottom in `[data-acp-thread-scroll-viewport]`, trigger more streamed content, and observe thread position.
    Expected: New content renders without snapping back to bottom until the user returns.
    Evidence: .sisyphus/evidence/task-6-virtualized-thread-error.png
  ```

  **Commit**: YES | Message: `feat(thread): add always-virtualized thread foundation` | Files: `packages/acp-chat-react/src/thread/*`, `apps/harness/*`

- [x] 7. Build message, content, and update rendering on top of the virtualized thread

  **What to do**: Implement memoized React message cards, content block renderers, update rows, empty states, and layout modes. The component tree must follow the planned Thread → MessageList → MessageCard → ContentBlock split so streaming updates only touch affected rows/blocks.
  **Must NOT do**: Do not duplicate normalization logic in the component layer, do not pass unstable object props that break memoization, and do not render raw unsafe HTML from ACP text payloads.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: This wave defines the main reading experience and its render boundaries.
  - Skills: [`frontend-design`] — Needed for polished but restrained chat presentation.
  - Omitted: [`debugging-strategies`] — Perf budgets already exist; this is primarily rendering work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 8-14 | Blocked By: 6

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/message/MessageCard.svelte` — Prior message semantics and data selectors.
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/content/*` — Content renderer grouping to preserve conceptually.
  - `https://agentclientprotocol.com/protocol/content.md` — ACP content model.
  - `https://react.dev/reference/react/memo` — Required render memoization pattern.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run message-rendering` succeeds.
  - [ ] `pnpm perf:test -- --scenario message-streaming` succeeds without exceeding render cadence budgets.
  - [ ] The harness renders user, agent, resource, and update content using stable row/block selectors.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Streamed message rows update in place
    Tool: Chrome DevTools MCP
    Steps: Open a replay with chunked agent output, inspect `[data-acp-thread]`, `[data-acp-message-role="agent"]`, and the relevant content block selectors while chunks arrive.
    Expected: Only the affected message row updates in place; prior rows do not remount or flash.
    Evidence: .sisyphus/evidence/task-7-message-rendering.png

  Scenario: Unsafe or unsupported content fails safely
    Tool: Chrome DevTools MCP
    Steps: Load a replay containing unsupported/unsafe content and inspect the rendered content area.
    Expected: The UI renders a safe fallback or plaintext-safe representation without injecting raw HTML.
    Evidence: .sisyphus/evidence/task-7-message-rendering-error.png
  ```

  **Commit**: YES | Message: `feat(ui): add message content and update rendering` | Files: `packages/acp-chat-react/src/message/*`, `packages/acp-chat-react/src/content/*`, `packages/acp-chat-react/src/update/*`

- [x] 8. Build the basic composer send/stop flow for React

  **What to do**: Implement the React composer with controlled input state, send/stop controls, composition-event handling, keyboard behavior, and clean wiring to the ACP session controller. Reuse any safe pure helper logic from the old composer while keeping local input state local to the composer surface. Use Base UI Button for generic send/stop affordances and Base UI Toolbar for any non-thread action row structure if it improves semantics without creating extra render churn.
  **Must NOT do**: Do not globalize transient input state, do not add slash commands/settings panels yet, do not allow the composer to break virtualization or overlap thread content, and do not let Base UI abstractions absorb ACP-specific input orchestration/state rules.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: This is a focused input interaction wave with UX and state details.
  - Skills: [`frontend-design`] — Needed for pinned layout and input ergonomics.
  - Omitted: [`code-runner`] — Harness/browser QA already covers interaction.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 9-14 | Blocked By: 4, 7

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/composer/Composer.svelte` — Prior behavior to preserve conceptually.
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/composer/composer-logic.ts` — Pure helper logic candidate for reuse.
  - `https://agentclientprotocol.com/protocol/prompt-turn.md` — ACP prompt/cancel semantics.
  - `https://react.dev/reference/react-dom/components/textarea` — Controlled input behavior in React.
  - `https://base-ui.com/components/button/` — Use for generic send/stop button primitives.
  - `https://base-ui.com/components/toolbar/` — Use for non-thread composer action row structure if needed.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run composer-basic` succeeds.
  - [ ] The harness can send one prompt and stop an active turn through the React composer.
  - [ ] Composer interaction does not cause thread scroll jumps outside the planned follow-scroll behavior.
  - [ ] Composer send/stop controls use Base UI button primitives unless a documented ACP-specific limitation prevents it.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Composer sends and clears correctly
    Tool: Chrome DevTools MCP
    Steps: Focus `[data-acp-composer-input]`, type a prompt, submit with Enter, and inspect the resulting thread/update state.
    Expected: The prompt is sent exactly once, input state clears correctly, and agent output begins streaming.
    Evidence: .sisyphus/evidence/task-8-composer-basic.png

  Scenario: Stop ends the active turn without corrupting state
    Tool: Chrome DevTools MCP
    Steps: Start a long-running prompt, click `[data-acp-stop-button]`, and inspect thread plus diagnostics.
    Expected: The active turn cancels cleanly, partial output remains visible, and no duplicate trailing chunks appear.
    Evidence: .sisyphus/evidence/task-8-composer-basic-error.png
  ```

  **Commit**: YES | Message: `feat(composer): add react basic composer` | Files: `packages/acp-chat-react/src/composer/*`, `apps/harness/*`

- [x] 9. Build chain-of-thought and tool-call surfaces with React-specific render isolation

  **What to do**: Implement thought-stack, reasoning blocks, and tool-call surfaces as isolated memoized subtrees that subscribe only to the data they need. Reuse pure grouping logic where possible, but rewrite the component model for React so active/completed transitions do not churn unrelated thread rows. Use Base UI Collapsible for expandable thought/tool sections, plus Base UI Tooltip, Menu, Context Menu, and Separator wherever generic disclosure/contextual controls are needed.
  **Must NOT do**: Do not expose raw ACP payload JSON by default, do not keep completed sections permanently expanded unless configured, do not entangle thought/tool rendering with the composer, and do not replace ACP-specific content structure with generic Base UI content containers.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: This is nested, stateful UI that must stay performant under live updates.
  - Skills: [`frontend-design`] — Needed for readable hierarchy and state affordances.
  - Omitted: [`canvas-design`] — Not relevant.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 10-14 | Blocked By: 7, 8

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/thought/ThoughtStack.svelte` — Prior thought UI semantics.
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/thought/thought-stack-logic.ts` — Pure grouping logic candidate.
  - `https://agentclientprotocol.com/protocol/prompt-turn.md` — Thought/update lifecycle behavior.
  - `https://agentclientprotocol.com/protocol/tool-calls.md` — Tool-call lifecycle behavior.
  - `https://base-ui.com/components/collapsible/` — Required disclosure primitive for thought/tool sections.
  - `https://base-ui.com/components/tooltip/` — Use for icon/action affordances within thought/tool surfaces.
  - `https://base-ui.com/components/menu/` — Use for generic overflow/contextual action menus.
  - `https://base-ui.com/components/context-menu/` — Use for right-click/secondary thought/tool actions if exposed.
  - `https://base-ui.com/components/separator/` — Use for visual grouping inside thought/tool cards.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run thought-tool-surfaces` succeeds.
  - [ ] `pnpm perf:test -- --scenario thought-updates` succeeds within the planned render budgets.
  - [ ] The harness can show active and completed thought/tool sections with stable selectors.
  - [ ] Thought/tool disclosure uses Base UI Collapsible rather than bespoke expand/collapse primitives.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Active thought sections update without remounting thread rows
    Tool: Chrome DevTools MCP
    Steps: Open a replay with thought/tool updates, inspect `[data-acp-thought-root]` and adjacent message rows while updates stream.
    Expected: Thought/tool surfaces update in place and unrelated rows remain stable.
    Evidence: .sisyphus/evidence/task-9-thought-tool.png

  Scenario: Completed sections collapse or persist only per config
    Tool: Chrome DevTools MCP
    Steps: Run a replay from active to complete state, toggle the configured visibility behavior, and inspect the resulting state.
    Expected: Completed sections follow configuration and no section gets stuck open/closed unexpectedly.
    Evidence: .sisyphus/evidence/task-9-thought-tool-error.png
  ```

  **Commit**: YES | Message: `feat(ui): add thought and tool call surfaces` | Files: `packages/acp-chat-react/src/thought/*`, `packages/acp-chat-react/src/tool-call/*`

- [x] 10. Build the settings panel API and standalone session-list surface

  **What to do**: Add a React-native settings panel API with render props/slots for consumer-owned settings content, plus a standalone session-list component that can be used in a sidebar but does not require a packaged shell. Keep session list, model/mode selection, and generic config-option rendering composable and separately memoized. Use Base UI Select, Checkbox, Switch, Tabs, Button, Separator, Scroll Area, Menu, and Context Menu wherever those semantics match the settings/session-list surface.
  **Must NOT do**: Do not hardwire one settings layout, do not make the session list depend on a shell component, do not place session data in hidden component-local stores that bypass the planned ACP state adapter, and do not build bespoke select/checkbox/switch/tab primitives when Base UI already covers the need.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: This wave is API + layout composition with stateful selection surfaces.
  - Skills: [`frontend-design`] — Needed for a clean, flexible layout contract.
  - Omitted: [`pptx`] — Irrelevant.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 11-14 | Blocked By: 8, 9

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/settings/*` — Prior settings component grouping.
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/session-list/*` — Prior session-list grouping.
  - `https://agentclientprotocol.com/protocol/session-config-options.md` — Config option semantics.
  - `https://agentclientprotocol.com/protocol/session-list.md` — Session list semantics.
  - `https://base-ui.com/components/select/` — Required for model/mode/session selectors.
  - `https://base-ui.com/components/checkbox/` — Required for boolean settings options represented as checkboxes.
  - `https://base-ui.com/components/switch/` — Required for boolean settings options represented as switches.
  - `https://base-ui.com/components/tabs/` — Use for settings section organization where tabs improve composition.
  - `https://base-ui.com/components/button/` — Use for generic settings/session actions.
  - `https://base-ui.com/components/separator/` — Use for section grouping within settings/session surfaces.
  - `https://base-ui.com/components/scroll-area/` — Use for session list or settings subpanels that need independent scrolling.
  - `https://base-ui.com/components/menu/` — Use for generic menu-based settings actions.
  - `https://base-ui.com/components/context-menu/` — Use for session-list contextual actions if present.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run settings-session-list` succeeds.
  - [ ] The harness can swap consumer-provided settings content without breaking the composer or thread.
  - [ ] The session-list component works as a standalone export without a packaged shell wrapper.
  - [ ] Settings/session-list surfaces use Base UI primitives for select, checkbox, switch, tab, menu, and scroll-area needs instead of bespoke equivalents.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Custom settings content renders through the public API
    Tool: Chrome DevTools MCP
    Steps: Open the harness route that injects custom settings content and inspect `[data-acp-settings-panel]`.
    Expected: Consumer content renders correctly and layout remains stable.
    Evidence: .sisyphus/evidence/task-10-settings-session-list.png

  Scenario: Standalone session list works without a shell
    Tool: Chrome DevTools MCP
    Steps: Load the harness route mounting only `[data-acp-session-list]` in a plain container and switch sessions.
    Expected: Session selection works and no packaged shell dependency exists.
    Evidence: .sisyphus/evidence/task-10-settings-session-list-error.png
  ```

  **Commit**: YES | Message: `feat(ui): add settings api and standalone session list` | Files: `packages/acp-chat-react/src/settings/*`, `packages/acp-chat-react/src/session-list/*`, `apps/harness/*`

- [x] 11. Build slash-command and message action surfaces without breaking render budgets

  **What to do**: Implement slash-command autocomplete in the React composer and message action surfaces for copy/consumer-defined actions. Keep both surfaces isolated from the core thread render path so toggling menus or hover/focus states does not force large list rerenders. Use Base UI Autocomplete for slash suggestions, Popover for anchored suggestion placement where needed, and Base UI Menu/Tooltip/Button/Separator for message action affordances.
  **Must NOT do**: Do not turn slash commands into a plugin system, do not hardcode business-specific actions, do not introduce unstable callback props that defeat memoization, and do not implement bespoke autocomplete/menu primitives where Base UI already satisfies the interaction.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: These are interaction-heavy surfaces with strong performance sensitivity.
  - Skills: [`frontend-design`] — Needed for polished interaction and focus management.
  - Omitted: [`langgraph-docs`] — Not relevant.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 12-14 | Blocked By: 8, 10

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/slash/*` — Prior slash-command UI grouping.
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/src/lib/actions/*` — Prior action surface grouping.
  - `https://agentclientprotocol.com/protocol/prompt-turn.md` — Slash-command relevance to prompt flow.
  - `https://react.dev/reference/react/useCallback` — Stable callback guardrail for memoized children.
  - `https://base-ui.com/components/autocomplete/` — Required primitive for slash-command suggestion input/list behavior.
  - `https://base-ui.com/components/popover/` — Use if an anchored overlay is needed around autocomplete or action content.
  - `https://base-ui.com/components/menu/` — Required primitive for message action menus.
  - `https://base-ui.com/components/tooltip/` — Use for compact action affordances and keyboard hints.
  - `https://base-ui.com/components/button/` — Use for icon/text action triggers.
  - `https://base-ui.com/components/separator/` — Use for action grouping.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run slash-and-actions` succeeds.
  - [ ] `pnpm perf:test -- --scenario composer-actions` succeeds within render budgets.
  - [ ] The harness supports slash suggestions and message actions without triggering thread-wide rerenders.
  - [ ] Slash suggestions are implemented with Base UI Autocomplete and message action menus use Base UI menu primitives rather than bespoke equivalents.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Slash suggestions insert exactly once
    Tool: Chrome DevTools MCP
    Steps: Focus `[data-acp-composer-input]`, type `/`, choose a suggestion from `[data-acp-slash-popover]`, and inspect the composer state.
    Expected: The selected command inserts exactly once and the popover closes cleanly.
    Evidence: .sisyphus/evidence/task-11-slash-actions.png

  Scenario: Message actions stay isolated from list rerenders
    Tool: Chrome DevTools MCP
    Steps: Trigger `[data-acp-message-action-bar]` on one message while observing adjacent rows in the virtualized thread.
    Expected: The target row updates interaction state without causing visible rerenders of unrelated rows.
    Evidence: .sisyphus/evidence/task-11-slash-actions-error.png
  ```

  **Commit**: YES | Message: `feat(ui): add slash commands and message actions` | Files: `packages/acp-chat-react/src/slash/*`, `packages/acp-chat-react/src/actions/*`, `packages/acp-chat-react/src/composer/*`

- [ ] 12. Build file-system request surfaces on top of consumer hooks

  **What to do**: Implement file-system request/update rendering with consumer-owned hook resolution (`fulfill`, `skip`, `deny`) and ACP-safe state propagation. Keep the request UI visible in the harness and library while leaving actual file access to the consuming app. Keep the request/update semantics custom, but use Base UI Button for generic action controls plus Base UI Dialog/Tooltip only where those improve confirmations or compact affordances without hiding ACP state.
  **Must NOT do**: Do not add direct browser file-system access, do not assume every consumer can satisfy a request, do not couple these flows to terminal rendering, and do not replace ACP-specific request-state rendering with a generic Base UI abstraction.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: This crosses ACP semantics, consumer hook contracts, and UI state transitions.
  - Skills: [] — Protocol discipline is the main requirement.
  - Omitted: [`frontend-design`] — UX matters, but contract correctness dominates.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: 14 | Blocked By: 9, 10, 11

  **References** (executor has NO interview context — be exhaustive):
  - `https://agentclientprotocol.com/protocol/file-system.md` — ACP file-system semantics.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/normalization/store.ts` — Existing normalized event handling to extend carefully.
  - `https://base-ui.com/components/button/` — Use for generic fulfill/skip/deny action primitives.
  - `https://base-ui.com/components/dialog/` — Use only for generic confirmations if a confirmation step is required.
  - `https://base-ui.com/components/tooltip/` — Use for compact affordances or clarification text.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run filesystem-hooks` succeeds.
  - [ ] The harness can render a file-system request and resolve it through `fulfill`, `skip`, and `deny` consumer hook outcomes.
  - [ ] File-system UI does not break thread rendering, composer behavior, or store perf budgets.
  - [ ] File-system action controls use Base UI button/dialog/tooltip primitives only for generic affordances while keeping ACP request-state rendering custom.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: File-system request resolves through consumer hooks
    Tool: Chrome DevTools MCP
    Steps: Open a replay/live flow that triggers a file-system request, inspect `[data-acp-filesystem-request]`, and resolve it through each hook path.
    Expected: Fulfill/skip/deny all produce visible, correct outcome states without freezing the session.
    Evidence: .sisyphus/evidence/task-12-filesystem.png

  Scenario: Unsupported consumer capability fails gracefully
    Tool: Chrome DevTools MCP
    Steps: Run the same request with the hook intentionally unimplemented or rejecting.
    Expected: The UI shows a clear failure/denied state and preserves prior context.
    Evidence: .sisyphus/evidence/task-12-filesystem-error.png
  ```

  **Commit**: YES | Message: `feat(core): add filesystem request hook surfaces` | Files: `packages/acp-chat-core/src/hooks/*`, `packages/acp-chat-react/src/filesystem/*`, `apps/harness/*`

- [ ] 13. Build terminal rendering surfaces with bounded output and isolated updates

  **What to do**: Implement terminal request/output rendering with bounded retained output, completion state, and expand/collapse behavior. Terminal updates should append incrementally without causing broad thread rerenders, and the retained output policy must be explicit and measurable. Use Base UI Scroll Area, Collapsible, Button, and Separator around the custom terminal renderer wherever generic scroll/disclosure/action semantics apply.
  **Must NOT do**: Do not build a full terminal emulator, do not allow unbounded buffer growth, do not merge terminal logic into unrelated file-system or message-rendering code, and do not let Base UI abstractions obscure the retained-output policy or incremental append behavior.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: This is live-output rendering with strong UX and performance requirements.
  - Skills: [`frontend-design`] — Needed for readable live terminal presentation.
  - Omitted: [`code-runner`] — The harness and replay fixtures are the verification path.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: 14 | Blocked By: 9, 11

  **References** (executor has NO interview context — be exhaustive):
  - `https://agentclientprotocol.com/protocol/terminals.md` — ACP terminal lifecycle semantics.
  - `old-acp-svelte-chat-ui/packages/acp-chat-core/src/normalization/store.ts` — Existing normalization shape that terminal support must extend coherently.
  - `https://base-ui.com/components/scroll-area/` — Required primitive for terminal viewport scrolling.
  - `https://base-ui.com/components/collapsible/` — Required primitive for expandable terminal sections.
  - `https://base-ui.com/components/button/` — Use for terminal actions.
  - `https://base-ui.com/components/separator/` — Use for terminal section grouping.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm test -- --run terminals` succeeds.
  - [ ] `pnpm perf:test -- --scenario terminals` succeeds within the terminal/render budgets.
  - [ ] The harness can show live terminal output, bounded history, and completion state without disturbing the main thread.
  - [ ] Terminal chrome uses Base UI Scroll Area/Collapsible/Button/Separator while retaining a custom incremental output renderer.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Terminal output streams incrementally with bounded history
    Tool: Chrome DevTools MCP
    Steps: Open a replay/live flow with terminal output, inspect `[data-acp-terminal-root]`, and observe output growth over time.
    Expected: Output appends incrementally, remains readable, and respects the configured history cap.
    Evidence: .sisyphus/evidence/task-13-terminal.png

  Scenario: Long output does not blow up layout or memory policy
    Tool: Chrome DevTools MCP
    Steps: Load a long-output fixture and inspect the terminal panel after completion.
    Expected: The panel remains usable, bounded, and clearly indicates retained-versus-truncated output policy.
    Evidence: .sisyphus/evidence/task-13-terminal-error.png
  ```

  **Commit**: YES | Message: `feat(ui): add terminal rendering surfaces` | Files: `packages/acp-chat-react/src/terminal/*`, `packages/acp-chat-core/src/models/*`, `apps/harness/*`

- [ ] 14. Harden packaging, docs, and final performance validation for release readiness

  **What to do**: Finalize package exports, CSS asset distribution, README/API docs, replay examples, consumer styling guidance, and final performance hardening. Re-run all build/test/perf/bundle checks, capture integrated browser evidence, and document the intentional reuse boundary so future work does not regress into Svelte-era assumptions. Explicitly document the Base UI adoption boundary, the official Base UI component docs used by the library, and the custom-only exclusions where Base UI must not replace ACP-specific architecture.
  **Must NOT do**: Do not expand scope to CI/CD, deployment, hosted demos, or new ACP features not already in this plan.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Final hardening spans packaging, docs, perf evidence, and integration reliability.
  - Skills: [`debugging-strategies`] — Needed for final regression and failure-path hardening.
  - Omitted: [`bifrost-saga-creation`] — This plan already defines execution tracking.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: F1-F4 | Blocked By: 1-13

  **References** (executor has NO interview context — be exhaustive):
  - `old-acp-svelte-chat-ui/packages/acp-chat-svelte/README.md` — Prior theming/selector documentation to preserve conceptually.
  - `https://react.dev/reference/react/useSyncExternalStore` — Reconfirm exported hook guidance before release.
  - `https://react.dev/reference/react/memo` — Reconfirm memoization guardrails before perf sign-off.
  - `https://tanstack.com/virtual/latest` — Reconfirm virtualization guidance before release hardening.
  - `https://base-ui.com/components/` — Base UI component index for release docs cross-linking.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm build && pnpm test && pnpm perf:test && pnpm bundle:check && cargo test --manifest-path crates/acp-bridge/Cargo.toml` all succeed.
  - [ ] `pnpm --filter @acp/harness build` succeeds.
  - [ ] `.sisyphus/evidence/` contains final integrated screenshots/logs for every completed wave plus final release evidence.
  - [ ] Package docs explain SSR safety, virtualization assumptions, reuse boundaries, CSS variables, and consumer override APIs.
  - [ ] Package docs explain which surfaces use Base UI primitives, link to the official Base UI docs for those primitives, and document the custom-only exclusions for thread virtualization and ACP-specific rendering.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Final integrated React library passes full local release checklist
    Tool: Bash + Chrome DevTools MCP
    Steps: Run the full command checklist, then open the harness and exercise thread, composer, thought/tool, settings, slash/actions, filesystem, and terminal surfaces.
    Expected: All commands pass, all major surfaces function together, and final evidence artifacts are captured.
    Evidence: .sisyphus/evidence/task-14-release-ready.png

  Scenario: Failure paths remain recoverable under final build
    Tool: Chrome DevTools MCP
    Steps: Interrupt the bridge, trigger denied filesystem hooks, and load malformed/over-budget fixtures.
    Expected: The UI shows clear recoverable failure states, keeps prior context intact, and surfaces perf/budget failures explicitly.
    Evidence: .sisyphus/evidence/task-14-release-ready-error.png
  ```

  **Commit**: YES | Message: `chore(release): harden react library packaging and perf evidence` | Files: `packages/acp-chat-react/package.json`, `packages/acp-chat-react/README.md`, `packages/acp-chat-core/README.md`, `apps/harness/*`, `.sisyphus/evidence/*`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ chrome-devtools for UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit at task boundaries with conventional commits and explicit scopes.
- Do not bundle unrelated foundation, render, and feature work into the same commit.
- Preserve a visible split between reused ACP core work and fresh React UI work.

## Success Criteria
- The published React package is SSR-safe, framework-agnostic at the package boundary, and does not leak browser-only behavior outside client hooks.
- The ACP websocket/bridge stack is reused where safe, while every UI surface is implemented as React-native architecture rather than a Svelte translation.
- Long chat threads remain responsive under virtualization and streamed updates, with measured budgets captured in evidence.
- Consumers can style the library with shipped CSS variables/class hooks and can replace key renderers without forking core state logic.
- The work proceeds in small waves with agent evidence plus user checkpoints between waves.
