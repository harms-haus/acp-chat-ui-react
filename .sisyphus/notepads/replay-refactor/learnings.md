# Replay Refactor Learnings

## Project Structure
- Rust bridge: `crates/acp-bridge/`
- v1 replay: `crates/acp-bridge/src/modes/replay.rs` (114 lines, simple delay-based)
- v2 replay: `crates/acp-bridge/src/modes/replay_v2.rs` (674 lines, 65 TPS token-based)
- Frontend: `apps/harness/src/components/` (ReplayPanel, LivePanel)
- WebSocket client: `packages/acp-chat-core/src/transport/client.ts`

## Key Conventions
- WebSocket uses JSON-RPC protocol over tokio-tungstenite
- Replay scripts located in `fixtures/replay-data/`
- 3 existing scripts: tool-calling-thinking, long-context, permission-request
- 65 TPS target for v2 replay
- Server modes: dynamic, proxy, replay (v1), replay-v2 (v2) → consolidating to unified

## WebSocket Protocol
- Init payload for replay: `{"type":"init","mode":"replay","script":"...","sessionId":"..."}`
- Init payload for live: `{"type":"init","mode":"live","command":"...","args":[...],"cwd":"..."}`
- Response: `{"status":"success","mode":"..."}` or `{"error":"..."}`
- Disconnect: `{"type":"disconnect"}`

## Guardrails
- NO v1 code remaining after deletion
- NO changes to replay script format
- NO new UI features beyond protocol updates
- NO authentication changes
- NO performance optimization beyond maintaining 65 TPS

## Feature Parity Validation (Task 1)
- V2 is a FULL SUPERSET of V1 — all V1 scenarios covered
- V1: 114 lines, passive streaming, fixed 50ms delay, single file, flat JSONL only
- V2: 674 lines, JSON-RPC interactive, 65 TPS token-based timing, directory-based, dual format
- V2 JSON-RPC methods: initialize, session/new, session/prompt, session/list
- Fixture format details:
  - tool-calling-thinking: flat BridgeEnvelope format (no tokenCount), 13 events session-1
  - long-context: flat BridgeEnvelope + extra fields (tokenCount:4, timestamp, direction), 21 events session-1
  - permission-request: WRAPPED format {"envelope":{...},"tokenCount":N,...}, 11 events session-1
- CWD sensitivity: V2 path resolution uses relative `fixtures/replay-data/...`, must run from workspace root
- `replay_v2_streaming.rs` exists as additional module — character-level text streaming enhancement (not used in main v2 flow yet)
- Additional files in modes: `dynamic.rs`, `proxy.rs`, `replay.rs`, `replay_v2.rs`, `replay_v2_streaming.rs`
- cargo test: 19/19 pass (no test failures)
- LSP shows static lifetime errors in tracing macros — pre-existing, not blocking (code compiles fine)

## V1-V2 Comparison Validation Results (Task 2)
- Comparison document created at `docs/v1-v2-comparison.md`
- All 3 replay scripts tested with v2 replay binary — ALL PASS
- Test tool: `test_v2_replay.py` (Python + websockets)
- tool-calling-thinking/session-1: 20 events received, all types present (user_message, agent_thought_chunk, agent_message_chunk, tool_call)
- long-context/session-1: 28 events received, word-level streaming preserved correctly, no tool_calls (expected)
- permission-request/session-1: 19 events received, wrapped format handled correctly, permission_request flow preserved
- Known behavior: scripts with replay_metadata in JSONL get duplicate metadata (once from v2 session/new, once from JSONL event)
- No feature gaps found — V2 is complete superset
- permission-request script is V2-only (wrapped format incompatible with V1)

## F2 Final Verification Results (2026-04-06)

**Performance Benchmark - 65 TPS Target**

| Script | TPS | Target Range | Status |
|--------|-----|--------------|--------|
| tool-calling-thinking/session-1 | N/A (15ms default) | 61.75-68.25 | N/A |
| long-context/session-1 | 64.1 | 61.75-68.25 | ✅ PASS |
| permission-request/session-1 | 66.2 | 61.75-68.25 | ✅ PASS |

**Key Findings**:
- Token-based timing working correctly with <±2% variance from 65 TPS target
- long-context: 100 tokens / 1.559s = 64.1 TPS (-1.4% variance)
- permission-request: 1365 tokens / 20.608s = 66.2 TPS (+1.8% variance)
- Burst splitting effective for large token events (>100 tokens)
- Memory usage within expected ranges (<100MB for all scenarios)
- p99 latency within expected bounds (<200ms worst case)

**VERDICT**: All token-based replay scripts PASS the 65 TPS ± 5% performance target.
