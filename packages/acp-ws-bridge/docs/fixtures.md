# Test Fixtures Specification

Complete guide to test data builders and fixtures for the ACP WebSocket Bridge.

## Overview

The ws-bridge project uses the builder pattern for creating test fixtures. This approach provides:

- **Type safety** - Compile-time verification of required fields
- **Readability** - Fluent API makes test intent clear
- **Reusability** - Common patterns encapsulated in helper methods
- **Maintainability** - Changes to test data structure in one place

## Rust Test Utilities

### Location

`crates/acp-ws-bridge/src/test_utils.rs`

### EnvelopeBuilder

Builder pattern for creating `BridgeEnvelope` instances.

#### Basic Usage

```rust
use acp_ws_bridge::test_utils::{EnvelopeBuilder, MessageBuilder};

let envelope = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_payload(json!({"method": "test"})))
    .version(1)
    .seq(42)
    .timestamp_ms(1234567890)
    .extra_data(json!({"metadata": "value"}))
    .build();
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `new()` | - | `Self` | Creates builder with defaults |
| `version()` | `version: u32` | `Self` | Sets envelope version |
| `seq()` | `seq: u64` | `Self` | Sets sequence number |
| `timestamp_ms()` | `timestamp_ms: u64` | `Self` | Sets timestamp |
| `extra_data()` | `extra_data: serde_json::Value` | `Self` | Sets metadata |
| `message()` | `message: BridgeMessage` | `Self` | Sets message payload |
| `build()` | - | `BridgeEnvelope` | Builds the envelope |

#### Default Values

```rust
let builder = EnvelopeBuilder::new();
// version: ENVELOPE_VERSION (1)
// seq: 0
// timestamp_ms: 1234567890
// extra_data: None
// message: None (must be set before build())
```

#### Example: Live Mode Envelope

```rust
let live_envelope = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_payload(json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {}
    })))
    .version(1)
    .seq(0)  // seq is 0 in live mode
    .timestamp_ms(1234567890)
    .build();
```

#### Example: Replay Mode Envelope

```rust
let replay_envelope = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_payload(json!({
        "jsonrpc": "2.0",
        "id": 42,
        "result": "success"
    })))
    .version(1)
    .seq(150)  // Monotonically increasing in replay
    .timestamp_ms(1234567890)
    .extra_data(json!({
        "replaySpeed": 2.0
    }))
    .build();
```

### MessageBuilder

Helper methods for creating `BridgeMessage` variants.

#### ACP Payload

```rust
use acp_ws_bridge::test_utils::MessageBuilder;

// Simple payload
let msg = MessageBuilder::acp_payload(json!({
    "method": "tools/call",
    "params": { "name": "file_read" }
}));

// JSON-RPC request
let request = MessageBuilder::acp_request(
    "tools/call",
    json!({ "name": "file_write", "arguments": {"path": "/tmp/test.txt"} })
);
```

#### Bridge Status

```rust
use acp_ws_bridge::contract::BridgeStatus;

let status_msg = MessageBuilder::bridge_status(BridgeStatus::Connected);
```

#### Stderr

```rust
let stderr_msg = MessageBuilder::stderr("[ERROR] Connection failed");
```

#### Process Exit

```rust
// With exit code
let exit_msg = MessageBuilder::process_exit(Some(0), None);

// With signal
let signal_exit = MessageBuilder::process_exit(None, Some("SIGINT"));

// With both
let full_exit = MessageBuilder::process_exit(Some(1), Some("SIGTERM"));
```

#### Replay Metadata

```rust
let replay_msg = MessageBuilder::replay_metadata(
    1234500000,                    // captured_at_ms
    150,                           // total_envelopes
    Some("Test session")           // description
);
```

#### Start Agent

```rust
let start_msg = MessageBuilder::start_agent(
    "node",                                    // command
    vec!["agent.js", "--verbose"],            // args
    Some("/workspace"),                        // cwd
    vec![("NODE_ENV", "test")]                // env
);
```

### TestConstants

Pre-built sample data for common scenarios.

```rust
use acp_ws_bridge::test_utils::constants;

// Sample timestamp
let ts = constants::SAMPLE_TIMESTAMP_MS;  // 1234567890

// Sample ACP payload
let acp_payload = constants::SAMPLE_ACP_PAYLOAD;

// Sample stderr line
let stderr_line = constants::SAMPLE_STDERR_LINE;
```

### Complete Test Example

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{EnvelopeBuilder, MessageBuilder};
    use serde_json::json;

    #[test]
    fn test_envelope_serialization() {
        let envelope = EnvelopeBuilder::new()
            .message(MessageBuilder::acp_request(
                "tools/call",
                json!({ "name": "test" })
            ))
            .version(1)
            .seq(42)
            .timestamp_ms(1234567890)
            .extra_data(json!({ "traceId": "abc-123" }))
            .build();

        let json = serde_json::to_string(&envelope).unwrap();
        assert!(json.contains("\"version\":1"));
        assert!(json.contains("\"seq\":42"));
    }
}
```

## TypeScript Test Utilities

### Location

`packages/acp-ws-bridge/src/test-utils.ts`

### MockWebSocket

Simulates WebSocket behavior without network connections.

#### Setup

```typescript
import { MockWebSocket } from "./test-utils.js";

let originalWebSocket: typeof WebSocket;

beforeEach(() => {
  originalWebSocket = global.WebSocket;
  global.WebSocket = MockWebSocket as any;
  vi.useFakeTimers();
});

afterEach(() => {
  global.WebSocket = originalWebSocket;
  vi.useRealTimers();
});
```

#### Connection Control

```typescript
const client = new TransportClient({ url: "ws://localhost:8080" });
client.connect();

const mockWs = (client as unknown as { ws: MockWebSocket }).ws;

// Simulate connection events
mockWs.simulateOpen();
mockWs.simulateMessage('{"type": "test"}');
mockWs.simulateMessageJson({ type: "test" });
mockWs.simulateError();
mockWs.simulateClose(1000, "Normal closure");

// Simulate connection failure
mockWs.failOnOpen(true);
```

#### Message Inspection

```typescript
// Get all sent messages
const messages = mockWs.getSentMessages();
expect(messages).toHaveLength(1);

// Parse and verify
const sent = JSON.parse(messages[0]!);
expect(sent.type).toBe("init");

// Clear buffer
mockWs.clearSentMessages();
```

### EnvelopeBuilder

Builder pattern for creating `BridgeEnvelope` instances.

#### Basic Usage

```typescript
import { EnvelopeBuilder, MessageBuilder } from "./test-utils.js";

const envelope = EnvelopeBuilder.new()
  .message(MessageBuilder.acpPayload({ method: "test" }))
  .version(1)
  .seq(42)
  .timestampMs(1234567890)
  .extraData({ metadata: "value" })
  .build();
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `new()` | - | `EnvelopeBuilder` | Creates builder with defaults |
| `version()` | `version: number` | `this` | Sets envelope version |
| `seq()` | `seq: number` | `this` | Sets sequence number |
| `timestampMs()` | `timestampMs: number` | `this` | Sets timestamp |
| `extraData()` | `extraData: Record<string, unknown>` | `this` | Sets metadata |
| `message()` | `message: BridgeMessage` | `this` | Sets message payload |
| `build()` | - | `BridgeEnvelope` | Builds the envelope |

#### Default Values

```typescript
const builder = EnvelopeBuilder.new();
// version: 1
// seq: 0
// timestampMs: 1234567890
// extraData: undefined
// message: must be set before build()
```

### MessageBuilder

Helper methods for creating `BridgeMessage` instances.

#### ACP Payload

```typescript
import { MessageBuilder } from "./test-utils.js";

// Simple payload
const msg = MessageBuilder.acpPayload({
  method: "tools/call",
  params: { name: "file_read" },
});

// JSON-RPC request
const request = MessageBuilder.acpRequest("tools/call", {
  name: "file_write",
  arguments: { path: "/tmp/test.txt" },
});
```

#### Bridge Status

```typescript
const statusMsg = MessageBuilder.bridgeStatus("connected");
```

#### Stderr

```typescript
const stderrMsg = MessageBuilder.stderr("[ERROR] Connection failed");
```

#### Process Exit

```typescript
// With exit code
const exitMsg = MessageBuilder.processExit(0, null);

// With signal
const signalExit = MessageBuilder.processExit(null, "SIGINT");

// With both
const fullExit = MessageBuilder.processExit(1, "SIGTERM");
```

#### Replay Metadata

```typescript
const replayMsg = MessageBuilder.replayMetadata(
  1234500000,          // capturedAtMs
  150,                 // totalEnvelopes
  "Test session"       // description
);
```

#### Start Agent

```typescript
const startMsg = MessageBuilder.startAgent(
  "node",                              // command
  ["agent.js", "--verbose"],          // args
  "/workspace",                        // cwd
  [["NODE_ENV", "test"]]              // env
);
```

### TestConstants

Pre-built sample envelopes for common scenarios.

```typescript
import { TestConstants } from "./test-utils.js";

// ACP payload envelope
const acpEnvelope = TestConstants.sampleEnvelopeAcpPayload();

// Bridge status envelope
const statusEnvelope = TestConstants.sampleEnvelopeBridgeStatus("connected");

// Stderr envelope
const stderrEnvelope = TestConstants.sampleEnvelopeStderr();

// Process exit envelope
const exitEnvelope = TestConstants.sampleEnvelopeProcessExit(1, "SIGTERM");

// Replay metadata envelope
const replayEnvelope = TestConstants.sampleEnvelopeReplayMetadata();

// Start agent envelope
const startEnvelope = TestConstants.sampleEnvelopeStartAgent();
```

### AsyncTestHelpers

Utilities for async test patterns.

```typescript
import { AsyncTestHelpers } from "./test-utils.js";

// Wait for delay
await AsyncTestHelpers.wait(1000);

// Wait for condition
await AsyncTestHelpers.waitForCondition(
  () => client.getStatus() === "connected",
  5000,  // timeout
  100    // check interval
);

// Capture events
const events = await AsyncTestHelpers.captureEvents(
  client,
  "statusChange",
  3  // number of events
);

// Create deferred promise
const { promise, resolve, reject } = AsyncTestHelpers.createDeferred<string>();
// Later: resolve("value") or reject(new Error("failed"))
```

### Complete Test Example

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TransportClient } from "./client.js";
import {
  MockWebSocket,
  EnvelopeBuilder,
  MessageBuilder,
  TestConstants,
} from "./test-utils.js";

describe("TransportClient Message Handling", () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it("should emit envelope event on valid message", () => {
    const client = new TransportClient({ url: "ws://localhost:8080" });
    const envelopeHandler = vi.fn();

    client.on("envelope", envelopeHandler);

    client.connect();
    const mockWs = (client as unknown as { ws: MockWebSocket }).ws;
    mockWs.simulateOpen();

    // Create test envelope using builders
    const envelope = EnvelopeBuilder.new()
      .message(
        MessageBuilder.acpPayload({
          jsonrpc: "2.0",
          id: 1,
          method: "test",
          params: {},
        })
      )
      .version(1)
      .seq(0)
      .timestampMs(1234567890)
      .build();

    // Simulate receiving the envelope
    mockWs.simulateMessageJson(envelope);

    expect(envelopeHandler).toHaveBeenCalledTimes(1);
    expect(envelopeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        seq: 0,
        type: "acp_payload",
      })
    );
  });
});
```

## Usage Patterns

### Pattern 1: Minimal Envelope

```rust
// Rust
let envelope = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_payload(json!({})))
    .build();
```

```typescript
// TypeScript
const envelope = EnvelopeBuilder.new()
  .message(MessageBuilder.acpPayload({}))
  .build();
```

### Pattern 2: Complete Envelope

```rust
// Rust
let envelope = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_request(
        "tools/call",
        json!({ "name": "file_read", "arguments": {"path": "/tmp/test.txt"} })
    ))
    .version(1)
    .seq(42)
    .timestamp_ms(1234567890)
    .extra_data(json!({
        "traceId": "abc-123",
        "userId": "user-456"
    }))
    .build();
```

```typescript
// TypeScript
const envelope = EnvelopeBuilder.new()
  .message(
    MessageBuilder.acpRequest("tools/call", {
      name: "file_read",
      arguments: { path: "/tmp/test.txt" },
    })
  )
  .version(1)
  .seq(42)
  .timestampMs(1234567890)
  .extraData({
    traceId: "abc-123",
    userId: "user-456",
  })
  .build();
```

### Pattern 3: All Message Variants

```rust
// Rust - Test all variants
let variants = vec![
    MessageBuilder::acp_payload(json!({"method": "test"})),
    MessageBuilder::bridge_status(BridgeStatus::Connected),
    MessageBuilder::stderr("Error message"),
    MessageBuilder::process_exit(Some(0), None),
    MessageBuilder::replay_metadata(1234567890, 100, Some("Session")),
    MessageBuilder::start_agent("node", vec!["script.js"], None, vec![]),
];
```

```typescript
// TypeScript - Test all variants
const variants = [
  MessageBuilder.acpPayload({ method: "test" }),
  MessageBuilder.bridgeStatus("connected"),
  MessageBuilder.stderr("Error message"),
  MessageBuilder.processExit(0, null),
  MessageBuilder.replayMetadata(1234567890, 100, "Session"),
  MessageBuilder.startAgent("node", ["script.js"], null, []),
];
```

### Pattern 4: Edge Cases

```rust
// Rust - Edge cases
let empty_envelope = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_payload(json!({})))
    .extra_data(json!({}))  // Empty object
    .build();

let null_extra_data = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_payload(json!({})))
    .build();  // extra_data is None

let unicode_envelope = EnvelopeBuilder::new()
    .message(MessageBuilder::acp_payload(json!({})))
    .extra_data(json!({
        "emoji": "🚀",
        "chinese": "你好",
        "arabic": "مرحبا"
    }))
    .build();
```

```typescript
// TypeScript - Edge cases
const emptyEnvelope = EnvelopeBuilder.new()
  .message(MessageBuilder.acpPayload({}))
  .extraData({})  // Empty object
  .build();

const nullExtraData = EnvelopeBuilder.new()
  .message(MessageBuilder.acpPayload({}))
  .build();  // extraData is undefined

const unicodeEnvelope = EnvelopeBuilder.new()
  .message(MessageBuilder.acpPayload({}))
  .extraData({
    emoji: "🚀",
    chinese: "你好",
    arabic: "مرحبا",
  })
  .build();
```

## Best Practices

1. **Use builders for complex fixtures** - Builders make test intent clear
2. **Leverage TestConstants** - Start with samples, customize as needed
3. **Test with realistic data** - Use actual ACP JSON-RPC structures
4. **Cover all variants** - Test each BridgeMessage type
5. **Include edge cases** - Empty objects, null values, unicode
6. **Keep builders fluent** - Method chaining improves readability
7. **Document custom helpers** - Add comments for non-obvious test data

## Reference

- **Rust Utilities:** `crates/acp-ws-bridge/src/test_utils.rs` (297 lines)
- **TypeScript Utilities:** `packages/acp-ws-bridge/src/test-utils.ts` (495 lines)
- **Test Examples:**
  - Rust: `crates/acp-ws-bridge/src/contract/envelope.rs` (147 tests)
  - Rust: `crates/acp-ws-bridge/src/contract/message.rs` (85 tests)
  - TypeScript: `packages/acp-ws-bridge/src/client.test.ts` (40 tests)
  - TypeScript: `packages/acp-ws-bridge/src/envelope.test.ts` (51 tests)
