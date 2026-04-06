# Task 2: V1 Replay Reference Audit

**Date**: 2026-04-05
**Scope**: Exhaustive inventory of all v1 replay code references in the codebase
**Purpose**: Complete map for safe deletion of v1 replay in later tasks

---

## Summary

| Category | Count | Files |
|----------|-------|-------|
| V1 Module Source | 1 file | `modes/replay.rs` |
| Module Declaration | 1 ref | `modes/mod.rs` |
| Module Re-export | 1 ref | `modes/mod.rs` |
| Public API Export (lib.rs) | 1 ref | `lib.rs` |
| CLI Subcommand | 1 variant | `main.rs` |
| CLI Match Arm | 1 arm | `main.rs` |
| CLI Import | 1 ref | `main.rs` |
| Server Enum Variant | 1 variant | `server/mod.rs` |
| Server Match Arms | 3 refs | `server/mod.rs` |
| Server Import | 1 ref | `server/mod.rs` |
| Handle Enum Variant | 1 ref | `modes/mod.rs` |
| Contract Usage (shared) | 1 ref | `replay.rs` → `replay_metadata()` |
| Cargo.toml | 0 refs | No replay-specific deps |
| Frontend (apps/) | 0 refs | No v1 replay references |
| Frontend (packages/) | 0 refs | ReplayController is v2-only |
| Test files | 0 refs | No v1-specific tests |
| **Total v1-only refs** | **14** | **4 files** |

---

## File 1: `crates/acp-bridge/src/modes/replay.rs` (114 lines)

**Status**: Entire file is v1-only — DELETE ENTIRELY

### Contents:
- **L1**: Module doc: `//! Replay mode: read newline-delimited JSON envelopes...`
- **L3-9**: Imports (`std::fs::File`, `std::io::{BufRead, BufReader}`, `std::time::*`, `futures_util::*`, `tokio::sync::broadcast`, `tokio_tungstenite::*`)
- **L11**: Import `crate::contract::{BridgeEnvelope, BridgeMessage, BridgeStatus}`
- **L13-16**: `pub struct ReplayConfig { pub file_path: String, pub delay_ms: Option<u64> }`
- **L18-25**: `impl Default for ReplayConfig`
- **L27-32**: `fn now_ms() -> u64` — helper
- **L34-36**: `fn to_text(s: String) -> Message` — helper
- **L38-114**: `pub async fn run_replay_mode(...)` — main v1 replay function

### References to contract (shared, NOT v1-only):
- **L11**: `BridgeEnvelope`, `BridgeMessage`, `BridgeStatus` — used by both v1 and v2
- **L45**: `BridgeMessage::bridge_status(BridgeStatus::Starting)` — shared
- **L60**: `BridgeMessage::replay_metadata(first_ts, total, None)` — **also used by v2** (L469 in replay_v2.rs)

---

## File 2: `crates/acp-bridge/src/modes/mod.rs`

**Status**: 4 v1-specific references — MODIFY (remove lines)

| Line | Type | Reference | Action |
|------|------|-----------|--------|
| L1 | Doc comment | `replay (captured session)` in module doc | Update doc |
| L5 | Module decl | `pub mod replay;` | Remove |
| L10 | Re-export | `pub use replay::{ReplayConfig, run_replay_mode};` | Remove |
| L16 | Enum variant | `Replay(ReplayConfig),` in `BridgeModeHandle` | Remove |

---

## File 3: `crates/acp-bridge/src/lib.rs`

**Status**: 1 v1-specific reference — MODIFY

| Line | Type | Reference | Action |
|------|------|-----------|--------|
| L14 | Public export | `pub use modes::{..., ReplayConfig, ...};` | Remove `ReplayConfig` |

---

## File 4: `crates/acp-bridge/src/main.rs`

**Status**: 4 v1-specific references — MODIFY

| Line | Type | Reference | Action |
|------|------|-----------|--------|
| L8 | Import | `ReplayConfig` in `use acp_bridge::{..., ReplayConfig, ...}` | Remove `ReplayConfig` |
| L39 | Doc comment | `/// Replay mode: replays captured session from file` | Remove variant doc |
| L40-47 | CLI variant | `Replay { addr, file, delay_ms }` in `Commands` enum | Remove entire variant |
| L92-100 | Match arm | `Commands::Replay { ... } => ...` | Remove entire arm |

---

## File 5: `crates/acp-bridge/src/server/mod.rs`

**Status**: 5 v1-specific references — MODIFY

| Line | Type | Reference | Action |
|------|------|-----------|--------|
| L8 | Import | `ReplayConfig` in `use crate::modes::{..., ReplayConfig, ...}` | Remove `ReplayConfig` |
| L18 | Enum variant | `Replay(ReplayConfig),` in `BridgeMode` enum | Remove |
| L53-59 | Match arm | `BridgeMode::Replay(r) => { ... BridgeModeHandle::Replay(cfg) }` | Remove |
| L78-80 | Match arm | `BridgeModeHandle::Replay(cfg) => crate::modes::run_replay_mode(...)` | Remove |

---

## Shared Contract Code (NOT v1-only — DO NOT DELETE)

The following are used by BOTH v1 and v2 replay. They must NOT be deleted:

| File | Line | Symbol | Also Used By |
|------|------|--------|-------------|
| `contract/message.rs` L42-52 | `BridgeMessage::ReplayMetadata` | v2 replay_v2.rs L469 |
| `contract/message.rs` L105-116 | `BridgeMessage::replay_metadata()` | v2 replay_v2.rs L469 |
| `contract/envelope.rs` L44-52 | `BridgeEnvelope::new_replay()` | v2 (potential future use) |
| `contract/envelope.rs` L19-20 | `seq` field doc: "replay mode" | General doc |

---

## Confirmed Zero References

These areas were checked and contain NO v1 replay references:

| Area | Search Method | Result |
|------|--------------|--------|
| `Cargo.toml` (all) | grep for "replay" | No replay-specific dependencies |
| `apps/` (all .ts/.tsx) | grep for "replay" | Zero matches |
| `packages/` (all .ts/.tsx) | grep for "replay" | Only `replay-controller.ts` and test — both v2-only |
| `.json` files | grep for "replay" | Zero matches |
| `.md` files | grep for "replay" | Zero matches (no README/docs references) |
| `.yaml/.yml/.sh/Makefile` | grep for "replay" | Zero matches |
| `bridge_contract.rs` (tests) | Read file | No replay references |
| `bridge_proxy.rs` (tests) | Read file | No replay references |
| `replay_v2_streaming.rs` | Read file | v2 helper only, no v1 imports |
| LSP find_references `ReplayConfig` | 11 results | All accounted for above |
| LSP find_references `run_replay_mode` | 3 results | All accounted for above |
| LSP find_references `BridgeMode::Replay` | 3 results | All accounted for above |

---

## Deletion Checklist (for later tasks)

### Delete entirely:
- [ ] `crates/acp-bridge/src/modes/replay.rs` (114 lines)

### Modify — remove v1-specific lines:
- [ ] `crates/acp-bridge/src/modes/mod.rs` — 4 edits (L1 doc, L5 mod, L10 pub use, L16 enum variant)
- [ ] `crates/acp-bridge/src/lib.rs` — 1 edit (L14 remove ReplayConfig)
- [ ] `crates/acp-bridge/src/main.rs` — 4 edits (L8 import, L39-47 variant, L92-100 match arm)
- [ ] `crates/acp-bridge/src/server/mod.rs` — 4 edits (L8 import, L18 variant, L53-59 arm, L78-80 arm)

### DO NOT touch:
- `contract/message.rs` — `ReplayMetadata` / `replay_metadata()` shared with v2
- `contract/envelope.rs` — `new_replay()` potentially used by v2
- `replay_v2.rs`, `replay_v2_streaming.rs` — v2 code, untouched
- `replay-controller.ts` / test — frontend v2 controller, untouched
- `fixtures/replay-data/` — fixture files, untouched

---

## Total Line Count Impact

| File | Lines to Remove | Remaining |
|------|----------------|-----------|
| `replay.rs` | 114 (entire file) | 0 |
| `modes/mod.rs` | ~4 | ~14 |
| `lib.rs` | ~1 | ~19 |
| `main.rs` | ~18 | ~98 |
| `server/mod.rs` | ~16 | ~77 |
| **Total** | **~153 lines** | |
