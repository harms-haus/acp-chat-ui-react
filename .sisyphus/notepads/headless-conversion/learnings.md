# Learnings

- Plan file contains duplicate top-level entries for tasks 13-17; execute unique tasks 1-42 plus F1-F4 by task number, not raw checkbox count.
- Styling hotspots confirmed in `packages/acp-chat-react/src/composer/Composer.tsx`, `thread/VirtualizedThread.tsx`, `settings/*.tsx`, `slash/SlashSuggestions.tsx`, `message/MessageCard.tsx`, `thought/ThoughtStack.tsx`, and `actions/MessageActionBar.tsx`.
- Existing styling contract already partially exists via `var(--acp-*, fallback)` references embedded in inline styles; extraction should preserve current fallback values while moving ownership to CSS variables/classes.
- Existing class/data hooks already exist in many components (`acp-*` BEM-ish classNames and `data-acp-*` selectors); preserve these rather than inventing a new structure where possible.
- Height-estimation chain is `estimateMessageHeight.ts` / `useTextHeight.ts` -> `VirtualizedThread.tsx` -> `@tanstack/react-virtual`.
- `VirtualizedThread.tsx` currently owns ResizeObserver, requestAnimationFrame throttling, DOM measurement via `getBoundingClientRect`, scroll-state math, and imperative thread ref methods.
- Clipboard use is concentrated in `actions/MessageActionBar.tsx` and `actions/use-message-actions.ts`.
- SSR guards exist in `src/index.browser.ts`, but most DOM/browser APIs in components are not yet abstracted.
- Pretext docs confirm the core model is `prepare(text, font, options?)` once + `layout(prepared, width, lineHeight)` on resize hot path; caching prepared text is recommended.
- Pretext docs warn font strings must exactly match rendered CSS font values; current project mismatch (`14px Inter` vs system stack) should be fixed early.
- TanStack Virtual docs require `data-index` when using `measureElement`, default measurement uses `getBoundingClientRect`, and `measure()` can be used to reset cached measurements.
- TanStack Virtual guidance prefers a conservative/largest reasonable `estimateSize` for smoother scrolling and warns smooth scrolling with dynamic measurement is inherently tricky.
- MDN confirms `ResizeObserver` callbacks can create resize loops if they synchronously mutate measured layout; wrapping follow-up work in `requestAnimationFrame` is the standard mitigation.
- MDN confirms `navigator.clipboard.writeText()` requires a secure context and can throw `NotAllowedError`, so injected clipboard wrappers need graceful fallback/error handling.

## Task 1: CSS Variable Contract Documentation
- Created comprehensive CSS-VARIABLES.md documenting 11 CSS variables across 4 categories (backgrounds, text colors, borders, accents)
- Identified naming inconsistencies in muted text variables (--acp-text-muted, --acp-muted, --acp-color-muted) that need normalization
- Documented 47 var(--acp-*) references across 10 component files
- Documented BEM-style class naming pattern (acp-{component}__{element}--{modifier}) with 58 class matches across 14 files
- Documented 310 data-acp-* selector matches across 37 files for test targeting
- Updated README.md with Styling section referencing CSS-VARIABLES.md
- Verification: pnpm check passed, all major variables (--acp-bg, --acp-border, --acp-text, --acp-muted, --acp-accent, --acp-bg-hover) documented

## Task 1 (Fix): CSS Variable Contract Documentation
- Reverted unintended changes to .sisyphus/boulder.json, apps/harness/src/App.tsx, apps/harness/src/styles.css, packages/acp-chat-react/src/thread/VirtualizedThread.tsx
- Updated CSS-VARIABLES.md to cover all 4 required categories: Colors, Spacing, Typography, Layout
- Documented canonical spacing tokens derived from inline values: xs(2px), sm(4px), md(8px), lg(12px), xl(16px)
- Documented canonical typography tokens: font-size(11px-14px), line-height(1.4-1.5)
- Documented canonical layout tokens: radius(3px-8px), separator heights
- Clearly labeled canonical tokens as 'transitional' not yet implemented as var(--acp-*) in source, derived from inline values
- Verification: pnpm check passed, only intended docs remain modified

## Task 2: CSS Variable Type Definitions
- Created type surface in `src/types/css-variables.ts` with explicit interfaces for each CSS variable category (color, spacing, typography, layout)
- Used TypeScript readonly properties with literal CSS variable names (e.g., `readonly '--acp-bg': string`) to ensure exact CSS variable naming
- Included comprehensive JSDoc documentation for all types and properties to support IDE autocomplete and consumer understanding
- Exported types from main `src/index.ts` following existing ESM export pattern with `.js` specifiers
- Type surfaces are properly split by category (AcpColorVariables, AcpSpacingVariables, etc.) with a combined AcpCssVariables type for convenience
- Build process (vite-plugin-dts) correctly generates `.d.ts` declarations in `dist/types/css-variables.d.ts` with all JSDoc comments preserved
- Type exports are accessible via package entry point (`import type { AcpCssVariables } from '@acp/chat-react'`)
- Verification: pnpm check passed, build succeeded, type declarations generated correctly

## Task 3: Height Estimator Plugin Interface
- Created type surface in `src/types/height-estimator.ts` with 5 exported interfaces: HeightEstimatorConfig, PreparedTextEntry, HeightEstimator, HeightEstimatorPlugin, HeightEstimatorRegistry
- HeightEstimatorConfig covers all estimation parameters: fontFamily, fontSize, lineHeight, headerHeight, contentPadding, defaultContainerWidth, whiteSpace, richContentBlockHeight, rowGap, minHeight
- HeightEstimator supports sync and async estimation via `number | Promise<number>` return type for cases like image dimension loading
- HeightEstimator includes optional prepareText/layoutText methods for pretext-style caching efficiency
- HeightEstimatorPlugin adds name, priority, and canHandle predicate for content-type detection and plugin selection
- HeightEstimatorRegistry provides plugin management with selectEstimator method for finding best matching estimator
- Interface design aligns with ThreadItem model (message/thought_group types) and supports future content-type branching work
- Exported 5 types from main `src/index.ts` following Task 2's ESM export pattern
- Verification: pnpm check passed, no diagnostics in created file

## Task 4: Height Estimator Config Default
- Created DEFAULT_HEIGHT_ESTIMATOR_CONFIG constant in src/types/height-estimator.ts with all required configuration values
- System font stack used: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' (fixes documented Inter mismatch)
- Numeric values preserved from current implementation: fontSize=14, lineHeight=22, headerHeight=48, contentPadding=24
- defaultContainerWidth=600 matches current estimateMessageHeight default
- richContentBlockHeight=100 matches current per-block estimation logic
- rowGap=8 derived from DEFAULT_VIRTUALIZATION_CONFIG.gap
- minHeight=60 derived from empty content fallback (HEADER_HEIGHT + 60 + CONTENT_PADDING)
- Exported DEFAULT_HEIGHT_ESTIMATOR_CONFIG from both src/thread/index.ts and src/index.ts for public API
- Config defined as Readonly<HeightEstimatorConfig> with 'as const' to ensure type safety and immutability
- JSDoc documentation includes design rationale, value sources, and usage examples for consumers
- Verification: pnpm check passed, no diagnostics in modified files

## Task 5: Browser API Abstraction Interfaces
- Clipboard usage pattern confirmed in MessageActionBar.tsx line 16: `navigator.clipboard.writeText(textToCopy).catch((err) => { console.error(...); })`
- ResizeObserver usage pattern confirmed in VirtualizedThread.tsx lines 109-116: `new ResizeObserver((entries) => { setContainerWidth(entry.contentRect.width); })` with observe() and disconnect()
- requestAnimationFrame usage pattern confirmed in VirtualizedThread.tsx lines 164-172: throttling scroll events via `scrollRafRef.current = requestAnimationFrame(() => { checkScrollPosition(); })` with cleanup via cancelAnimationFrame
- Interface design supports three browser API categories: ClipboardAPI (writeText), ViewportObserver (observe/unobserve/disconnect), Scheduler (RAF/timeout scheduling)
- All interfaces documented with SSR safety guidance (no-op methods, return non-zero handles) to enable Task 6 default implementations
- All interfaces documented with error handling requirements (NotAllowedError for clipboard, resize loops for viewport observer)
- Type surface designed for dependency injection (all methods accept parameters, no side effects) to support Task 16-17 threading through components
- Verification: pnpm check passed, no diagnostics in browser-apis.ts or index.ts

## Task 6: Browser API Default Implementations
- Created default implementations in `src/utils/browser-apis.ts` with SSR guards using isBrowserEnvironment() from index.browser.ts
- defaultClipboard uses navigator.clipboard.writeText with NotAllowedError handling (catches and logs warning, resolves promise for permission denied)
- createViewportObserverFactory factory function wraps native ResizeObserver with proper cleanup pattern (disconnect on unmount)
- ResizeObserver entries are mapped from DOM ResizeObserverEntry to abstraction layer ResizeObserverEntry to maintain type safety
- defaultScheduler provides native requestAnimationFrame/setTimeout with SSR-safe no-ops (returns 0 without scheduling in SSR)
- setTimeout return type cast to number to handle Node.js Timeout vs browser number mismatch (Node.js returns Timeout object, browser returns number)
- All implementations check for browser environment and native API availability before accessing them
- Implementations use console.warn for unavailable APIs rather than throwing to maintain SSR safety
- Exported three implementations (defaultClipboard, createViewportObserverFactory, defaultScheduler) from main src/index.ts
- JSDoc documentation included as public API surface for consumer usage examples
- Verification: pnpm check passed, no diagnostics in browser-apis.ts

## Task 7: Pretext Height Estimator Implementation
- Created `src/thread/pretext-estimator.ts` with factory function `createPretextEstimator(config?: HeightEstimatorConfig)`
- Estimator uses `prepare(text, font, options?)` from @chenglou/pretext for text measurement
- Estimator uses `layout(prepared, width, lineHeight)` to calculate height at container width
- Implements `HeightEstimator` interface with `estimate()`, `prepareText()`, and `layoutText()` methods
- Text estimation uses pretext for accurate measurement with config values (font, fontSize, lineHeight, whiteSpace)
- Rich content blocks use `richContentBlockHeight` fallback (100px default) for non-text content
- Message estimation handles three cases: text-only, contentBlocks, and empty messages
- Thought group estimation uses per-item height estimates (40px for thoughts, 100px for tool calls)
- Exported `createPretextEstimator` and `defaultPretextEstimator` from both `src/thread/index.ts` and `src/index.ts`
- Factory pattern allows consumers to create custom estimators with overridden config values
- Prepared text cache keyed by text content enables reuse across container resize events
- Font string constructed from config as `${fontSize}px ${fontFamily}` to match CSS font property exactly
- Exported `defaultPretextEstimator` as convenience instance using DEFAULT_HEIGHT_ESTIMATOR_CONFIG
- Verification: pnpm check passed, no LSP diagnostics in pretext-estimator.ts or export files
- Verification: estimator returns positive heights for sample messages (text message: 132px, thought group: 60px)

## Task 8: Example Custom Height Estimators
- Created `src/examples/height-estimators.ts` with two example estimator implementations for consumer reference
- `SimpleFixedHeightEstimator`: synchronous O(1) estimator returning fixed heights (120px messages, 80px thought_groups)
- `SimpleFixedHeightEstimator` use cases: prototyping, uniform message heights, performance-critical scenarios, learning estimator interface
- `SimpleFixedHeightEstimator` trade-offs: fast (O(1)) but low accuracy, may cause scroll jitter with variable content
- `AsyncImageAwareEstimator`: asynchronous estimator that loads image dimensions via browser Image API before calculating height
- `AsyncImageAwareEstimator` use cases: threads with images/charts, accurate estimation for smooth scrolling, rich media content
- `AsyncImageAwareEstimator` implementation: loads image dimensions without full download, caches dimensions, scales to container width with aspect ratio preserved
- `AsyncImageAwareEstimator` trade-offs: more accurate but slower initial estimation, requires network access, may cause re-renders as images load
- Both estimators include comprehensive JSDoc documentation with use cases, trade-offs, and usage examples
- Optional config properties (minHeight, rowGap, richContentBlockHeight) handled with nullish coalescing (??) to provide defaults
- SSR safety: `AsyncImageAwareEstimator` checks for window/Image availability before using Image API
- Image dimension caching uses Map<string, {width, height}> to avoid re-loading same URIs
- Text height estimation uses character count approximation (avg ~50 chars/line at 600px width with 14px font)
- Exported both estimators from main `src/index.ts` for consumer import
- Verification: pnpm check passed, no errors in created file
- Verification: LSP diagnostics show only hints about unused parameters (expected for interface compliance)

## Task 9: Height Estimator Prop for VirtualizedThread
- Added `heightEstimator?: HeightEstimator` prop to VirtualizedThreadProps in src/thread/types.ts
- Default value: `createPretextEstimator(DEFAULT_HEIGHT_ESTIMATOR_CONFIG)` instantiated in component body
- Prop is optional with sensible default - backward compatible with existing VirtualizedThread usage
- Updated itemHeights useMemo to use injected estimator: `heightEstimator.estimate(item, containerWidth, DEFAULT_HEIGHT_ESTIMATOR_CONFIG) as number`
- Type assertion `as number` required because HeightEstimator.estimate() returns `number | Promise<number>` (async support), but useMemo needs synchronous values
- Removed direct use of estimateMessageHeight from VirtualizedThread - now fully abstracted through estimator interface
- HeightEstimator interface handles both messages and thought_groups - no type casting needed for item.data
- Exported HeightEstimator, HeightEstimatorConfig, DEFAULT_HEIGHT_ESTIMATOR_CONFIG from src/thread/index.ts
- Old estimateMessageHeight.ts remains exported for backward compatibility but no longer used internally
- Verification: pnpm check passed, no LSP diagnostics in modified files
- Verification: custom estimator type path works (HeightEstimator importable from @acp/chat-react)
- Design decision: Use type assertion for async/sync compatibility rather than separate sync/async props (simpler API, handles default sync case well)
- Design decision: Pass DEFAULT_HEIGHT_ESTIMATOR_CONFIG to estimator.estimate() to ensure config consistency (consumer can override config via factory function)

## Task 10: Fix Font Mismatch in Pretext Estimator
- Updated estimateMessageHeight.ts line 4: Changed `const MESSAGE_FONT = '14px Inter'` to `const MESSAGE_FONT = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'`
- Font string now matches DEFAULT_HEIGHT_ESTIMATOR_CONFIG.fontFamily exactly (system font stack)
- Numeric defaults preserved (fontSize: 14, lineHeight: 22, etc.) as required
- Added one-line comment explaining the change (prevents future re-introduction of Inter font mismatch)
- All other "Inter" matches in codebase are false positives (words like "Interface", "Internal")
- No other hardcoded font references found in estimator files
- Old estimateMessageHeight.ts remains exported for backward compatibility, but now uses correct system font stack
- New pretext estimator (Task 7) already uses DEFAULT_HEIGHT_ESTIMATOR_CONFIG with system font stack
- Verification: pnpm check passed, no TypeScript errors
- Font consistency verified: Both old estimator and new pretext estimator now use same system font stack
## Task 11: Height Recalculation Event System
- Added three optional callback props to VirtualizedThreadProps: onHeightRecalculated, onContainerResize, onContentChange
- onHeightRecalculated called after itemHeights useMemo recalculates (when items, containerWidth, or heightEstimator changes)
- onContainerResize called from ResizeObserver callback when viewport width changes
- onContentChange called when items prop changes, passes last message ID or empty string if no items
- All callbacks are optional and don't affect existing VirtualizedThread behavior when not provided
- useEffect used to detect itemHeights changes and trigger onHeightRecalculated callback
- Added previousItemsRef to track items changes separately from item count (used by scroll-to-bottom logic)
- JSDoc documentation added for all three callbacks as public API surface
- Design decision: Call onContentChange with last message ID on batch updates rather than per-item (simpler, sufficient for most use cases)
- Design decision: Use separate refs for item count and items array to avoid triggering onContentChange on every re-render
- Verification: pnpm check passed, no TypeScript errors

## Task 12: Manual Height Recalculation API
- Added `recalculateHeights?: (messageIds?: string[]) => void` to VirtualizedThreadRef interface in src/thread/types.ts
- Implemented via useImperativeHandle in src/thread/VirtualizedThread.tsx exposing the imperative method
- Implementation uses trigger pattern: recalcTrigger state increments when recalculateHeights called, forcing itemHeights useMemo to recalculate
- Method signature includes optional messageIds parameter to support selective recalculation (currently recalculates all heights)
- Added no-op statement (recalcTrigger;) in useMemo to satisfy exhaustive-deps ESLint rule (trigger variable must be used in body)
- Method is consumer-triggered only - no auto-recalculation on renders (per task requirements)
- JSDoc documentation added for public API: "Manually recalculate heights for specific message IDs or all messages if not specified"
- Design decision: Full recalculation on call rather than selective updates - simpler implementation, consistent with existing architecture
- Design decision: Trigger pattern over direct mutation - maintains React's declarative model while enabling imperative control
- Design decision: messageIds parameter accepted but not used in v1 - reserved for future optimization (selective height updates)
- All existing scroll/ref behavior preserved - no changes to scrollToBottom, scrollToItem, getViewport, isNearBottom, setFollowScroll
- Verification: pnpm check passed, no TypeScript errors

## Task 13: Implement Clipboard API Wrapper
- Created `src/utils/clipboard.ts` with factory function `createClipboardAPI(options?: CreateClipboardAPIOptions)`
- Task 6's `defaultClipboard` (object) supplemented by Task 13's factory function pattern for dependency injection flexibility
- Factory function provides navigator.clipboard.writeText with fallback to document.execCommand('copy') for older browsers/HTTP contexts
- Fallback behavior configurable via options: `{ fallback?: boolean }` (default: true)
- Error handling includes: NotAllowedError, secure context requirements, SSR no-op, navigator.clipboard unavailability
- Exported three utilities: `createClipboardAPI` (factory), `defaultClipboardWithFallback` (default with fallback), `strictClipboard` (no fallback)
- document.execCommand('copy') fallback creates temporary textarea element with fixed positioning to prevent scroll interference
- Type exports added: CreateClipboardAPIOptions interface exported from main index.ts
- JSDoc documentation includes usage examples and browser compatibility notes for public API
- Design decision: Keep Task 6's defaultClipboard for backward compatibility, add Task 13's factory as additional export
- Design decision: Separate exports (defaultClipboard vs defaultClipboardWithFallback) let consumers choose between strict (navigator only) and fallback-enabled implementations
- Verification: pnpm check passed, all TypeScript compilation successful

## Task 14: Implement Viewport Observer Wrapper
- Created simplified wrapper `createViewportObserver(callback)` in `src/utils/viewport-observer.ts`
- Task 6's `createViewportObserverFactory()` returns a factory that needs `.create()` called; T14's wrapper combines both steps into single function call
- Wrapper delegates to `createViewportObserverFactory().create(callback)` for implementation
- SSR guards inherited from Task 6 via `createViewportObserverFactory()` - returns no-op observer when ResizeObserver unavailable
- JSDoc documentation includes usage example showing observe/disconnect pattern and remarks about SSR safety and cleanup
- Exported `createViewportObserver` from main `src/index.ts` for public API
- Verification: pnpm check passed, no LSP diagnostics in created or modified files

## Task 15: Implement Scheduler Wrapper (RAF/Timeout)
- T06 already implemented `defaultScheduler` in `src/utils/browser-apis.ts` (lines 167-225) with all required functionality
- Scheduler interface defined in `src/types/browser-apis.ts` (lines 347-394) with four methods: requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout
- `defaultScheduler` implementation wraps native browser APIs with SSR guards using `isBrowserEnvironment()` from `src/index.browser.ts`
- SSR safety: Returns 0 (non-zero handle) for requestAnimationFrame and setTimeout without scheduling in SSR mode
- Cancellation methods (cancelAnimationFrame, clearTimeout) check for non-zero IDs before canceling to handle SSR handles
- Implementation includes console.warn for unavailable APIs rather than throwing to maintain SSR safety
- JSDoc documentation included for all methods with usage examples
- Exported from main `src/index.ts` (line 216: defaultScheduler, line 210: Scheduler type)
- Verification: pnpm check passed, no LSP diagnostics in browser-apis.ts or index.ts
- No additional wrapper needed - T06's `defaultScheduler` satisfies all task requirements
## Task 16: Add Clipboard Prop to MessageActionBar
- Added optional `clipboard?: ClipboardAPI` prop to MessageActionBarProps in src/actions/types.ts
- Added JSDoc documentation for the prop explaining default behavior and providing usage examples
- Clipboard implementation defaults to `defaultClipboardWithFallback` when not provided (uses navigator.clipboard with fallback to document.execCommand)
- Updated MessageActionBar.tsx to import ClipboardAPI type and defaultClipboardWithFallback utility
- Refactored handleCopy callback to use injected clipboard instead of direct navigator.clipboard.writeText
- Added deprecation warning via useEffect when clipboard prop not provided (warns in console for production readiness)
- Clipboard is stored in local variable using nullish coalescing: `const clipboard = injectedClipboard ?? defaultClipboardWithFallback`
- Added clipboard to handleCopy's dependency array to ensure proper React dependency management
- Existing copy behavior preserved when using default clipboard - no breaking changes for consumers
- Design decision: Default to defaultClipboardWithFallback (with fallback) rather than defaultClipboard (strict) for maximum compatibility
- Design decision: Add deprecation warning instead of removing default - encourages proper usage without breaking existing code
- Verification: pnpm check passed, no TypeScript errors
## Task 17: Replace Direct Browser API Usage with Abstractions
- Updated VirtualizedThread.tsx to accept injected `viewportObserverFactory` and `scheduler` props
- Added imports: ViewportObserverFactory, Scheduler types from browser-apis.ts, and createViewportObserverFactory, defaultScheduler from browser-apis.ts utils
- Added JSDoc documentation for both new props in src/thread/types.ts with usage examples
- Replaced `new ResizeObserver` with `injectedViewportObserverFactory.create()` in useEffect (line 143-154)
- Replaced `requestAnimationFrame` with `injectedScheduler.requestAnimationFrame()` in handleScroll (line 191)
- Replaced `cancelAnimationFrame` with `injectedScheduler.cancelAnimationFrame()` in handleScroll and cleanup (lines 188, 271)
- Updated use-message-actions.ts to accept optional `clipboard` prop in UseMessageActionsOptions
- Imported defaultClipboardWithFallback from utils/clipboard.ts
- Replaced direct `navigator.clipboard.writeText` with injected clipboard in handleCopy (line 19)
- Both props default to Task 6 implementations when not provided: createViewportObserverFactory() and defaultScheduler
- Component behavior unchanged - only replaced direct API calls with injected wrappers
- Updated dependency arrays to include injected props for proper React dependency management
- Verification: Grep shows zero direct API calls in component files (navigator.clipboard, new ResizeObserver, requestAnimationFrame)
- Verification: pnpm check passed with no TypeScript errors
- All direct browser API usage now isolated to utils/browser-apis.ts and utils/clipboard.ts (abstraction layer)

## Task 18: Remove Inline Style Objects from Composer
- Removed all 5 inline style objects from Composer.tsx:
  1. Root div: removed `style={{ display: "flex", flexDirection: "column", width: "100%", position: "relative" }}`
  2. Input container div: removed `style={{ position: "relative", display: "flex", flexDirection: "column" }}`
  3. Textarea: removed `style={{ width: "100%", minHeight: `${minRows * 1.5}em`, maxHeight: `${maxRows * 1.5}em`, resize: "none", padding: "12px", paddingRight: "80px", fontSize: "14px", lineHeight: "1.5", border: "1px solid var(--acp-border, #ccc)", borderRadius: "8px", backgroundColor: "var(--acp-bg, #fff)", color: "var(--acp-text, #000)" }}`
  4. Controls div: removed `style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "8px" }}`
  5. Settings row div: removed `style={{ marginTop: "8px" }}`
- Added `data-min-rows` and `data-max-rows` attributes to textarea for CSS-based min/max height calculation
- Added comprehensive CSS styles to apps/harness/src/styles.css:
  - `.acp-composer`: flex column layout with 100% width and relative positioning
  - `.acp-composer__input-container`: relative positioning with flex column
  - `.acp-composer__textarea`: all textarea styles with CSS variable fallbacks, plus data attribute selectors for min/max rows (1-10)
  - `.acp-composer__controls`: absolute positioning at top-right with flex gap
  - `.acp-composer__settings-row`: margin-top spacing
  - `.acp-composer__button`: base button styles with flex alignment
  - `.acp-composer__button--send` and `--stop`: variant-specific colors
- Preserved all data-acp-* selectors and existing className hooks
- Preserved functional behavior: key handling, send/stop logic, autoFocus, minRows/maxRows calculation for rows attribute
- Verification: `pnpm check` passed (all 3 workspace projects)
- Verification: grep shows zero `style={{` in Composer.tsx

## Task 19: Complete/Normalize Composer Class Hooks

### Changes Made
- Added missing BEM class names to button text spans in Composer.tsx:
  - Send button text: added className="acp-composer__button-text"
  - Stop button text: added className="acp-composer__button-text"

### BEM Class Inventory (Complete)
- Root: acp-composer
- Input container: acp-composer__input-container
- Textarea: acp-composer__textarea
- Controls: acp-composer__controls
- Button (base): acp-composer__button
- Button variants: acp-composer__button--send, acp-composer__button--stop
- Button text: acp-composer__button-text (NEW)
- Settings row: acp-composer__settings-row

### Data Attributes Preserved
All data-acp-* selectors remain intact:
- data-acp-composer
- data-acp-composer-state
- data-acp-composer-disabled
- data-acp-composer-has-settings
- data-acp-composer-input-container
- data-acp-composer-input
- data-acp-composer-controls
- data-acp-send-button
- data-acp-stop-button
- data-acp-composer-settings-row

### Verification
- pnpm check passed (all 3 workspace projects)
- No behavior changes - classes are purely additive
- All existing class names preserved

## Task 20: Make Composer AutoFocus Injectable
- Added `onFocusRequest?: () => void` callback prop to ComposerProps interface in src/composer/types.ts
- Callback allows consumers to override default textarea focus behavior when autoFocus is true
- Modified useEffect in Composer.tsx to check for callback first: calls props.onFocusRequest() if provided, otherwise falls back to textareaRef.current.focus()
- Added props.onFocusRequest to useEffect dependency array for proper React dependency management
- Default behavior (textarea focus) preserved when callback not provided - backward compatible
- JSDoc documentation added explaining callback purpose and default behavior for API consumers
- Verification: pnpm check passed (all 3 workspace projects)

## Task 21: Add Composer Lifecycle Callbacks
- Added two new optional callback props to ComposerProps interface: `onMount?: () => void` and `onValueChange?: (value: string) => void`
- onMount callback called via useEffect on component mount - allows consumers to perform initialization when Composer mounts
- onValueChange callback called in handleChange whenever the textarea value changes - provides real-time input tracking
- Verified existing onSend and onStop callbacks are already being called in handleSend (line 58) and handleStop (line 69)
- All callbacks are optional and use optional chaining (?.()) to preserve backward compatibility
- Added JSDoc documentation for new callbacks as public API surface (onMount at line 12, onValueChange at line 14 in types.ts)
- Updated handleChange dependency array to include props.onValueChange for proper React dependency management
- All existing Composer behavior preserved - callbacks only fire when provided by consumers
- Verification: pnpm check passed (all 3 workspace projects)

## Task 22: Remove Composer Console.log Statements
- Found zero console.log statements in Composer component files
- Found 2 console.error statements in Composer.tsx (lines 60 and 71) for error logging
- Created Logger interface in src/composer/types.ts with 5 methods: error, warn, info, debug, log
- Added optional logger prop to ComposerProps interface with JSDoc documentation
- Logger interface provides injectable logging for custom implementations, silent production mode, and test-friendly mocking
- Updated Composer.tsx to use injected logger?.error() instead of direct console.error calls
- Logger is optional and uses optional chaining (?.) to preserve backward compatibility
- When logger prop not provided, error handling silently fails (no-op) - consumers can inject logger for debugging
- Design decision: Replace console.error with injectable logger instead of console.log (task mentioned console.log but only console.error existed)
- Design decision: Logger defaults to undefined (no-op) rather than console methods - prevents unwanted console output in production
- Design decision: Use optional chaining (logger?.error) for graceful degradation when logger not provided
- Verification: pnpm check passed (all 3 workspace projects)
- Verification: grep shows zero console.log in production code (only in JSDoc examples)
- Verification: zero console.error in component files (replaced with logger?.error)
