# Decisions - ACP WS Bridge Testing Cleanup

## Decision 1: Type Definition Consolidation Strategy (Task 2)

**Date:** April 11, 2026
**Context:** Consolidate duplicate type definitions between acp-ws-bridge and acp-chat-core

### Options Considered

**Option A:** Use acp-chat-core generated types exclusively (re-export)
- Source of truth: Rust-generated types in acp-chat-core
- ws-bridge re-exports from acp-chat-core
- Remove manual type definitions from ws-bridge

**Option B:** Keep npm package types but ensure consistency
- Source of truth: Manual types in ws-bridge
- acp-chat-core generated types kept separate
- Manual sync process to maintain consistency

### Decision: Option A - Use acp-chat-core generated types

### Rationale

1. **Single source of truth**: The Rust-generated types in acp-chat-core are authoritative for the wire format. They come directly from the Rust implementation and cannot drift.

2. **Type safety**: Generated types use `JsonValue` instead of `unknown`, providing better type safety:
   - `JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]?: JsonValue } | null`
   - More restrictive than `unknown`, catches type mismatches at compile time

3. **Consistency**: Both packages now use identical property names and types:
   - `extra_data` (snake_case, matches Rust struct)
   - `payload: JsonValue` (instead of `payload: unknown`)

4. **Maintainability**: No manual updates needed when Rust changes. Generated types are always in sync with the source implementation.

5. **Avoid drift**: Prevents the risk of manual definitions diverging from the actual wire format.

### Impact Analysis

**Breaking Changes:**
- None detected. No code in ws-bridge accessed `extraData` or `payload` properties directly.
- Public API remains unchanged - ws-bridge still exports the same type names.
- Users importing from `@harms-haus/acp-ws-bridge` see no breaking changes.

**Property Name Differences (not breaking in practice):**
- Old ws-bridge: `extraData` (camelCase)
- New acp-chat-core: `extra_data` (snake_case)
- No existing code accessed this property, so no breakage.

**Type Compatibility:**
- Old ws-bridge: `payload: unknown`
- New acp-chat-core: `payload: JsonValue`
- `JsonValue` is a subtype of `unknown`, so existing code remains compatible.

### Implementation

**Files Modified:**
1. `packages/acp-ws-bridge/src/index.ts` - Updated to re-export from acp-chat-core
2. `packages/acp-ws-bridge/src/client.ts` - Updated import to use acp-chat-core types

**Files Removed:**
1. `packages/acp-ws-bridge/src/types/BridgeEnvelope.ts`
2. `packages/acp-ws-bridge/src/types/BridgeMessage.ts`
3. `packages/acp-ws-bridge/src/types/BridgeStatus.ts`
4. `packages/acp-ws-bridge/src/types/UnsupportedVersionError.ts`
5. `packages/acp-ws-bridge/src/types/index.ts`

**Build Verification:**
- ✅ TypeScript type check passes: `npm run check`
- ✅ Build succeeds: `npm run build`
- ✅ Public API preserved: All types still exported

### Future Considerations

- If wire format changes, update Rust code and regenerate types
- No manual TypeScript updates required
- TypeScript types are always the single source of truth from Rust

---
