
## Task 47: Extract MessagePlaceholder Inline Styles to CSS Variables

**Date:** 2026-04-03

### Summary
Successfully removed all inline styles from `MessagePlaceholder.tsx` and replaced them with BEM CSS classes using CSS variable fallbacks.

### Changes Made

#### 1. MessagePlaceholder.tsx
- Removed 3 inline style blocks:
  - Root div (6 properties: padding, borderRadius, backgroundColor, maxWidth, alignSelf, wordBreak)
  - Label div (3 properties: fontSize, color, marginBottom)
  - Content div (2 properties: fontSize, lineHeight)
- Added dynamic className with BEM modifiers for user/agent variants:
  ```tsx
  className={`acp-message-placeholder ${isUser ? "acp-message-placeholder--user" : "acp-message-placeholder--agent"}`}
  ```
- Added static classes for child elements:
  - `.acp-message-placeholder__label` for the label div
  - `.acp-message-placeholder__content` for the content div

#### 2. CSS Added to apps/harness/src/styles.css
```css
.acp-message-placeholder {
  padding: var(--acp-spacing-lg) var(--acp-spacing-xl);
  border-radius: var(--acp-radius-xl);
  max-width: 80%;
  word-break: break-word;
}

.acp-message-placeholder--user {
  background-color: var(--acp-color-user-bg);
  align-self: flex-end;
}

.acp-message-placeholder--agent {
  background-color: var(--acp-color-agent-bg);
  align-self: flex-start;
}

.acp-message-placeholder__label {
  font-size: var(--acp-font-size-sm);
  color: var(--acp-color-muted);
  margin-bottom: var(--acp-spacing-sm);
}

.acp-message-placeholder__content {
  font-size: var(--acp-font-size-lg);
  line-height: var(--acp-line-height-normal);
}
```

### Data Attributes Preserved
All `data-acp-*` selectors remain intact:
- `data-acp-message-placeholder`
- `data-acp-message-id`
- `data-acp-message-role`

### Design Decisions
- Used BEM naming pattern: `acp-message-placeholder`, `acp-message-placeholder--{modifier}`, `acp-message-placeholder__{element}`
- Dynamic background color and alignment handled via modifier classes (--user vs --agent)
- CSS variables used for themable properties (colors, spacing) with existing fallbacks
- Static layout values moved to CSS classes

### Verification
- `pnpm check` passes (all 3 workspace projects: acp-chat-core, acp-chat-react, harness)
- `grep "style={{" MessagePlaceholder.tsx` returns nothing (zero inline styles)
- All `data-acp-*` attributes preserved
- TypeScript compilation successful

## Task 48: Extract Thread.tsx Inline Styles to CSS Classes

**Date:** 2026-04-03

### Summary
Successfully removed inline styles from `Thread.tsx` and replaced them with BEM CSS classes using CSS variable fallbacks.

### Changes Made

#### 1. Thread.tsx
- Removed 1 inline style block (2 properties: textAlign, color)
- Replaced with existing `.acp-thread__empty-text` class

#### 2. CSS Updated in apps/harness/src/styles.css
Added `text-align: center` to the existing `.acp-thread__empty-text` class:
```css
.acp-thread__empty-text {
  color: inherit;
  text-align: center;
}
```

### Design Decisions
- Reused existing BEM class `.acp-thread__empty-text` instead of creating a new one
- The color is inherited from parent `.acp-thread__empty` which uses `--acp-color-muted`
- Text alignment moved from inline style to CSS class

### Verification
- `pnpm check` passes (all 3 workspace projects)
- `grep "style={{" Thread.tsx` returns nothing (zero inline styles)
- TypeScript compilation successful

## Task F2: Code Quality Review Fixes

**Date:** 2026-04-03

### Summary
Fixed all code quality issues identified in F2 review: removed `as any` anti-patterns and debug console.log statements.

### Issues Fixed

#### 1. Removed `as any` Anti-Patterns (2 instances)
**File:** `packages/acp-chat-react/src/thread/pretext-estimator.ts`

**Issue:** Using `as any` to attach `prepared` property to `PreparedTextEntry` interface without proper typing.

**Fix Applied:**
- Added `prepared?: unknown` property to `PreparedTextEntry` interface in `types/height-estimator.ts`
- Updated `pretext-estimator.ts` to assign `prepared` directly to entry object (line 121)
- Updated `layoutText()` to use type assertion `as Parameters<typeof layout>[0]` instead of `as any` (line 142)

**Why this approach:**
- The `prepared` property holds an internal @chenglou/pretext object with unknown internal structure
- Using `unknown` type is safer than `any` - requires proper type assertion at usage point
- Type assertion to `Parameters<typeof layout>[0]` is more explicit and type-safe than `as any`

#### 2. Removed Debug Console.log Statements (3 instances)
**File:** `packages/acp-chat-react/src/store/acp-store.ts`

**Issue:** Debug logging statements in production code that should not exist in shipping library.

**Fix Applied:**
- Removed line 102: `console.log("[AcpStore] sessionUpdate received, sessionId:", p.sessionId, "has update:", !!p.update);`
- Removed line 105: `console.log("[AcpStore] update keys:", Object.keys(update), "type:", update.type, "sessionUpdate:", update.sessionUpdate);`
- Removed line 108: `console.log("[AcpStore] applySessionUpdate returned:", result ? "item" : "null", "- messages:", this.normalizedState.messages.size, "timeline:", this.normalizedState.timelineOrder.length);`
- Also removed unused variables `update` and `result` that were only used for the debug logs

**Alternative:** Could make logging injectable via Logger interface (already defined in composer/types.ts), but for store updates this is not needed in production.

### Design Decisions

1. **PreparedTextEntry Interface Extension**
   - Added `prepared?: unknown` property with `@internal` JSDoc tag
   - This maintains type safety while allowing internal storage of pretext objects
   - The `@internal` tag signals this is for library-internal use only

2. **Type Assertion for Pretext Objects**
   - Used `as Parameters<typeof layout>[0]` instead of `as any`
   - This is more explicit and maintainable - clearly states we're asserting to the first parameter type of the `layout` function
   - Future code reviewers can see the expected type without looking up pretext's type definitions

3. **Console.log Removal**
   - Simply deleted debug statements rather than adding conditional logging
   - Store updates don't need debug output in production
   - If logging is needed in the future, can add injectable Logger prop to AcpStore

### Verification Results

✅ TypeScript compilation (`pnpm check`): PASSED (all 3 workspace projects)
✅ LSP diagnostics: Zero errors in all modified files
✅ `as any` anti-patterns: 0 instances found in production code
✅ Debug console.log: 0 instances found in production code (only JSDoc examples remain)
✅ Type safety: Improved - explicit type assertions replace unsafe `as any`
✅ Code cleanliness: Removed unused variables alongside debug logs

### Lessons Learned

1. **Interface Evolution Over Type Assertions**
   - When attaching internal data to exported types, extend the interface rather than using `as any`
   - This improves documentation and enables type safety
   - Use `@internal` JSDoc tag to signal private fields in public interfaces

2. **Type Assertion Best Practices**
   - `as Parameters<typeof func>[N]` is more explicit than `as any`
   - Shows the target type directly in code
   - Better for code reviews and maintenance

3. **Debug Statement Cleanup**
   - Always check for unused variables after removing console.log statements
   - TypeScript's unused variable warnings help catch these

### Remaining Console Statements (Acceptable)

All remaining `console.` statements are acceptable:
- `console.error()` / `console.warn()` - Error handling in components and utilities
- JSDoc examples in types files - Documentation only
- Logger interface default implementation - Intentional design for injectable logging

