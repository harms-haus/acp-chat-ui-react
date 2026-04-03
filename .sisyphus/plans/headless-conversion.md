# Headless ACP Chat Conversion

## TL;DR
> **Summary**: Convert acp-chat-react from inline-styled components to completely headless library with CSS variable-based styling, pluggable height estimation (pretext default), and injectable browser APIs. acp-chat-core is already headless.
> **Deliverables**: 
> - CSS variable contract documentation
> - Height estimator plugin interface with pretext default
> - Browser API abstraction layer (clipboard, ResizeObserver, RAF)
> - All inline styles removed from components
> - Migration guide for consumers
> **Effort**: Large (8 waves, 42 tasks)
> **Parallel**: YES - 8 waves with 4-7 tasks each
> **Critical Path**: CSS variables → Height estimation → Browser APIs → Component cleanup → Testing

## Context
### Original Request
Investigate ACP client packages (`acp-chat-core`, `acp-chat-react`) and identify ways to make them completely headless. Support React patterns with event-driven rendering, height recalculation triggers, and pretext as pluggable render sizer. Ensure Harness UI properly styles the library.

### Interview Summary
User wants:
- `acp-chat-core`: Already headless (pure TypeScript) - minor cleanup only
- `acp-chat-react`: Remove all inline styles, make styling consumer-controlled
- Height estimation: Pluggable system with pretext as default, consumers can provide custom estimators
- Browser APIs: Abstract/inject for testability and SSR compatibility
- Harness: Document CSS variable contract, ensure proper styling coverage

### Metis Review (Gaps Addressed)
- **Definition**: Hybrid approach - library provides DOM structure, consumers control all styling via CSS variables
- **SSR**: Add SSR-safe abstractions for window/document/navigator
- **Migration**: Phase 1 non-breaking (add CSS vars alongside inline), Phase 2 breaking (remove inline)
- **Testing**: Add visual regression, CSS variable contract, plugin integration tests
- **Guardrails**: data-acp-* selectors, virtualization performance, keyboard shortcuts, aria attributes must remain unchanged

## Work Objectives
### Core Objective
Transform acp-chat-react into a headless component library where consumers have complete control over styling while maintaining behavioral compatibility with existing implementations.

### Deliverables
1. CSS variable contract documentation (all variables with defaults)
2. Height estimator plugin interface and pretext implementation
3. Browser API abstraction layer (clipboard, viewport, RAF)
4. Zero inline styles in library components
5. Updated Harness with comprehensive CSS variable styling
6. Migration guide and codemod script
7. Visual regression test suite

### Definition of Done (verifiable conditions)
- [ ] `grep -r "style={{" packages/acp-chat-react/src/*.tsx` returns 0 results (excluding test files)
- [ ] All 42 TODOs completed with passing tests
- [ ] Bundle size increase ≤5% (verify with `pnpm build && ls -la packages/acp-chat-react/dist/`)
- [ ] Visual regression tests pass (baseline comparison)
- [ ] All existing tests pass without modification
- [ ] CSS variable documentation published in README

### Must Have
- TypeScript interfaces for all plugin points
- Backward compatibility via deprecation warnings (Phase 1)
- SSR compatibility (no direct window/document in render)
- Comprehensive CSS variable documentation
- Example custom implementations (height estimator, clipboard)

### Must NOT Have (Guardrails)
- NO breaking changes to public TypeScript interfaces in Phase 1
- NO changes to data-acp-* selectors
- NO performance regression in virtualization (scroll, measurement)
- NO removal of keyboard shortcuts or accessibility features
- NO refactoring of core package architecture (already headless)
- NO replacing @base-ui-components (out of scope)

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- **Test decision**: Tests-after (existing test suite preserved, new tests added)
- **QA policy**: Every task has agent-executed scenarios (Playwright for visual, vitest for unit)
- **Evidence**: .sisyphus/evidence/task-{N}-{slug}.{ext} (screenshots, test output, bundle size)

## Execution Strategy
### Parallel Execution Waves
**Wave 1 (Foundation - 6 tasks)**: CSS variable definitions, type interfaces, plugin architecture setup
**Wave 2 (Height Estimation - 6 tasks)**: Pretext plugin interface, custom estimator support, font mismatch fix
**Wave 3 (Browser APIs - 5 tasks)**: Clipboard abstraction, ResizeObserver wrapper, RAF utility
**Wave 4 (Composer - 5 tasks)**: Remove inline styles, add CSS variable support
**Wave 5 (Thread/Virtualization - 6 tasks)**: VirtualizedThread styling, scroll handling abstraction
**Wave 6 (Settings/Slash - 6 tasks)**: Settings components, slash popover styling
**Wave 7 (Message/Thought/Tool - 5 tasks)**: MessageCard, ThoughtStack, ToolCall cleanup
**Wave 8 (Testing/Docs - 3 tasks)**: Visual regression, migration guide, CSS documentation

### Dependency Matrix
| Task | Wave | Blocks | Blocked By |
|------|------|--------|------------|
| 1-6 (Foundation) | 1 | All waves | None |
| 7-12 (Height) | 2 | Wave 5 (VirtualizedThread) | Wave 1 (types) |
| 13-17 (Browser APIs) | 3 | Wave 4-7 (components) | Wave 1 (types) |
| 18-22 (Composer) | 4 | None | Wave 1, 3 |
| 23-28 (Thread) | 5 | None | Wave 1, 2, 3 |
| 29-34 (Settings/Slash) | 6 | None | Wave 1, 3 |
| 35-39 (Message/Thought) | 7 | None | Wave 1, 3 |
| 40-42 (Testing/Docs) | 8 | None | Waves 1-7 |

### Agent Dispatch Summary
- **Wave 1**: 6 tasks → unspecified-high (architecture), quick (types)
- **Wave 2**: 6 tasks → unspecified-high (plugin architecture), quick (interfaces)
- **Wave 3**: 5 tasks → unspecified-high (abstraction patterns), quick (utilities)
- **Wave 4-7**: 22 tasks → frontend-design (styling), quick (component cleanup)
- **Wave 8**: 3 tasks → writing (docs), unspecified-high (test strategy)

## TODOs

### Wave 1: Foundation (CSS Variables & Types)

- [x] 1. Define CSS Variable Contract

  **What to do**: Create comprehensive CSS variable documentation with all variables needed for styling. Include defaults, fallbacks, and usage examples. Organize by category (colors, spacing, typography, layout).

  **Must NOT do**: Implement actual styling yet - just define the contract.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: Documentation requires clear, structured prose
  - Skills: [`frontend-design`] — Why: Understand styling patterns and variable usage

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: Waves 4-7 | Blocked By: None

  **References**:
  - Pattern: `apps/harness/src/styles.css:1-50` — Current CSS variable usage
  - External: `https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties` — CSS variables spec

  **Acceptance Criteria**:
  - [ ] Document all CSS variables in packages/acp-chat-react/README.md or separate CSS-VARIABLES.md
  - [ ] Include 4 categories: colors (--acp-bg, --acp-text, etc.), spacing (--acp-spacing-*), typography (--acp-font-*), layout (--acp-radius-*, --acp-border-*)
  - [ ] Provide default values matching current inline styles
  - [ ] Include fallback cascade documentation (e.g., --acp-bg-hover falls back to --acp-bg)

  **QA Scenarios**:
  ```
  Scenario: CSS variable documentation completeness
    Tool: Bash
    Steps: 
      1. Grep README for CSS variable definitions
      2. Count documented variables
      3. Verify all categories present
    Expected: ≥30 CSS variables documented across 4 categories
    Evidence: .sisyphus/evidence/task-1-css-vars-docs.txt

  Scenario: Default values match current inline styles
    Tool: Bash
    Steps:
      1. Extract default values from documentation
      2. Compare with inline styles in components
    Expected: All defaults match current pixel/em values
    Evidence: .sisyphus/evidence/task-1-defaults-match.txt
  ```

  **Commit**: YES | Message: `docs(acp-chat-react): define CSS variable contract` | Files: README.md, CSS-VARIABLES.md

- [x] 2. Create CSS Variable Type Definitions

  **What to do**: Create TypeScript interfaces for CSS variable tokens. Enable type-safe variable usage and IDE autocomplete.

  **Must NOT do**: Implement runtime validation - types only.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Type definitions are straightforward
  - Skills: [] — Why: Standard TypeScript work

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: None | Blocked By: Task 1

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/types.ts` — Existing type structure

  **Acceptance Criteria**:
  - [ ] Create `AcpCssVariables` interface with all CSS variable names and types
  - [ ] Export from packages/acp-chat-react/src/index.ts
  - [ ] Include JSDoc comments with descriptions

  **QA Scenarios**:
  ```
  Scenario: TypeScript compilation succeeds
    Tool: Bash
    Steps:
      1. Run pnpm check in packages/acp-chat-react
      2. Verify no type errors
    Expected: Exit code 0, no errors
    Evidence: .sisyphus/evidence/task-2-types-check.txt
  ```

  **Commit**: YES | Message: `types(acp-chat-react): add CSS variable type definitions` | Files: src/types/css-variables.ts

- [x] 3. Design Height Estimator Plugin Interface

  **What to do**: Create TypeScript interface for height estimator plugins. Include sync and async support, priority ordering, and content-type detection.

  **Must NOT do**: Implement pretext adapter yet - just the interface.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Plugin architecture requires careful design
  - Skills: [] — Why: Standard TypeScript interface design

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Wave 2 | Blocked By: None

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/estimateMessageHeight.ts` — Current implementation
  - Pattern: `packages/acp-chat-react/src/hooks/useTextHeight.ts` — Hook-based usage

  **Acceptance Criteria**:
  - [ ] Create `HeightEstimator` interface with `estimate(item: ThreadItem, width: number, config: Config): number | Promise<number>`
  - [ ] Create `HeightEstimatorConfig` interface with font, spacing, layout options
  - [ ] Create `HeightEstimatorPlugin` interface with name, canHandle, estimate, priority
  - [ ] Export types from packages/acp-chat-react/src/index.ts

  **QA Scenarios**:
  ```
  Scenario: Plugin interface TypeScript compilation
    Tool: Bash
    Steps:
      1. Run pnpm check
      2. Verify interface types compile
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-3-plugin-types.txt
  ```

  **Commit**: YES | Message: `types(acp-chat-react): design height estimator plugin interface` | Files: src/types/height-estimator.ts

- [x] 4. Create Height Estimator Config Default

  **What to do**: Create default configuration object with current hardcoded values (font: '14px system-ui', lineHeight: 22, etc.). Fix font mismatch by using system font stack.

  **Must NOT do**: Implement estimation logic - just config object.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Configuration object creation
  - Skills: [] — Why: Simple constant definition

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Wave 2 | Blocked By: Task 3

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/estimateMessageHeight.ts:5-9` — Current hardcoded values

  **Acceptance Criteria**:
  - [ ] Create `DEFAULT_HEIGHT_ESTIMATOR_CONFIG` with all configuration values
  - [ ] Fix font mismatch: use `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif` instead of 'Inter'
  - [ ] Export from packages/acp-chat-react/src/thread/index.ts

  **QA Scenarios**:
  ```
  Scenario: Default config exports correctly
    Tool: Bash
    Steps:
      1. Import config in test file
      2. Verify all properties present
    Expected: Config object has fontFamily, fontSize, lineHeight, etc.
    Evidence: .sisyphus/evidence/task-4-config-export.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): create height estimator default config` | Files: src/thread/estimateMessageHeight.ts

- [x] 5. Design Browser API Abstraction Interfaces

  **What to do**: Create interfaces for clipboard, viewport observer, and RAF scheduler abstractions. Enable dependency injection for testability.

  **Must NOT do**: Implement wrappers yet - just interfaces.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Interface definitions
  - Skills: [] — Why: Standard TypeScript patterns

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Wave 3 | Blocked By: None

  **References**:
  - Pattern: `packages/acp-chat-react/src/actions/MessageActionBar.tsx:16` — Current clipboard usage
  - Pattern: `packages/acp-chat-react/src/thread/VirtualizedThread.tsx:89-99` — ResizeObserver usage

  **Acceptance Criteria**:
  - [ ] Create `ClipboardAPI` interface with `writeText(text: string): Promise<void>`
  - [ ] Create `ViewportObserver` interface with `observe`, `unobserve`, `onResize` callback
  - [ ] Create `Scheduler` interface with `requestAnimationFrame`, `cancelAnimationFrame`, `setTimeout`, `clearTimeout`
  - [ ] Export from packages/acp-chat-react/src/types/browser-apis.ts

  **QA Scenarios**:
  ```
  Scenario: Browser API types compile
    Tool: Bash
    Steps:
      1. Run pnpm check
      2. Verify types compile without errors
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-5-browser-api-types.txt
  ```

  **Commit**: YES | Message: `types(acp-chat-react): design browser API abstraction interfaces` | Files: src/types/browser-apis.ts

- [x] 6. Create Browser API Default Implementations

  **What to do**: Implement default browser API wrappers that use native APIs. Include SSR guards (check for window/document existence).

  **Must NOT do**: Replace existing API calls yet - just create utilities.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Straightforward wrapper implementations
  - Skills: [] — Why: Standard browser API wrapping

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Waves 4-7 | Blocked By: Task 5

  **References**:
  - Pattern: `packages/acp-chat-react/src/index.browser.ts:187-189` — SSR environment detection

  **Acceptance Criteria**:
  - [ ] Create `defaultClipboard` using navigator.clipboard with error handling
  - [ ] Create `createViewportObserver()` factory with ResizeObserver internally
  - [ ] Create `defaultScheduler` using native RAF/timeout with SSR guards
  - [ ] All implementations check for browser environment before accessing APIs
  - [ ] Export from packages/acp-chat-react/src/utils/browser-apis.ts

  **QA Scenarios**:
  ```
  Scenario: Browser API defaults work in browser
    Tool: interactive_bash
    Steps:
      1. Start dev server
      2. Import and call clipboard.writeText
      3. Verify clipboard contains text
    Expected: Text copied successfully
    Evidence: .sisyphus/evidence/task-6-browser-api-browser.png

  Scenario: Browser API defaults safe in SSR
    Tool: Bash
    Steps:
      1. Create Node.js script importing utilities
      2. Run script (no window/document)
      3. Verify no errors thrown
    Expected: Exit code 0, graceful degradation
    Evidence: .sisyphus/evidence/task-6-browser-api-ssr.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): create browser API default implementations` | Files: src/utils/browser-apis.ts

### Wave 3: Browser API Abstraction

- [ ] 13. Implement Clipboard API Wrapper
  **What to do**: Create injectable clipboard wrapper with navigator.clipboard + fallback.
  **Must NOT do**: Change copy behavior.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Waves 4-7 | Blocked By: Task 6
  **References**: Pattern: `src/actions/MessageActionBar.tsx:16`, API: `src/types/browser-apis.ts:ClipboardAPI`
  **Acceptance Criteria**: [ ] Factory function, [ ] navigator.clipboard + fallback, [ ] Error handling
  **QA Scenarios**: Browser copy works, fallback triggers on denial
  **Commit**: YES | `feat(acp-chat-react): implement clipboard API wrapper` | src/utils/clipboard.ts

- [ ] 14. Implement Viewport Observer Wrapper
  **What to do**: Create injectable viewport observer with ResizeObserver internally.
  **Must NOT do**: Change virtualization behavior.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Wave 5 | Blocked By: Task 6
  **References**: Pattern: `src/thread/VirtualizedThread.tsx:89-99`
  **Acceptance Criteria**: [ ] Factory with onResize callback, [ ] Cleanup, [ ] SSR guards
  **QA Scenarios**: Observer tracks resize, cleanup on unmount
  **Commit**: YES | `feat(acp-chat-react): implement viewport observer wrapper` | src/utils/viewport-observer.ts

- [ ] 15. Implement Scheduler Wrapper (RAF/Timeout)
  **What to do**: Create injectable scheduler for RAF and timeout operations.
  **Must NOT do**: Change timing behavior.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Waves 4-7 | Blocked By: Task 6
  **References**: Pattern: `src/thread/VirtualizedThread.tsx:165-170`
  **Acceptance Criteria**: [ ] RAF/timeout wrappers, [ ] SSR no-op, [ ] Export utilities
  **QA Scenarios**: Scheduler RAF executes, SSR returns safely
  **Commit**: YES | `feat(acp-chat-react): implement scheduler wrapper (RAF/timeout)` | src/utils/scheduler.ts

- [ ] 16. Add Clipboard Prop to MessageActionBar
  **What to do**: Add optional `clipboard` prop, default to navigator.clipboard with deprecation warning.
  **Must NOT do**: Remove existing usage.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: None | Blocked By: Task 13
  **References**: Pattern: `src/actions/MessageActionBar.tsx:20-30`
  **Acceptance Criteria**: [ ] Prop added, [ ] Default with warning, [ ] Injected in handleCopy
  **QA Scenarios**: Custom clipboard used when provided
  **Commit**: YES | `feat(acp-chat-react): add clipboard prop to MessageActionBar` | src/actions/MessageActionBar.tsx, src/actions/types.ts

- [ ] 17. Replace Direct Browser API Usage with Abstractions
  **What to do**: Update all components to use injected browser APIs.
  **Must NOT do**: Change behavior.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: None | Blocked By: Tasks 13-16
  **References**: All component files with direct API usage
  **Acceptance Criteria**: [ ] VirtualizedThread uses wrappers, [ ] MessageActionBar uses clipboard, [ ] Zero direct API calls in components
  **QA Scenarios**: Grep shows no direct API usage in components
  **Commit**: YES | `refactor(acp-chat-react): replace direct browser API calls` | src/thread/VirtualizedThread.tsx, src/actions/MessageActionBar.tsx

### Wave 4: Composer Component Cleanup

- [x] 18. Extract Composer Inline Styles to CSS Variables
  **What to do**: Replace all inline styles in Composer.tsx with CSS variables.
  **Must NOT do**: Change layout or behavior.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: None | Blocked By: Tasks 1, 6
  **References**: Pattern: `apps/harness/src/styles.css`, CSS Contract from Task 1
  **Acceptance Criteria**: [ ] Zero inline styles, [ ] All styling via CSS variables, [ ] Visual appearance unchanged
  **QA Scenarios**: Visual regression test passes, CSS variables applied
  **Commit**: YES | `style(acp-chat-react): extract Composer inline styles to CSS variables` | src/composer/Composer.tsx

- [x] 19. Add Composer CSS Class Structure
  **What to do**: Define BEM-style CSS class names for all Composer elements.
  **Must NOT do**: Add any styling - classes only.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: None | Blocked By: Task 18
  **References**: Pattern: `src/composer/Composer.tsx` current structure
  **Acceptance Criteria**: [ ] acp-composer, acp-composer__textarea, acp-composer__controls, acp-composer__button classes
  **QA Scenarios**: Classes present in DOM, test selectors work
  **Commit**: YES | `style(acp-chat-react): add Composer CSS class structure` | src/composer/Composer.tsx

- [x] 20. Make Composer AutoFocus Injectable
  **What to do**: Replace direct textareaRef.focus() with optional focus handler callback.
  **Must NOT do**: Remove autoFocus functionality.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: None | Blocked By: Task 6
  **References**: Pattern: `src/composer/Composer.tsx:142-146`
  **Acceptance Criteria**: [ ] onFocusRequest?: () => void prop, [ ] Default focuses textarea, [ ] Consumer can override
  **QA Scenarios**: Custom focus handler called when provided
  **Commit**: YES | `feat(acp-chat-react): make Composer autoFocus injectable` | src/composer/Composer.tsx

- [x] 21. Add Composer Lifecycle Callbacks
  **What to do**: Add onMount, onValueChange, onSend, onStop callback props.
  **Must NOT do**: Change existing behavior - just expose events.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: None | Blocked By: None
  **References**: Pattern: Current Composer event handlers
  **Acceptance Criteria**: [ ] All lifecycle events exposed as callbacks, [ ] Callbacks called at correct times
  **QA Scenarios**: Callbacks fire on mount, change, send, stop
  **Commit**: YES | `feat(acp-chat-react): add Composer lifecycle callbacks` | src/composer/Composer.tsx, src/composer/types.ts

- [x] 22. Remove Composer Console.log Statements
  **What to do**: Remove or replace console.log with injectable logger.
  **Must NOT do**: Change debugging capability - just make it injectable.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: None | Blocked By: None
  **References**: Grep for console.log in Composer files
  **Acceptance Criteria**: [ ] Zero console.log in production code, [ ] Optional logger prop for debugging
  **QA Scenarios**: No console output in production build
  **Commit**: YES | `chore(acp-chat-react): remove Composer console.log statements` | src/composer/*.ts, src/composer/*.tsx

### Wave 5: Thread/Virtualization Cleanup

- [ ] 23. Extract VirtualizedThread Inline Styles to CSS Variables
  **What to do**: Replace all inline styles with CSS variables.
  **Must NOT do**: Change virtualization behavior.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: None | Blocked By: Tasks 1, 7
  **References**: CSS Contract from Task 1
  **Acceptance Criteria**: [ ] Zero inline styles, [ ] All via CSS variables
  **QA Scenarios**: Visual regression passes, scroll behavior unchanged
  **Commit**: YES | `style(acp-chat-react): extract VirtualizedThread styles to CSS variables` | src/thread/VirtualizedThread.tsx

- [ ] 24. Add VirtualizedThread CSS Class Structure
  **What to do**: Define BEM-style class names for all elements.
  **Must NOT do**: Add styling.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: None | Blocked By: Task 23
  **Acceptance Criteria**: [ ] acp-thread, acp-thread__viewport, acp-thread__row classes
  **QA Scenarios**: Classes present in DOM
  **Commit**: YES | `style(acp-chat-react): add VirtualizedThread CSS class structure` | src/thread/VirtualizedThread.tsx

- [ ] 25. Make VirtualizedThread Scroll Behavior Configurable
  **What to do**: Add scrollBehavior?: 'auto' | 'smooth' prop and configurable scrollThreshold.
  **Must NOT do**: Change default behavior.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: None | Blocked By: None
  **Acceptance Criteria**: [ ] scrollBehavior prop, [ ] scrollThreshold prop, [ ] Defaults maintain current behavior
  **QA Scenarios**: Custom scroll behavior applied when configured
  **Commit**: YES | `feat(acp-chat-react): make VirtualizedThread scroll configurable` | src/thread/VirtualizedThread.tsx, src/thread/types.ts

- [ ] 26. Extract Thread Item Renderer Styles
  **What to do**: Remove inline styles from ThreadItemRenderer, use CSS classes.
  **Must NOT do**: Change rendering logic.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: None | Blocked By: Task 23
  **Acceptance Criteria**: [ ] Zero inline styles in ThreadItemRenderer
  **QA Scenarios**: Visual regression passes
  **Commit**: YES | `style(acp-chat-react): extract ThreadItemRenderer styles` | src/thread/ThreadItemRenderer.tsx

- [ ] 27. Add Thread Lifecycle Callbacks
  **What to do**: Add onScroll, onReachBottom, onItemsRendered callback props.
  **Must NOT do**: Change existing behavior.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: None | Blocked By: None
  **Acceptance Criteria**: [ ] All lifecycle events exposed
  **QA Scenarios**: Callbacks fire correctly
  **Commit**: YES | `feat(acp-chat-react): add Thread lifecycle callbacks` | src/thread/VirtualizedThread.tsx, src/thread/types.ts

- [ ] 28. Remove VirtualizedThread Console.log Statements
  **What to do**: Remove console.log or make injectable.
  **Must NOT do**: Remove debugging capability.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: None | Blocked By: None
  **Acceptance Criteria**: [ ] Zero console.log in production
  **QA Scenarios**: No console output in production
  **Commit**: YES | `chore(acp-chat-react): remove VirtualizedThread console.log` | src/thread/*.ts, src/thread/*.tsx

### Wave 6: Settings & Slash Components

- [ ] 29. Extract SettingsPanel Inline Styles to CSS Variables
  **What to do**: Replace all inline styles with CSS variables.
  **Must NOT do**: Change SettingsPanel behavior.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: None | Blocked By: Task 1
  **Acceptance Criteria**: [ ] Zero inline styles in SettingsPanel and child components
  **QA Scenarios**: Visual regression passes
  **Commit**: YES | `style(acp-chat-react): extract SettingsPanel styles` | src/settings/*.tsx

- [ ] 30. Add Settings CSS Class Structure
  **What to do**: Define BEM-style class names for all Settings elements.
  **Must NOT do**: Add styling.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: YES | Wave 6 | Blocks: None | Blocked By: Task 29
  **Acceptance Criteria**: [ ] acp-settings-panel, acp-settings-row, acp-settings-select classes
  **QA Scenarios**: Classes present in DOM
  **Commit**: YES | `style(acp-chat-react): add Settings CSS class structure` | src/settings/*.tsx

- [ ] 31. Extract SlashSuggestions Inline Styles to CSS Variables
  **What to do**: Replace all inline styles (popover, items, header) with CSS variables.
  **Must NOT do**: Change popover behavior.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: None | Blocked By: Task 1
  **Acceptance Criteria**: [ ] Zero inline styles in SlashSuggestions
  **QA Scenarios**: Visual regression passes, popover positioning unchanged
  **Commit**: YES | `style(acp-chat-react): extract SlashSuggestions styles` | src/slash/SlashSuggestions.tsx

- [ ] 32. Add Slash CSS Class Structure
  **What to do**: Define BEM-style class names for slash popover and items.
  **Must NOT do**: Add styling.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: YES | Wave 6 | Blocks: None | Blocked By: Task 31
  **Acceptance Criteria**: [ ] acp-slash-popover, acp-slash-list, acp-slash-item classes
  **QA Scenarios**: Classes present in DOM
  **Commit**: YES | `style(acp-chat-react): add Slash CSS class structure` | src/slash/SlashSuggestions.tsx

- [ ] 33. Make Slash Command Selection Configurable
  **What to do**: Add onSelectCommand, onClose callbacks for consumer control.
  **Must NOT do**: Change default behavior.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 6 | Blocks: None | Blocked By: None
  **Acceptance Criteria**: [ ] Callbacks exposed, [ ] Defaults maintain behavior
  **QA Scenarios**: Custom callbacks work
  **Commit**: YES | `feat(acp-chat-react): add Slash command callbacks` | src/slash/SlashSuggestions.tsx, src/slash/types.ts

- [ ] 34. Remove Settings/Slash Console.log Statements
  **What to do**: Remove console.log or make injectable.
  **Must NOT do**: Remove debugging capability.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 6 | Blocks: None | Blocked By: None
  **Acceptance Criteria**: [ ] Zero console.log in production
  **QA Scenarios**: No console output in production
  **Commit**: YES | `chore(acp-chat-react): remove Settings/Slash console.log` | src/settings/*.ts, src/slash/*.ts

### Wave 7: Message, Thought, Tool Components

- [ ] 35. Extract MessageCard Inline Styles to CSS Variables
  **What to do**: Replace inline styles with CSS variables.
  **Must NOT do**: Change MessageCard layout.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: NO | Wave 7 | Blocks: None | Blocked By: Task 1
  **Acceptance Criteria**: [ ] Zero inline styles
  **QA Scenarios**: Visual regression passes
  **Commit**: YES | `style(acp-chat-react): extract MessageCard styles` | src/message/MessageCard.tsx

- [ ] 36. Add Message CSS Class Structure
  **What to do**: Define BEM-style class names for MessageCard elements.
  **Must NOT do**: Add styling.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: YES | Wave 7 | Blocks: None | Blocked By: Task 35
  **Acceptance Criteria**: [ ] acp-message, acp-message__header, acp-message__content classes
  **QA Scenarios**: Classes present in DOM
  **Commit**: YES | `style(acp-chat-react): add Message CSS class structure` | src/message/MessageCard.tsx

- [ ] 37. Extract ThoughtStack Inline Styles to CSS Variables
  **What to do**: Replace inline styles with CSS variables.
  **Must NOT do**: Change ThoughtStack behavior.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: NO | Wave 7 | Blocks: None | Blocked By: Task 1
  **Acceptance Criteria**: [ ] Zero inline styles
  **QA Scenarios**: Visual regression passes
  **Commit**: YES | `style(acp-chat-react): extract ThoughtStack styles` | src/thought/ThoughtStack.tsx

- [ ] 38. Extract ToolCall Inline Styles to CSS Variables
  **What to do**: Replace inline styles with CSS variables.
  **Must NOT do**: Change ToolCall layout.
  **Recommended Agent Profile**: Category: `frontend-design`
  **Parallelization**: Can Parallel: NO | Wave 7 | Blocks: None | Blocked By: Task 1
  **Acceptance Criteria**: [ ] Zero inline styles
  **QA Scenarios**: Visual regression passes
  **Commit**: YES | `style(acp-chat-react): extract ToolCall styles` | src/tool-call/ToolCall.tsx

- [ ] 39. Remove Message/Thought/Tool Console.log Statements
  **What to do**: Remove console.log or make injectable.
  **Must NOT do**: Remove debugging capability.
  **Recommended Agent Profile**: Category: `quick`
  **Parallelization**: Can Parallel: YES | Wave 7 | Blocks: None | Blocked By: None
  **Acceptance Criteria**: [ ] Zero console.log in production
  **QA Scenarios**: No console output in production
  **Commit**: YES | `chore(acp-chat-react): remove Message/Thought/Tool console.log` | src/message/*.ts, src/thought/*.ts, src/tool-call/*.ts

### Wave 8: Testing, Documentation & Harness

- [ ] 40. Add Visual Regression Tests

  **What to do**: Set up visual regression testing with Playwright. Create baseline screenshots for all components, add tests comparing before/after styles.

  **Must NOT do**: Manual visual testing only - must be automated.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Test strategy requires careful setup
  - Skills: [`playwright`] — Why: Browser automation for screenshots

  **Parallelization**: Can Parallel: NO | Wave 8 | Blocks: None | Blocked By: Waves 4-7

  **References**:
  - External: `https://playwright.dev/docs/screenshots` — Playwright screenshot docs

  **Acceptance Criteria**:
  - [ ] Playwright configured for visual regression
  - [ ] Baseline screenshots for Composer, Thread, MessageCard, SettingsPanel, SlashSuggestions
  - [ ] Tests compare current vs baseline with 5% tolerance
  - [ ] CI integration for visual tests

  **QA Scenarios**:
  ```
  Scenario: Visual regression catches style changes
    Tool: interactive_bash
    Steps:
      1. Run visual regression tests
      2. Modify a CSS variable value
      3. Re-run tests
    Expected: Tests fail with visual diff
    Evidence: .sisyphus/evidence/task-40-visual-regression.png
  ```

  **Commit**: YES | Message: `test(acp-chat-react): add visual regression tests` | Files: tests/visual/*.spec.ts, playwright.config.ts

- [ ] 41. Write Migration Guide

  **What to do**: Create comprehensive migration guide for consumers. Document breaking changes (Phase 2), CSS variable mapping, codemod instructions.

  **Must NOT do**: Write implementation code - documentation only.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: Technical documentation
  - Skills: [] — Why: Standard documentation

  **Parallelization**: Can Parallel: YES | Wave 8 | Blocks: None | Blocked By: Waves 4-7

  **References**:
  - CSS variable documentation from Task 1
  - All component prop changes

  **Acceptance Criteria**:
  - [ ] MIGRATION.md created in packages/acp-chat-react/
  - [ ] Phase 1 (non-breaking) and Phase 2 (breaking) sections
  - [ ] CSS variable mapping table (old inline → new variable)
  - [ ] Codemod usage instructions
  - [ ] Example migrations for each component

  **QA Scenarios**:
  ```
  Scenario: Migration guide completeness
    Tool: Bash
    Steps:
      1. Review migration guide
      2. Verify all components covered
      3. Check examples are complete
    Expected: All 8 component types documented with examples
    Evidence: .sisyphus/evidence/task-41-migration-guide.txt
  ```

  **Commit**: YES | Message: `docs(acp-chat-react): write migration guide` | Files: MIGRATION.md

- [ ] 42. Update Harness with Comprehensive CSS Variable Styling

  **What to do**: Update apps/harness/src/styles.css to define all CSS variables used by library components. Style previously unstyled components (Settings, Slash, Thread panels).

  **Must NOT do**: Change library components - harness styling only.

  **Recommended Agent Profile**:
  - Category: `frontend-design` — Reason: Comprehensive styling
  - Skills: [] — Why: CSS styling work

  **Parallelization**: Can Parallel: NO | Wave 8 | Blocks: None | Blocked By: Waves 4-7

  **References**:
  - CSS variable contract from Task 1
  - apps/harness/src/styles.css — Current harness styles

  **Acceptance Criteria**:
  - [ ] All CSS variables defined in :root
  - [ ] Settings components styled
  - [ ] Slash popover styled
  - [ ] Thread/Composer panels styled
  - [ ] All data-acp-* selectors have corresponding styles

  **QA Scenarios**:
  ```
  Scenario: Harness styles all components
    Tool: interactive_bash
    Steps:
      1. Start harness dev server
      2. Navigate to all demo tabs
      3. Verify all components styled
    Expected: No unstyled components visible
    Evidence: .sisyphus/evidence/task-42-harness-styling.png
  ```

  **Commit**: YES | Message: `style(harness): add comprehensive CSS variable styling` | Files: apps/harness/src/styles.css

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
**Phase 1 (Non-Breaking)**: Tasks 1-39 each commit individually with `style()`, `feat()`, `chore()` prefixes. Test after each wave.
**Phase 2 (Breaking)**: After all Phase 1 complete and tested, create breaking change PR with full test suite.
**Squash Strategy**: Each wave can be squashed to single commit if all tasks pass tests.
**Release**: Phase 1 as v0.x minor releases, Phase 2 as v1.0.0 major release.

## Success Criteria
- [ ] Zero inline styles in acp-chat-react components (verified by grep)
- [ ] All 42 tasks completed with passing tests
- [ ] Visual regression tests pass
- [ ] Bundle size increase ≤5%
- [ ] All existing tests pass without modification
- [ ] Migration guide published
- [ ] Harness demonstrates all styled components
- [ ] CSS variable documentation complete

### Wave 2: Height Estimation (Plugin System)

- [x] 7. Implement Pretext Height Estimator Plugin

  **What to do**: Create pretext-based height estimator implementation using the plugin interface from Task 3. Use config from Task 4.

  **Must NOT do**: Change the estimation algorithm - use existing prepare/layout pattern.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Adapt existing code to new interface
  - Skills: [] — Why: Straightforward refactoring

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Wave 5 | Blocked By: Tasks 3, 4

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/estimateMessageHeight.ts` — Current implementation to adapt
  - API/Type: `src/types/height-estimator.ts:HeightEstimator` — Interface to implement

  **Acceptance Criteria**:
  - [ ] Create `createPretextEstimator(config: HeightEstimatorConfig): HeightEstimator` factory
  - [ ] Use `prepare()` and `layout()` from @chenglou/pretext
  - [ ] Apply config values (fontFamily, fontSize, lineHeight, contentPadding)
  - [ ] Export from packages/acp-chat-react/src/thread/index.ts

  **QA Scenarios**:
  ```
  Scenario: Pretext estimator returns positive heights
    Tool: Bash
    Steps:
      1. Create estimator with default config
      2. Call estimate() with sample message
      3. Verify height > 0
    Expected: Returns number > 0 for all message types
    Evidence: .sisyphus/evidence/task-7-pretext-heights.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): implement pretext height estimator plugin` | Files: src/thread/pretext-estimator.ts

- [x] 8. Create Custom Height Estimator Example

  **What to do**: Implement example custom height estimator showing how consumers can provide their own logic. Include both sync and async examples.

  **Must NOT do**: Replace default - this is documentation/example only.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: Example code with documentation
  - Skills: [] — Why: Standard example creation

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: None | Blocked By: Task 7

  **References**:
  - API/Type: `src/types/height-estimator.ts:HeightEstimator` — Interface to implement

  **Acceptance Criteria**:
  - [ ] Create `SimpleFixedHeightEstimator` (sync, returns fixed value)
  - [ ] Create `AsyncImageAwareEstimator` (async, waits for image dimensions)
  - [ ] Add usage examples in documentation
  - [ ] Export examples from packages/acp-chat-react/src/examples/height-estimators.ts

  **QA Scenarios**:
  ```
  Scenario: Custom estimators compile and export
    Tool: Bash
    Steps:
      1. Import custom estimators
      2. Verify they match HeightEstimator interface
    Expected: TypeScript compilation succeeds
    Evidence: .sisyphus/evidence/task-8-custom-estimators.txt
  ```

  **Commit**: YES | Message: `docs(acp-chat-react): add custom height estimator examples` | Files: src/examples/height-estimators.ts

- [x] 9. Add Height Estimator Prop to VirtualizedThread

  **What to do**: Add optional `heightEstimator` prop to VirtualizedThread component. Default to pretext estimator if not provided.

  **Must NOT do**: Remove existing estimation logic - add as optional override.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Prop addition with default
  - Skills: [] — Why: Standard React prop pattern

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: None | Blocked By: Tasks 7, 8

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/VirtualizedThread.tsx:60-70` — Current props interface
  - API/Type: `src/types/height-estimator.ts:HeightEstimator` — Prop type

  **Acceptance Criteria**:
  - [ ] Add `heightEstimator?: HeightEstimator` to VirtualizedThreadProps
  - [ ] Default to `createPretextEstimator(DEFAULT_HEIGHT_ESTIMATOR_CONFIG)` when not provided
  - [ ] Use provided estimator in useMemo for itemHeights calculation
  - [ ] Add deprecation warning when using default (console.warn in dev only)

  **QA Scenarios**:
  ```
  Scenario: VirtualizedThread accepts custom estimator
    Tool: Bash
    Steps:
      1. Render VirtualizedThread with custom estimator
      2. Verify custom estimator is called
    Expected: Custom estimator used instead of default
    Evidence: .sisyphus/evidence/task-9-custom-estimator-prop.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): add heightEstimator prop to VirtualizedThread` | Files: src/thread/VirtualizedThread.tsx, src/thread/types.ts

- [x] 10. Fix Font Mismatch in Pretext Estimator

  **What to do**: Update pretext estimator to use system font stack matching actual rendering. Verify estimation matches rendered heights within 10% tolerance.

  **Must NOT do**: Change estimation algorithm - only adjust font configuration.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Configuration fix
  - Skills: [] — Why: Simple value update

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: None | Blocked By: Task 7

  **References**:
  - Finding: Metis identified font mismatch: '14px Inter' vs system font stack in rendering

  **Acceptance Criteria**:
  - [ ] Update DEFAULT_HEIGHT_ESTIMATOR_CONFIG.fontFamily to system font stack
  - [ ] Test estimation vs rendered height for 10 sample messages
  - [ ] All estimates within 10% of rendered height

  **QA Scenarios**:
  ```
  Scenario: Estimation matches rendered height
    Tool: interactive_bash
    Steps:
      1. Render 10 messages with varying content lengths
      2. Measure actual rendered heights
      3. Compare with estimated heights
    Expected: All estimates within 10% tolerance
    Evidence: .sisyphus/evidence/task-10-font-mismatch-fix.png
  ```

  **Commit**: YES | Message: `fix(acp-chat-react): correct font mismatch in height estimation` | Files: src/thread/estimateMessageHeight.ts

- [x] 11. Create Height Recalculation Event System

  **What to do**: Implement event callbacks for height recalculation triggers. Include onHeightRecalculated, onContainerResize, onContentChange callbacks.

  **Must NOT do**: Auto-trigger recalculation - just provide callbacks.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Callback prop additions
  - Skills: [] — Why: Standard React event pattern

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: None | Blocked By: Task 9

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/VirtualizedThread.tsx:89-99` — ResizeObserver setup

  **Acceptance Criteria**:
  - [ ] Add `onHeightRecalculated?: (heights: Map<string, number>) => void` prop
  - [ ] Add `onContainerResize?: (width: number) => void` prop
  - [ ] Add `onContentChange?: (messageId: string) => void` prop
  - [ ] Call callbacks at appropriate lifecycle points

  **QA Scenarios**:
  ```
  Scenario: Height recalculation callbacks fire
    Tool: Bash
    Steps:
      1. Render VirtualizedThread with callbacks
      2. Trigger resize/content change
      3. Verify callbacks called with correct data
    Expected: All callbacks fire with expected parameters
    Evidence: .sisyphus/evidence/task-11-recalc-callbacks.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): add height recalculation event callbacks` | Files: src/thread/VirtualizedThread.tsx, src/thread/types.ts

- [x] 12. Add Manual Height Recalculation API

  **What to do**: Expose imperative handle method for manual height recalculation. Allow consumers to trigger recalculation on demand.

  **Must NOT do**: Auto-recalculate - manual trigger only.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: useImperativeHandle addition
  - Skills: [] — Why: Standard React ref pattern

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: None | Blocked By: Task 9

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/VirtualizedThread.tsx:193-209` — Current useImperativeHandle

  **Acceptance Criteria**:
  - [ ] Add `recalculateHeights: (messageIds?: string[]) => void` to VirtualizedThreadRef
  - [ ] Implement method to recalculate specific or all message heights
  - [ ] Expose via useImperativeHandle

  **QA Scenarios**:
  ```
  Scenario: Manual recalculation API works
    Tool: Bash
    Steps:
      1. Get ref to VirtualizedThread
      2. Call recalculateHeights(['message-1'])
      3. Verify only specified message recalculated
    Expected: Heights updated for specified messages
    Evidence: .sisyphus/evidence/task-12-manual-recalc.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): add manual height recalculation API` | Files: src/thread/VirtualizedThread.tsx, src/thread/types.ts

### Wave 3: Browser API Abstraction

- [x] 13. Implement Clipboard API Wrapper

  **What to do**: Create injectable clipboard wrapper with error handling. Support both navigator.clipboard and fallback copy methods.

  **Must NOT do**: Change existing copy behavior - just wrap it.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Wrapper implementation
  - Skills: [] — Why: Standard browser API wrapping

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Waves 4-7 | Blocked By: Task 6

  **References**:
  - Pattern: `packages/acp-chat-react/src/actions/MessageActionBar.tsx:16` — Current clipboard usage
  - API/Type: `src/types/browser-apis.ts:ClipboardAPI` — Interface to implement

  **Acceptance Criteria**:
  - [ ] Create `createClipboardAPI(options?: { fallback?: boolean }): ClipboardAPI` factory
  - [ ] Use navigator.clipboard.writeText with try/catch
  - [ ] Fallback to document.execCommand('copy') if enabled and navigator fails
  - [ ] Export from packages/acp-chat-react/src/utils/clipboard.ts

  **QA Scenarios**:
  ```
  Scenario: Clipboard wrapper works in browser
    Tool: interactive_bash
    Steps:
      1. Create clipboard API
      2. Call writeText with sample text
      3. Verify system clipboard contains text
    Expected: Text copied successfully
    Evidence: .sisyphus/evidence/task-13-clipboard-browser.png
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): implement clipboard API wrapper` | Files: src/utils/clipboard.ts

- [x] 14. Implement Viewport Observer Wrapper

  **What to do**: Create injectable viewport observer with ResizeObserver internally. Provide cleanup and error handling.

  **Must NOT do**: Change virtualization behavior - just abstract the API.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Wrapper implementation
  - Skills: [] — Why: Standard ResizeObserver pattern

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Wave 5 | Blocked By: Task 6

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/VirtualizedThread.tsx:89-99` — Current ResizeObserver usage

  **Acceptance Criteria**:
  - [ ] Create `createViewportObserver(onResize: (width: number) => void): ViewportObserver` factory
  - [ ] Internally use ResizeObserver
  - [ ] Include cleanup (disconnect on unmount)
  - [ ] Handle ResizeObserver not available (SSR)
  - [ ] Export from packages/acp-chat-react/src/utils/viewport-observer.ts

  **QA Scenarios**:
  ```
  Scenario: Viewport observer tracks resize
    Tool: interactive_bash
    Steps:
      1. Create observer with mock callback
      2. Resize container element
      3. Verify callback called with new width
    Expected: onResize called with correct width
    Evidence: .sisyphus/evidence/task-14-viewport-observer.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): implement viewport observer wrapper` | Files: src/utils/viewport-observer.ts

- [x] 15. Implement Scheduler Wrapper (RAF/Timeout)

  **What to do**: Create injectable scheduler for RAF and timeout operations. Include SSR guards.

  **Must NOT do**: Change timing behavior - just abstract the API.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Wrapper implementation
  - Skills: [] — Why: Standard browser API wrapping

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Waves 4-7 | Blocked By: Task 6

  **References**:
  - Pattern: `packages/acp-chat-react/src/thread/VirtualizedThread.tsx:165-170` — Current RAF usage

  **Acceptance Criteria**:
  - [ ] Create `createScheduler(): Scheduler` factory
  - [ ] Wrap requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout
  - [ ] Return no-op functions in SSR environment
  - [ ] Export from packages/acp-chat-react/src/utils/scheduler.ts

  **QA Scenarios**:
  ```
  Scenario: Scheduler RAF works in browser
    Tool: Bash
    Steps:
      1. Create scheduler
      2. Call requestAnimationFrame with callback
      3. Verify callback executes
    Expected: Callback runs on next frame
    Evidence: .sisyphus/evidence/task-15-scheduler-raf.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): implement scheduler wrapper (RAF/timeout)` | Files: src/utils/scheduler.ts

- [x] 16. Add Clipboard Prop to MessageActionBar

  **What to do**: Add optional `clipboard` prop to MessageActionBar. Default to native navigator.clipboard with deprecation warning.

  **Must NOT do**: Remove existing clipboard usage - add as injectable dependency.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Prop addition
  - Skills: [] — Why: Standard React pattern

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: None | Blocked By: Task 13

  **References**:
  - Pattern: `packages/acp-chat-react/src/actions/MessageActionBar.tsx:20-30` — Current props

  **Acceptance Criteria**:
  - [ ] Add `clipboard?: ClipboardAPI` to MessageActionBarProps
  - [ ] Default to navigator.clipboard when not provided
  - [ ] Add deprecation warning in dev mode when using default
  - [ ] Use injected clipboard in handleCopy callback

  **QA Scenarios**:
  ```
  Scenario: MessageActionBar accepts custom clipboard
    Tool: Bash
    Steps:
      1. Render with mock clipboard
      2. Trigger copy action
      3. Verify mock clipboard called
    Expected: Custom clipboard used
    Evidence: .sisyphus/evidence/task-16-message-actions-clipboard.txt
  ```

  **Commit**: YES | Message: `feat(acp-chat-react): add clipboard prop to MessageActionBar` | Files: src/actions/MessageActionBar.tsx, src/actions/types.ts

- [x] 17. Replace Direct Browser API Usage with Abstractions

  **What to do**: Update all components to use injected browser APIs instead of direct calls. Update VirtualizedThread to use viewport observer and scheduler.

  **Must NOT do**: Change behavior - just replace direct API calls with injected versions.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Find/replace pattern
  - Skills: [] — Why: Systematic refactoring

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: None | Blocked By: Tasks 13-16

  **References**:
  - All files with direct browser API usage

  **Acceptance Criteria**:
  - [ ] VirtualizedThread uses injected viewportObserver and scheduler
  - [ ] MessageActionBar uses injected clipboard
  - [ ] No direct ResizeObserver, RAF, or navigator.clipboard calls in components
  - [ ] All existing tests pass

  **QA Scenarios**:
  ```
  Scenario: No direct browser API usage in components
    Tool: Bash
    Steps:
      1. Grep for 'new ResizeObserver', 'requestAnimationFrame', 'navigator.clipboard'
      2. Verify only in utility files, not components
    Expected: Zero matches in component files
    Evidence: .sisyphus/evidence/task-17-no-direct-api.txt
  ```

  **Commit**: YES | Message: `refactor(acp-chat-react): replace direct browser API calls with abstractions` | Files: src/thread/VirtualizedThread.tsx, src/actions/MessageActionBar.tsx
