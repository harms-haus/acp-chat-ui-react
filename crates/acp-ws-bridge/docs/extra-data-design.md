# Extra-Data Design for BridgeEnvelope

## Purpose

Provide a generic extension mechanism for WebSocket messages that allows harness-server to attach arbitrary metadata to envelopes without requiring ws-bridge to understand or validate the content.

## Design Principles

1. **Free-form JSON**: Extra-data is opaque to ws-bridge. No validation, no schema enforcement.
2. **Optional**: Messages without extra-data are fully valid.
3. **Preservation**: ws-bridge preserves extra-data during message forwarding but never interprets it.
4. **Harness-server semantics**: Specific meanings (e.g., replay-speed) are defined and interpreted at the harness-server layer, not in ws-bridge.

## Use Cases

### Primary Use Case: Replay Speed Control

The harness-server can attach replay-speed hints to envelopes during history replay:

```json
{
  "version": 1,
  "seq": 42,
  "timestamp_ms": 1234567890,
  "message_type": "acp_event",
  "message": { ... },
  "extra_data": {
    "replay_speed": 2.0
  }
}
```

The harness-server interprets `replay_speed` to control playback timing. The ws-bridge simply forwards it.

### Future Extensions

Extra-data can carry any harness-server metadata:
- Debugging information
- Tracing IDs
- Client-specific hints
- Experimental features

## Type Definitions

### Rust (ws-bridge)

**File:** `crates/acp-bridge/src/contract/envelope.rs`

```rust
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct BridgeEnvelope {
    /// Envelope format version. Must be one of SUPPORTED_VERSIONS.
    pub version: u32,

    /// Sequence number for ordering messages in replay mode.
    /// Zero in live mode; monotonically increasing in replay mode.
    #[ts(type = "number")]
    pub seq: u64,

    /// Unix timestamp in milliseconds when the envelope was created.
    #[ts(type = "number")]
    pub timestamp_ms: u64,

    /// Optional free-form metadata. The ws-bridge treats this as opaque JSON.
    /// Specific interpretations (e.g., replay-speed) happen at the harness-server layer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_data: Option<Value>,

    /// The message payload.
    #[serde(flatten)]
    pub message: BridgeMessage,
}
```

**Key Points:**
- Type: `Option<serde_json::Value>` - maximum flexibility
- `#[serde(skip_serializing_if = "Option::is_none")]` - omit from JSON when None
- No validation of content

### TypeScript (React layer)

**File:** `packages/acp-chat-core/src/types/envelope.ts` (or equivalent)

```typescript
export interface BridgeEnvelope {
  /** Envelope format version. Must be one of SUPPORTED_VERSIONS. */
  version: number;

  /** Sequence number for ordering messages in replay mode. */
  seq: number;

  /** Unix timestamp in milliseconds when the envelope was created. */
  timestamp_ms: number;

  /** Optional free-form metadata. Opaque to the bridge. */
  extraData?: Record<string, unknown>;

  /** The message payload (flattened from BridgeMessage union) */
  message_type: MessageType;
  message: BridgeMessagePayload;
}
```

**Key Points:**
- Type: `Record<string, unknown>` - matches Rust's `serde_json::Value`
- Optional field with `?` modifier
- No type-level validation of content

## Wire Format Examples

### Without Extra-Data (Most Common)

```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "message_type": "acp_event",
  "message": {
    "event_type": "stdout",
    "event": { "content": "Hello, world!" }
  }
}
```

### With Extra-Data (Replay Mode)

```json
{
  "version": 1,
  "seq": 42,
  "timestamp_ms": 1234567890,
  "message_type": "acp_event",
  "message": {
    "event_type": "stdout",
    "event": { "content": "Replayed message" }
  },
  "extra_data": {
    "replay_speed": 2.0,
    "source": "history_replay"
  }
}
```

## Implementation Notes

### ws-bridge Responsibilities

- ✅ Serialize/deserialize extra-data as opaque JSON
- ✅ Preserve extra-data during message forwarding
- ✅ Never validate or interpret extra-data content
- ✅ Omit extra-data from serialization when None (saves bandwidth)

### Harness-Server Responsibilities

- ✅ Define semantics for extra-data fields (e.g., replay-speed)
- ✅ Validate extra-data content if needed
- ✅ Interpret extra-data for replay logic
- ✅ Attach extra-data to envelopes during replay

### React Layer Responsibilities

- ✅ Receive extra-data in envelopes
- ✅ Forward to harness-server if needed
- ✅ Never assume specific extra-data structure
- ✅ Gracefully handle missing extra-data

## Migration Path

### Task 5: Add to Rust BridgeEnvelope
- Add `extra_data: Option<serde_json::Value>` field
- Update `BridgeEnvelope::new()` to initialize as `None`
- Update `BridgeEnvelope::new_replay()` to accept optional extra_data parameter
- Regenerate TypeScript bindings via `ts-rs`

### Task 8: Add to TypeScript Types
- Add `extraData?: Record<string, unknown>` to BridgeEnvelope interface
- Update any envelope construction helpers
- Ensure all envelope consumers handle optional extraData

## Versioning Considerations

Extra-data is backward-compatible:
- Old clients ignore unknown extra-data fields
- New clients handle missing extra-data gracefully
- No envelope version bump required for extra-data changes

## Security Considerations

- Extra-data is opaque JSON - no injection risk via structure
- Size limits should apply (same as other envelope fields)
- Harness-server should validate extra-data size before attaching
