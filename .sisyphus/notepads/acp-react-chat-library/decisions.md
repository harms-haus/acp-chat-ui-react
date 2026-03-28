# Decisions

## 2026-03-28 Task 1: React Monorepo Scaffolding

### Base UI as Sole Primitive Library
- **Decision**: Use `@base-ui-components/react` as the only generic primitive library
- **Rationale**: Base UI is the unstyled component library from MUI, providing headless primitives without imposing styling decisions. This aligns with the goal of a lightweight, customizable chat UI.
- **Alternative Considered**: Radix UI - rejected to avoid multiple primitive library dependencies
- **Version**: `^1.0.0-rc.0` (stable release pending)

### Vite for React Package Build
- **Decision**: Use Vite with `vite-plugin-dts` for building the React package
- **Rationale**: Vite provides fast ESM builds and the dts plugin generates declaration files, enabling proper TypeScript support for consumers
- **Alternative Considered**: Pure `tsc` - rejected because Vite provides better tree-shaking and bundling for library distribution

### TypeScript Strict Config
- **Decision**: Preserve strict TypeScript config from old Svelte repo
- **Rationale**: Ensures type safety and catches potential issues early. Options like `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` provide stronger guarantees.
- **Trade-off**: Slightly more verbose code, but better correctness

### Workspace Package References
- **Decision**: Use TypeScript project references in root `tsconfig.json`
- **Rationale**: Enables incremental builds and proper type checking across packages
- **Implementation**: Each package has its own `tsconfig.json` extending root config

### Rust Bridge Crate Location
- **Decision**: Keep `crates/acp-bridge` at workspace root, not in packages
- **Rationale**: Rust crates are separate from npm packages; this follows standard monorepo patterns for mixed-language projects

## 2026-03-28 Task 2: Performance Budget Architecture

### Deterministic Fixture-Based Testing
- **Decision**: Use JSONL replay fixtures rather than live ACP process testing
- **Rationale**: Deterministic results, no external dependencies, easy failure simulation, reusable across tasks
- **Alternative Considered**: Live bridge testing - rejected due to non-determinism and external process dependency

### Performance Budget Thresholds
- **Decision**: Set thresholds aligned with plan requirements: 16ms streaming, 150ms first interactive, 50MB memory
- **Rationale**: 16ms aligns with React 60fps budget, 150ms matches plan's long-thread budget, 50MB is conservative for large sessions
- **Bundle Budgets**: 60KB gzip core, 120KB gzip react - leaves room for growth while catching bloat

### Base UI Tree-Shaking Guards
- **Decision**: Block unplanned primitives (accordion, slider, number-field, fieldset, progress)
- **Rationale**: These are not in plan's Base UI adoption policy; importing them indicates scope expansion
- **Implementation**: Regex-based import detection in bundle check script

### Script Location
- **Decision**: Place perf/bundle scripts in `scripts/` directory, not dedicated package
- **Rationale**: Scripts are tooling not publishable code, single-file approach is maintainable, no build step needed with `node --experimental-strip-types`

## 2026-03-28 Task 2 Fix: Credible Measurement Architecture

### Canonical 10,000-Message Fixture Counting Model
- **Decision**: "10,000 messages" = total thread content items (5000 user + 5000 agent done messages)
- **Formula**: NUM_TURNS × 3 payloads + 4 metadata envelopes = total envelopes
- **Example**: 5000 turns = 15000 payloads + 4 = 15004 total envelopes
- **Rationale**: Matches plan's "canonical 10,000-message replay" requirement exactly

### Fixture Integrity Validation
- **Decision**: Validate `total_envelopes` in metadata matches actual file line count
- **Rationale**: Prevents mismatched fixtures from giving false confidence
- **Implementation**: `validateFixtureIntegrity()` throws on count mismatch

### Meaningful Normalization Simulation
- **Decision**: Simulate actual replay processing (chunk merging, content hashing, state retention)
- **Rationale**: Near-noop loops produce meaningless 0.00ms metrics; real processing catches regressions
- **Implementation**: Build `NormalizedState` Map with retained content, compute hashes, measure actual heap growth

### Dual-Layer Import Checking
- **Decision**: Check both source files AND dist output for forbidden Base UI imports
- **Rationale**: Source-level check catches mistakes immediately; dist check catches tree-shaking failures
- **Implementation**: Two separate `ImportCheckResult` passes in bundle-check.ts
## 2026-03-28 Task 3: ACP Core Reuse Decisions

### Pure Helper Relocation
- **Decision**: Move composer-logic.ts and thought-stack-logic.ts from Svelte package to core
- **Rationale**: Both files are pure TypeScript with no Svelte dependencies. They contain reusable business logic for prompt lifecycle and thought grouping that benefits both React and future framework implementations.
- **Alternative Considered**: Leave in Svelte package and import - rejected to maintain clean package boundaries and avoid circular dependencies

### Preserved Import Path Style
- **Decision**: Keep `.js` extension in all imports (e.g., `from "./parser.js"`)
- **Rationale**: This is the ESM standard and matches the original codebase. TypeScript resolves these correctly during compilation.
- **Note**: This enables both Node.js ESM execution and bundler resolution

### Test Organization
- **Decision**: Co-locate tests with source files (e.g., `store.test.ts` next to `store.ts`)
- **Rationale**: Matches the original codebase pattern and makes it easy to find related tests
- **Tests run from root**: Using root vitest.config.ts with glob pattern `packages/*/src/**/*.test.ts`

### Unused Type Removal
- **Decision**: Removed unused `JsonRpcResponse` interface from session controller
- **Rationale**: TypeScript hint flagged it as unused; the session controller only needs to handle incoming responses, not define the type structure
