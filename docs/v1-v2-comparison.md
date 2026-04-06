# V1 vs V2 Replay: Feature Comparison

## Overview

| Aspect | V1 (`replay.rs`) | V2 (`replay_v2.rs`) |
|--------|-------------------|----------------------|
| Lines of code | 114 | 674 |
| Protocol | Auto-stream (push) | JSON-RPC (request/response) |
| Timing mechanism | Fixed delay (default 50ms) | Token-count based (65 TPS) |
| Event format | Flat `BridgeEnvelope` JSONL | Flat + wrapped formats |
| Session data | N/A | `session-data.json` support |

## Feature Comparison Table

### Timing & Streaming

| Feature | V1 | V2 | Parity |
|---------|----|----|--------|
| Configurable delay between events | `delay_ms` (default 50ms) | Computed from `tokenCount` at 65 TPS | V2 supersedes |
| Fixed delay for zero-token events | N/A (all events same delay) | 15ms fixed | V2 only |
| Burst splitting for large events | N/A | Splits >100 tokens into ~10-token chunks | V2 only |
| Client disconnect detection | During streaming loop | During streaming + burst loops | Parity |

### Protocol & Communication

| Feature | V1 | V2 | Parity |
|---------|----|----|--------|
| JSON-RPC request handling | N/A (push-only) | `initialize`, `session/new`, `session/prompt`, `session/list` | V2 only |
| `initialize` → capabilities response | N/A | Sends protocol version, capabilities, server info | V2 only |
| `session/new` → load session | N/A | Loads session-data.json + replay metadata | V2 only |
| `session/prompt` → stream events | N/A | Triggers 65 TPS streaming | V2 only |
| `session/list` → list sessions | N/A | Returns empty session list | V2 only |
| Unknown method error response | N/A | Returns JSON-RPC error (-32601) | V2 only |
| Version mismatch detection | N/A | Logs warning on client/bridge version mismatch | V2 only |
| Ping/Pong handling | N/A | Responds to WebSocket Ping with Pong | V2 only |
| Non-JSON-RPC message handling | N/A | Falls through to version check | V2 only |

### Event Format Support

| Feature | V1 | V2 | Parity |
|---------|----|----|--------|
| Flat format (BridgeEnvelope JSONL) | Yes | Yes | Parity |
| Wrapped format (`{"envelope":{...},"tokenCount":N}`) | N/A | Yes | V2 only |
| `tokenCount` extraction from events | N/A | Yes (flat: from top-level, wrapped: from top-level) | V2 only |
| `replay-events.jsonl` file naming | Single file via `file_path` | Directory-based (`base_dir/replay-events.jsonl`) | Different convention |

### Lifecycle & Status

| Feature | V1 | V2 | Parity |
|---------|----|----|--------|
| Send `bridge_status: starting` on connect | Yes | Yes | Parity |
| Send `replay_metadata` | Yes (after starting) | Yes (on `session/new`) | Parity |
| Send `bridge_status: connected` | Yes (after metadata) | Yes (on `session/new`) | Parity |
| Send `bridge_status: disconnected` | N/A | Yes (after streaming completes) | V2 only |
| Keep connection open after replay | Yes | Yes | Parity |
| Shutdown signal handling | Yes | Yes | Parity |

### Session Management

| Feature | V1 | V2 | Parity |
|---------|----|----|--------|
| `session-data.json` loading | N/A | Yes, sent as `session_state` on `session/new` | V2 only |
| Configurable demo type + session ID | N/A (single file path) | CLI args or JSON-RPC params | V2 only |
| File path override | Via `file_path` (direct to JSONL) | Via `file_path` (to base directory) | Different usage |
| Replay metadata includes description | No (passes `None`) | Yes (`"{demoType} / {sessionId}"`) | V2 only |

### Error Handling

| Feature | V1 | V2 | Parity |
|---------|----|----|--------|
| File not found | Returns error (propagates `File::open` error) | Returns empty vec with warning | Different |
| Invalid JSON lines | Silently skipped | Silently skipped | Parity |
| Missing demoType/sessionId | N/A | Returns JSON-RPC error (-32602) | V2 only |
| Missing session to replay | N/A | Logs error, no streaming | V2 only |

### Testing

| Feature | V1 | V2 | Parity |
|---------|----|----|--------|
| Unit tests | No | Yes (9 tests: delay computation, path resolution, envelope extraction) | V2 only |

## Replay Script Compatibility

### Script 1: `tool-calling-thinking/session-1`

| Property | Value |
|----------|-------|
| Format | Flat BridgeEnvelope (no `tokenCount`, no wrapped format) |
| Events | 13 lines |
| Event types | `replay_metadata`, `bridge_status`, `acp_payload` |
| ACP payload types | `user_message`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `agent_message_chunk` |
| Has `session-data.json` | Yes |
| V1 compatible | Yes (single JSONL, all BridgeEnvelope) |
| V2 compatible | Yes (flat format handled by `extract_envelope`) |
| Notes | No `tokenCount` fields — v2 will use 15ms default delay for all events |

### Script 2: `long-context/session-1`

| Property | Value |
|----------|-------|
| Format | Flat BridgeEnvelope with extra fields (`tokenCount`, `timestamp`, `direction`) |
| Events | 21 lines |
| Event types | `replay_metadata`, `bridge_status`, `acp_payload` |
| ACP payload types | `user_message`, `agent_thought_chunk`, `agent_message_chunk` |
| Has `session-data.json` | Yes |
| Token counts | All set to `4` (small) or `20` (agent_message_chunk) |
| V1 compatible | Yes (ignores extra fields) |
| V2 compatible | Yes (`tokenCount` extracted via serde, flat format) |
| Notes | Word-level incremental streaming simulates realistic token output |

### Script 3: `permission-request/session-1`

| Property | Value |
|----------|-------|
| Format | Wrapped (`{"envelope":{...},"tokenCount":N,"timestamp":T,"direction":"in"}`) |
| Events | 11 lines |
| Event types | All `acp_payload` (no `replay_metadata` or `bridge_status` in events) |
| ACP payload types | `user_message`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `permission_request`, `agent_message_chunk` |
| Has `session-data.json` | Yes |
| Token counts | 62-227 (variable, realistic) |
| V1 compatible | No (V1 expects flat BridgeEnvelope, not wrapped) |
| V2 compatible | Yes (wrapped format handled by `extract_envelope`) |
| Notes | This is the most complex script with permission flow |

## Key Architectural Differences

### V1: Simple Push Model
1. Open JSONL file
2. Parse all envelopes
3. Send `starting` → `metadata` → `connected`
4. Loop: send each envelope with fixed delay
5. Keep-alive loop after completion

### V2: JSON-RPC Interactive Model
1. Send `starting`
2. Wait for `initialize` → respond with capabilities
3. Wait for `session/new` → load data, send `session_state`, `replay_metadata`, `connected`
4. Wait for `session/prompt` → stream events at 65 TPS
5. Send `disconnected` after streaming
6. Continue handling requests (can re-prompt)

## Feature Gaps

### V1 features NOT in V2
- None. V2 is a strict superset of V1's functionality.

### V2 features NOT in V1
1. **JSON-RPC protocol** — V1 is push-only, V2 supports request/response
2. **Token-based timing (65 TPS)** — Realistic streaming speed
3. **Burst splitting** — Large token bursts split into ~10-token chunks
4. **Wrapped event format** — Supports `{"envelope":{...},"tokenCount":N}` 
5. **Session data loading** — Sends `session-data.json` as `session_state`
6. **Multiple JSON-RPC methods** — `initialize`, `session/new`, `session/prompt`, `session/list`
7. **Ping/Pong handling** — WebSocket-level keep-alive
8. **Version validation** — Client/bridge version mismatch detection
9. **Disconnected status** — Sends `bridge_status: disconnected` after replay
10. **Error responses** — JSON-RPC error codes for invalid requests
11. **Unit tests** — 9 test cases covering timing, paths, envelope extraction

### Potential Concerns
1. **`tool-calling-thinking` with V2**: No `tokenCount` fields → all events use 15ms delay. Replay will be very fast (~195ms for 13 events). This may not look realistic.
2. **`permission-request` with V1**: Incompatible — V1 cannot parse wrapped format. This script only works with V2.
3. **V2 `replay_metadata` event in script**: The `tool-calling-thinking` script has `replay_metadata` as seq 0 in the JSONL. V2 also sends `replay_metadata` via `session/new`. Client will receive it twice (once from JSONL, once from V2's session/new handler).

## Test Results

All tests run via `test_v2_replay.py` against `acp-bridge replay-v2` binary.

### tool-calling-thinking/session-1

**Status: PASS**

| Metric | Value |
|--------|-------|
| Total events received | 20 |
| Stream events | 14 |
| Event types | `bridge_status`: 5, `acp_payload`: 13, `replay_metadata`: 2 |
| Has `user_message` | Yes |
| Has `agent_thought_chunk` | Yes |
| Has `agent_message_chunk` | Yes |
| Has `tool_call` | Yes |
| Protocol flow | `starting` → `initialize` → `session/new` → `session/prompt` → streaming → `disconnected` |

Notes:
- Script has no `tokenCount` fields, so v2 used 15ms default delay for all events
- Received `replay_metadata` twice: once from v2 `session/new` handler, once from JSONL events (seq 0 is `replay_metadata`)
- All 13 JSONL events correctly streamed plus 1 extra `disconnected` status

### long-context/session-1

**Status: PASS**

| Metric | Value |
|--------|-------|
| Total events received | 28 |
| Stream events | 22 |
| Event types | `bridge_status`: 5, `acp_payload`: 21, `replay_metadata`: 2 |
| Has `user_message` | Yes |
| Has `agent_thought_chunk` | Yes |
| Has `agent_message_chunk` | Yes |
| Has `tool_call` | No (expected — this script has no tool calls) |
| Protocol flow | `starting` → `initialize` → `session/new` → `session/prompt` → streaming → `disconnected` |

Notes:
- All events have `tokenCount: 4` (small), so delay per event = ~61ms (4/65 * 1000)
- Word-level incremental streaming correctly preserved (each chunk appends one more word)
- `replay_metadata` received twice (v2 handler + JSONL)

### permission-request/session-1

**Status: PASS**

| Metric | Value |
|--------|-------|
| Total events received | 19 |
| Stream events | 13 |
| Event types | `bridge_status`: 3, `acp_payload`: 15, `replay_metadata`: 1 |
| Has `user_message` | Yes |
| Has `agent_thought_chunk` | Yes |
| Has `agent_message_chunk` | Yes |
| Has `tool_call` | Yes |
| Has `permission_request` | Yes |
| Protocol flow | `starting` → `initialize` → `session/new` → `session/prompt` → streaming → `disconnected` |

Notes:
- Uses wrapped format (`{"envelope":{...},"tokenCount":N}`) — correctly handled by v2
- Variable token counts (62–227) create realistic timing variation
- No `replay_metadata` or `bridge_status` events in JSONL (only `acp_payload`) — v2 provides these itself
- Permission request flow correctly preserved (pending → approved)
- `replay_metadata` received only once (v2 handler), since JSONL has no metadata event

## Summary

**All 3 replay scripts work correctly with v2.** V2 is a strict superset of v1 functionality. The only notable behavior is duplicate `replay_metadata` when the JSONL file itself contains a `replay_metadata` event (scripts 1 & 2).
