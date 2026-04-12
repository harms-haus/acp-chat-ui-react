# Issues Found in acp-ws-bridge Testing Cleanup

## Task: Verify and fix two issues in acp-ws-bridge codebase

**Date:** 2026-04-11
**Status:** ALREADY RESOLVED

### Issue 1: ReplayMetadata serialization

**Status:** ✅ ALREADY RESOLVED - No fix needed

**Finding:**
The `ReplayMetadata::description` field in `crates/acp-ws-bridge/src/contract/message.rs` line 51 **ALREADY HAS** the `#[serde(skip_serializing_if = "Option::is_none")]` attribute.

```rust
ReplayMetadata {
    /// Original capture timestamp in milliseconds.
    #[ts(type = "number")]
    captured_at_ms: u64,
    /// Total number of envelopes in the replay file.
    #[ts(type = "number")]
    total_envelopes: u64,
    /// Optional description of the captured session.
    #[serde(skip_serializing_if = "Option::is_none")]  // ✅ Already present
    description: Option<String>,
},
```

**Test verification:**
The test `test_serialization_replay_metadata_without_description` (line 812-818) correctly expects the description field to be omitted when None, and the serde attribute ensures this behavior.

---

### Issue 2: vitest.config.ts coverage include

**Status:** ✅ ALREADY RESOLVED - No fix needed

**Finding:**
The coverage include pattern in `packages/acp-ws-bridge/vitest.config.ts` line 21 **ALREADY INCLUDES** both `.ts` and `.tsx` files.

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "lcov", "html"],
  thresholds: {
    lines: 80,
    branches: 75,
  },
  include: ["src/**/*.{ts,tsx}"],  // ✅ Already includes .tsx
  exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"],
},
```

The pattern `src/**/*.{ts,tsx}` correctly matches both TypeScript and TSX files for coverage measurement.

---

## Test Results

### Rust Tests
```bash
cd crates/acp-ws-bridge && cargo test
```
**Result:** ✅ 147 tests passed; 0 failed; 0 ignored

### TypeScript Tests
```bash
pnpm vitest run packages/acp-ws-bridge
```
**Result:** ✅ 95 tests passed (2 test files)

---

## Conclusion

Both issues were **already resolved** in previous work:

1. ✅ ReplayMetadata description field has `#[serde(skip_serializing_if = "Option::is_none")]` attribute
2. ✅ vitest.config.ts coverage includes both `.ts` and `.tsx` files
3. ✅ All Rust tests pass (147/147)
4. ✅ All TypeScript tests pass (95/95)

No code changes were required. These issues appear to have been fixed during earlier testing infrastructure work.
