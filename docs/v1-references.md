# V1 Replay Code References — Complete Audit

> Generated: 2026-04-05
> Purpose: Exhaustive inventory of all v1 replay code references for safe deletion planning.
> Scope: `crates/acp-bridge/` (Rust backend) and `packages/` (TypeScript frontend)

---

## Summary

| Category | Rust References | TS References | Total |
|----------|:-:|:-:|:-:|
| Module declaration | 1 | 0 | 1 |
| Struct/Type definition | 1 | 0 | 1 |
| Re-export (pub use) | 3 | 2 | 5 |
| Import (use) | 3 | 0 | 3 |
| Enum variant | 3 | 0 | 3 |
| CLI command | 1 | 0 | 1 |
| Mode routing / match arm | 4 | 0 | 4 |
| Function call | 1 | 0 | 1 |
| String literal | 0 | 5 | 5 |
| Doc comment | 1 | 1 | 2 |
| Source file (entire) | 1 | 0 | 1 |
| Documentation file | 1 | 0 | 1 |
| **TOTAL** | **20** | **8** | **28** |

---

## 1. Source File (DELETE ENTIRELY)

### `crates/acp-bridge/src/modes/replay.rs` — 114 lines

The entire v1 replay module. Contains:
- `ReplayConfig` struct (lines 13-16)
- `ReplayConfig::Default` impl (lines 18-25)
- Helper functions: `now_ms()`, `to_text()`
- `run_replay_mode()` async function (lines 38-114)

**Action**: Delete entire file.

---

## 2. Module Declaration

| # | File | Line | Code | Action |
|---|------|------|------|--------|
| 1 | `crates/acp-bridge/src/modes/mod.rs` | 5 | `pub mod replay;` | Delete line |

---

## 3. Re-exports (pub use)

| # | File | Line | Code | Action |
|---|------|------|------|--------|
| 1 | `crates/acp-bridge/src/modes/mod.rs` | 10 | `pub use replay::{ReplayConfig, run_replay_mode};` | Delete line |
| 2 | `crates/acp-bridge/src/lib.rs` | 14 | `pub use modes::{..., ReplayConfig, ...};` | Remove `ReplayConfig` from tuple |
| 3 | `packages/acp-chat-core/src/session/index.ts` | 4 | `export type { ..., ReplayMode, ... }` | Keep (shared with v2) |
| 4 | `packages/acp-chat-core/src/index.ts` | 38 | `export type { ..., ReplayMode, ... }` | Keep (shared with v2) |

**Note**: `ReplayMode` in TypeScript is a **shared type** used by both v1 and v2 replay. It is NOT v1-specific and should be retained.

---

## 4. Imports (use statements)

| # | File | Line | Code | Action |
|---|------|------|------|--------|
| 1 | `crates/acp-bridge/src/main.rs` | 8 | `use acp_bridge::{..., ReplayConfig, ...};` | Remove `ReplayConfig` |
| 2 | `crates/acp-bridge/src/server/mod.rs` | 8 | `use crate::modes::{..., ReplayConfig, ...};` | Remove `ReplayConfig` |
| 3 | `crates/acp-bridge/src/modes/replay.rs` | various | Multiple imports (`std::fs`, `futures_util`, etc.) | Delete with file |

---

## 5. Struct/Type Definitions

| # | File | Line(s) | Code | Action |
|---|---------|---------|------|--------|
| 1 | `crates/acp-bridge/src/modes/replay.rs` | 13-25 | `pub struct ReplayConfig { file_path, delay_ms }` + `Default` impl | Delete with file |

**Note**: `ReplayMode` in `packages/acp-chat-core/src/session/replay-controller.ts` (line 14) is a **shared frontend type**, not v1-specific. Keep.

---

## 6. Enum Variants

### 6a. `Commands` enum (CLI)

| # | File | Line(s) | Code | Action |
|---|------|---------|------|--------|
| 1 | `crates/acp-bridge/src/main.rs` | 39-47 | `Replay { addr, file, delay_ms }` variant | Delete variant |

### 6b. `BridgeMode` enum (server)

| # | File | Line(s) | Code | Action |
|---|------|---------|------|--------|
| 2 | `crates/acp-bridge/src/server/mod.rs` | 18 | `Replay(ReplayConfig)` variant | Delete variant |

### 6c. `BridgeModeHandle` enum (modes)

| # | File | Line(s) | Code | Action |
|---|------|---------|------|--------|
| 3 | `crates/acp-bridge/src/modes/mod.rs` | 16 | `Replay(ReplayConfig)` variant | Delete variant |

---

## 7. CLI Match Arm

| # | File | Line(s) | Code | Action |
|---|------|---------|------|--------|
| 1 | `crates/acp-bridge/src/main.rs` | 92-101 | `Commands::Replay { addr, file, delay_ms } => { ... }` | Delete match arm |

Includes:
- Line 93: `tracing::info!("Starting replay mode: {} (delay: {}ms)", ...)`
- Line 96: `BridgeMode::Replay(ReplayConfig { file_path: file, delay_ms: Some(delay_ms) })`

---

## 8. Mode Routing / Match Arms (server)

### 8a. Config clone match arm

| # | File | Line(s) | Code | Action |
|---|------|---------|------|--------|
| 1 | `crates/acp-bridge/src/server/mod.rs` | 53-59 | `BridgeMode::Replay(r) => { let cfg = ReplayConfig { ... }; BridgeModeHandle::Replay(cfg) }` | Delete match arm |

### 8b. Mode dispatch match arm

| # | File | Line(s) | Code | Action |
|---|------|---------|------|--------|
| 2 | `crates/acp-bridge/src/server/mod.rs` | 78-80 | `BridgeModeHandle::Replay(cfg) => { crate::modes::run_replay_mode(cfg, ws_stream, shutdown_rx).await }` | Delete match arm |

---

## 9. Function Call

| # | File | Line | Code | Action |
|---|------|------|------|--------|
| 1 | `crates/acp-bridge/src/server/mod.rs` | 79 | `crate::modes::run_replay_mode(cfg, ws_stream, shutdown_rx).await` | Delete with match arm |

---

## 10. Shared Contract Types (NOT v1-specific — DO NOT DELETE)

These are used by **both v1 and v2** replay. They should be retained.

| Type | File | Line | Used By |
|------|------|------|---------|
| `BridgeMessage::ReplayMetadata` | `crates/acp-bridge/src/contract/message.rs` | 43-47 | v1 `replay.rs:60`, v2 `replay_v2.rs:469` |
| `BridgeMessage::replay_metadata()` | `crates/acp-bridge/src/contract/message.rs` | 106-116 | v1 `replay.rs:60`, v2 `replay_v2.rs:469` |

---

## 11. Frontend TypeScript References

### 11a. Bridge mode string `"replay"` — V1-SPECIFIC

These reference the v1 `"replay"` bridge mode string passed via URL params:

| # | File | Line | Code | Action |
|---|------|------|------|--------|
| 1 | `packages/acp-chat-core/src/presets/launch.ts` | 5 | `bridgeMode: "proxy" \| "replay" \| null;` | Remove `"replay"` from union |
| 2 | `packages/acp-chat-core/src/presets/launch.ts` | 34 | `let bridgeMode: "proxy" \| "replay" \| null = null;` | Remove `"replay"` from union |
| 3 | `packages/acp-chat-core/src/presets/launch.ts` | 35 | `if (bridgeModeRaw === "proxy" \|\| bridgeModeRaw === "replay")` | Remove `"replay"` check |
| 4 | `packages/acp-chat-core/src/presets/launch.ts` | 57 | `} else if (preset.bridgeMode === "replay") {` | Delete condition block |

### 11b. Replay provider/model strings — SHARED (NOT v1-specific)

These define the replay provider which is used by the `ReplayController` (works with v2):

| # | File | Line | Code | Action |
|---|------|------|------|--------|
| 5 | `packages/acp-chat-core/src/session/replay-controller.ts` | 128 | `{ id: "replay", name: "Replay", ... }` | **Keep** (shared) |
| 6 | `packages/acp-chat-core/src/session/replay-controller.ts` | 131 | `{ id: "replay-model", ..., provider: "replay" }` | **Keep** (shared) |
| 7 | `packages/acp-chat-react/src/settings/types.ts` | 124 | `{ id: "replay", name: "Replay", ... }` | **Keep** (shared) |
| 8 | `packages/acp-chat-react/src/settings/settings-controls.test.tsx` | 11 | `{ id: "replay", name: "Replay", ... }` | **Keep** (shared) |
| 9 | `packages/acp-chat-core/src/__tests__/replay-controller.test.ts` | 427/458 | `{ id: "replay", ... }` / `provider: "replay"` | **Keep** (shared) |

### 11c. Generated types — SHARED (NOT v1-specific)

| # | File | Action |
|---|------|--------|
| 10 | `packages/acp-chat-core/src/generated/BridgeMessage.ts` | **Keep** (auto-generated from contract, shared) |
| 11 | `packages/acp-chat-core/src/generated/BridgeEnvelope.ts` | **Keep** (auto-generated from contract, shared) |

---

## 12. Documentation

| # | File | Action |
|---|------|--------|
| 1 | `docs/v1-v2-comparison.md` | **Keep** (historical reference, useful context) |
| 2 | `crates/acp-bridge/src/modes/mod.rs` line 1 | Doc comment mentions "replay (captured session)" — Update to remove v1 mention |

---

## 13. Cargo.toml — No v1-specific dependencies

`crates/acp-bridge/Cargo.toml` has no v1-specific dependencies. All dependencies (`tokio`, `tokio-tungstenite`, `futures-util`, `serde`, `serde_json`, `clap`, etc.) are shared across all modes.

---

## Deletion Checklist (for deletion phase)

### Rust — Must Delete
- [ ] Delete file: `crates/acp-bridge/src/modes/replay.rs`
- [ ] Delete line: `crates/acp-bridge/src/modes/mod.rs:5` — `pub mod replay;`
- [ ] Delete line: `crates/acp-bridge/src/modes/mod.rs:10` — `pub use replay::{...};`
- [ ] Delete variant: `crates/acp-bridge/src/modes/mod.rs:16` — `Replay(ReplayConfig)`
- [ ] Remove from re-export: `crates/acp-bridge/src/lib.rs:14` — remove `ReplayConfig`
- [ ] Remove from import: `crates/acp-bridge/src/main.rs:8` — remove `ReplayConfig`
- [ ] Delete CLI variant: `crates/acp-bridge/src/main.rs:39-47` — `Replay { ... }`
- [ ] Delete CLI match arm: `crates/acp-bridge/src/main.rs:92-101`
- [ ] Remove from import: `crates/acp-bridge/src/server/mod.rs:8` — remove `ReplayConfig`
- [ ] Delete enum variant: `crates/acp-bridge/src/server/mod.rs:18` — `Replay(ReplayConfig)`
- [ ] Delete config clone arm: `crates/acp-bridge/src/server/mod.rs:53-59`
- [ ] Delete dispatch arm: `crates/acp-bridge/src/server/mod.rs:78-80`
- [ ] Update doc comment: `crates/acp-bridge/src/modes/mod.rs:1`

### TypeScript — Must Update
- [ ] `packages/acp-chat-core/src/presets/launch.ts:5` — remove `"replay"` from type
- [ ] `packages/acp-chat-core/src/presets/launch.ts:34` — remove `"replay"` from type
- [ ] `packages/acp-chat-core/src/presets/launch.ts:35` — remove `"replay"` check
- [ ] `packages/acp-chat-core/src/presets/launch.ts:57` — delete replay branch

### Rust — DO NOT DELETE (shared with v2)
- `crates/acp-bridge/src/contract/message.rs` — `ReplayMetadata` variant + `replay_metadata()` constructor
- `crates/acp-bridge/src/modes/replay_v2.rs` — entire v2 module (separate)

### TypeScript — DO NOT DELETE (shared with v2)
- `packages/acp-chat-core/src/session/replay-controller.ts` — `ReplayMode` type and replay provider/model definitions
- `packages/acp-chat-core/src/session/index.ts` — `ReplayMode` export
- `packages/acp-chat-core/src/index.ts` — `ReplayMode` export
- `packages/acp-chat-react/src/settings/types.ts` — replay model definition
- `packages/acp-chat-core/src/__tests__/replay-controller.test.ts` — test data
- `packages/acp-chat-core/src/generated/*.ts` — auto-generated types
