# Decisions

- Treat the canonical implementation scope as unique tasks 1-42 plus final-wave tasks F1-F4.
- Start with Wave 1 foundational tasks before component cleanup, even though the plan file ordering is imperfect.
- Preserve public `data-acp-*` selectors, existing class hooks, virtualization behavior, and keyboard/a11y semantics as hard guardrails.
- Use CSS-variable extraction and browser-API abstraction as additive/non-breaking changes first; defer any true breaking cleanup until the end of the plan.
- Use pretext as the default height-estimator implementation, but design plugin/config interfaces so consumers can fully replace estimation behavior.

## Task 1: CSS Variable Contract
- Decision: Create separate CSS-VARIABLES.md instead of embedding in README.md for clearer separation of styling contract from general docs
- Decision: Document naming inconsistencies explicitly rather than normalizing prematurely, to preserve current codebase accuracy and guide future normalization work
- Decision: Include fallback values from inline styles as documented defaults, treating current codebase as source of truth
- Decision: Document both CSS classes and data attributes as preserved styling/test hooks, clarifying that data-acp-* should not be used for styling
- Decision: List all implementation files using CSS variables to provide concrete context for future refactoring work

## Task 2: CSS Variable Type Definitions
- Decision: Use TypeScript interfaces with readonly literal property names (e.g., `readonly '--acp-bg': string`) instead of loose `Record<string, string>` to enforce exact CSS variable naming and provide better autocomplete
- Decision: Split type surface into category-specific interfaces (AcpColorVariables, AcpSpacingVariables, etc.) for granular imports, with combined AcpCssVariables type for convenience
- Decision: Include comprehensive JSDoc documentation as public API documentation since this is a consumer-facing type surface that requires clear usage guidance
- Decision: Export types from main `src/index.ts` directly without creating separate `types/index.ts` to follow existing export pattern and minimize file structure complexity
- Decision: Mark all properties as `readonly` to align with CSS variable immutability (variables are set once at CSS scope level)

## Task 3: Height Estimator Plugin Interface
- Decision: Support both sync and async estimation via `number | Promise<number>` return type to accommodate estimators that need to load external resources (e.g., image dimensions)
- Decision: Add optional prepareText/layoutText methods to HeightEstimator for pretext-style caching, since pretext docs recommend caching prepared text for resize efficiency
- Decision: Use priority-based plugin selection (higher priority = preferred) to enable content-type-specific estimators like image-aware estimation to override default text estimation
- Decision: Include PreparedTextEntry interface for cache validation (font string, whiteSpace, timestamp) to ensure cached entries remain valid across config changes
- Decision: Add canHandle predicate to HeightEstimatorPlugin for content-type detection, enabling multiple plugins to coexist with clear selection logic
- Decision: Include comprehensive JSDoc documentation as public API documentation since this is a consumer-facing plugin architecture that requires clear implementation guidance
- Decision: Split config into font-specific (fontFamily, fontSize) vs layout-specific (headerHeight, contentPadding) fields to match pretext's prepare/layout separation
- Decision: Add optional config fields (whiteSpace, richContentBlockHeight, rowGap, minHeight) to support future non-text block estimation needs without breaking existing estimators

## Task 4: Height Estimator Config Default
- Decision: Define DEFAULT_HEIGHT_ESTIMATOR_CONFIG in src/types/height-estimator.ts (same file as interface) rather than in a separate config file to keep related types and constants co-located
- Decision: Export DEFAULT_HEIGHT_ESTIMATOR_CONFIG from both src/thread/index.ts and src/index.ts to ensure it's accessible via both entry points (thread-scoped and package-level)
- Decision: Use system font stack ('-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif') instead of 'Inter' to fix the documented font mismatch that would cause inaccurate height estimation
- Decision: Preserve all current numeric defaults (14, 22, 48, 24, 600, 100) to maintain existing behavior while only correcting the font family
- Decision: Include all optional config fields (whiteSpace, richContentBlockHeight, rowGap, minHeight) in the default to provide a complete configuration without requiring consumers to specify them
- Decision: Mark config as Readonly<HeightEstimatorConfig> with 'as const' to ensure type safety, immutability, and proper type inference for consumers
- Decision: Derive minHeight=60 from empty content fallback (HEADER_HEIGHT + 60 + CONTENT_PADDING) to match current estimateMessageHeight behavior for messages with no content
- Decision: Derive rowGap=8 from DEFAULT_VIRTUALIZATION_CONFIG.gap to maintain consistency between virtualization and estimation configurations
- Decision: Add JSDoc documentation to DEFAULT_HEIGHT_ESTIMATOR_CONFIG as public API documentation since this is a consumer-facing constant that explains design decisions and provides usage examples

## Task 5: Browser API Abstraction Interfaces
- Decision: Separate ClipboardAPI, ViewportObserver, and Scheduler into three distinct interfaces to match the three browser API categories identified in current usage (clipboard, ResizeObserver, RAF/timeout)
- Decision: Use factory pattern for ViewportObserver (ViewportObserverFactory) instead of direct implementation to support creating multiple observer instances with different callbacks
- Decision: Provide ResizeObserverEntry interface as part of abstraction layer to keep implementation details self-contained and avoid DOM type pollution
- Decision: Define Scheduler with both animation frame (requestAnimationFrame/cancelAnimationFrame) and timeout (setTimeout/clearTimeout) methods since VirtualizedThread uses both for throttling and future debouncing needs
- Decision: Specify return type for all cancellation methods as number (handle) to align with browser API behavior and enable consumer ref management
- Decision: Include comprehensive SSR guidance in JSDoc (e.g., "return a non-zero value without scheduling", "be no-op (empty function)") since this is a critical design constraint for headless support
- Decision: Document resize loop prevention pattern explicitly in ResizeObserverCallback JSDoc since MDN confirms this is a standard mitigation pattern and VirtualizedThread already follows it
- Decision: Include error handling requirements in ClipboardAPI interface (catch NotAllowedError, re-throw other errors) since MDN confirms navigator.clipboard requires secure context and can throw NotAllowedError
- Decision: Use callback-based signature for ResizeObserverCallback (passing observer instance) to enable consumers to call observer.unobserve/disconnect within callbacks without needing external ref management
- Decision: Mark ResizeObserverEntry.target as unknown instead of Element to keep the abstraction layer DOM-agnostic and enable future non-DOM implementations for testing/SSR
- Decision: Reserve ViewportObserverOptions.box for future extensions (content-box, border-box) but mark as optional since current implementation uses default behavior
- Decision: Export all browser API types from main src/index.ts following Task 2-4 pattern to maintain consistent public API surface
- Decision: Include comprehensive JSDoc documentation with usage examples for both browser and SSR implementations since this is a consumer-facing abstraction requiring clear implementation guidance

## Task 6: Browser API Default Implementations
- Decision: Place implementations in src/utils/browser-apis.ts (new utils directory) to separate runtime implementations from type definitions in src/types/
- Decision: Use existing isBrowserEnvironment() from index.browser.ts for SSR guards to maintain consistency with existing patterns
- Decision: Return resolved promise (not throw) when clipboard API unavailable to maintain SSR safety and prevent unhandled rejections
- Decision: Catch NotAllowedError specifically and log warning instead of throwing to align with current MessageActionBar error handling pattern
- Decision: Map DOM ResizeObserverEntry to abstraction layer ResizeObserverEntry in factory to maintain type separation from DOM types
- Decision: Create factory function for ViewportObserver (createViewportObserverFactory) instead of singleton to support multiple observer instances with different callbacks
- Decision: Return 0 as handle value in SSR environments for requestAnimationFrame/setTimeout (non-zero per interface contract) to enable cancellation API without scheduling
- Decision: Cast setTimeout return type to number to handle Node.js Timeout object vs browser number type mismatch in dual environment codebase
- Decision: Use console.warn for API availability warnings rather than throwing to maintain graceful degradation in SSR/test environments
- Decision: Export all three implementations from main src/index.ts following Task 2-5 export pattern to maintain consistent public API surface
- Decision: Include comprehensive JSDoc documentation with usage examples as public API documentation since this is a consumer-facing implementation surface

## Task 7: Pretext Height Estimator Implementation
- Decision: Create factory function `createPretextEstimator(config?: HeightEstimatorConfig)` instead of singleton to support multiple estimator instances with different configurations
- Decision: Implement `prepareText()` and `layoutText()` methods in HeightEstimator to enable consumers to cache prepared text and reuse it during resize events for performance
- Decision: Cache prepared text keyed by text content string in estimator state to enable reuse across width changes during resize
- Decision: Construct font string from config as `${fontSize}px ${fontFamily}` to match CSS font property exactly (pretext docs warn font strings must match rendered values)
- Decision: Use internal state object (PretextEstimatorState) to capture config and cache, making estimator instances independent and testable
- Decision: Handle three distinct message estimation cases: text-only (pretext), contentBlocks (fallback height), and empty (minHeight)
- Decision: Estimate thought group height using per-item estimates (40px for thoughts, 100px for tool calls) since thought rendering is not yet measured with pretext
- Decision: Export `defaultPretextEstimator` as convenience instance using DEFAULT_HEIGHT_ESTIMATOR_CONFIG for consumers who don't need custom config
- Decision: Export both factory function and default instance from src/thread/index.ts and src/index.ts to ensure accessibility from both entry points
- Decision: Use `any` type for message.data and thoughtGroup.data parameters to avoid importing from @acp/chat-core and maintain abstraction layer
- Decision: Use configured contentPadding to subtract from containerWidth before calling layout(prepared, width, lineHeight) to match current estimateMessageHeight behavior
- Decision: Store prepared pretext object in PreparedTextEntry via `(entry as any).prepared = prepared` to avoid circular type dependencies while keeping cache entries serializable
- Decision: Apply config.minHeight to all estimation branches to ensure positive heights even for edge cases (empty content, estimation errors)
- Decision: Implement prepared text cache validation (check font and whiteSpace match) to ensure cache entries remain valid when config changes
