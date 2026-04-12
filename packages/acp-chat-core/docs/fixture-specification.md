# Test Fixture Specification

This document describes the format and structure of replay fixtures used for integration testing in ACP Chat Core.

---

## Overview

Fixtures enable deterministic replay of ACP protocol sessions for testing. Each fixture consists of two files stored in a timestamped directory:

```
fixtures/replay-data/captured/{timestamp}/
├── replay-events.jsonl    # Event stream (JSONL format)
└── session-data.json      # Session metadata
```

---

## Directory Structure

### Location

All captured fixtures live in:

```
fixtures/replay-data/captured/
```

### Directory Naming

Each fixture directory is named with a Unix timestamp in milliseconds:

```
1775354041629/
1775723460426/
1775883968100/
```

This ensures unique, sortable directory names that reflect when the fixture was captured.

---

## File 1: replay-events.jsonl

### Format

**JSONL (JSON Lines)**: One JSON object per line, no commas between objects.

```jsonl
{"envelope":{...},"tokenCount":29,"timestamp":1775354041629,"direction":"in"}
{"envelope":{...},"tokenCount":45,"timestamp":1775354041730,"direction":"out"}
```

### Event Structure

Each line contains a single replay event with the following structure:

```typescript
interface ReplayEvent {
  envelope: BridgeEnvelope;      // Wrapped protocol message
  tokenCount: number;            // Token usage for this event
  timestamp: number;             // Unix timestamp (ms)
  direction: "in" | "out";       // Message direction
}
```

### BridgeEnvelope Structure

The envelope wraps the ACP protocol message:

```typescript
interface BridgeEnvelope {
  version: number;         // Protocol version (currently 1)
  seq: number;             // Sequence number (0-indexed)
  timestamp_ms: number;    // Event timestamp in milliseconds
  type: string;            // Message type (e.g., "acp_payload")
  payload: unknown;        // The actual protocol message
}
```

### Envelope Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | `number` | Protocol version. Currently always `1`. |
| `seq` | `number` | Zero-indexed sequence number. Increments for each event. |
| `timestamp_ms` | `number` | Unix timestamp in milliseconds when event occurred. |
| `type` | `string` | Message type. Currently always `"acp_payload"` for protocol messages. |
| `payload` | `unknown` | The wrapped protocol message (JSON-RPC format). |

### Replay Event Fields

| Field | Type | Description |
|-------|------|-------------|
| `envelope` | `BridgeEnvelope` | The wrapped protocol message. |
| `tokenCount` | `number` | Number of tokens used by this event. Used for token tracking. |
| `timestamp` | `number` | Unix timestamp in milliseconds. Same as `envelope.timestamp_ms`. |
| `direction` | `"in" \| "out"` | Message direction. `"in"` for incoming messages, `"out"` for outgoing. |

### Example Event

```jsonl
{"envelope":{"version":1,"seq":0,"timestamp_ms":1775354041629,"type":"acp_payload","payload":{"jsonrpc":"2.0","method":"test"}},"tokenCount":29,"timestamp":1775354041629,"direction":"in"}
```

**Breakdown:**
- `envelope.version`: `1` (protocol version)
- `envelope.seq`: `0` (first event in sequence)
- `envelope.timestamp_ms`: `1775354041629` (when event was captured)
- `envelope.type`: `"acp_payload"` (message type)
- `envelope.payload`: `{"jsonrpc":"2.0","method":"test"}` (the actual protocol message)
- `tokenCount`: `29` (tokens used)
- `timestamp`: `1775354041629` (same as envelope timestamp)
- `direction`: `"in"` (incoming message)

### Payload Format

The `payload` field contains JSON-RPC 2.0 messages:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {...},
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {...},
  "id": 1
}
```

**Notification:**
```json
{
  "jsonrpc": "2.0",
  "method": "notify",
  "params": {...}
}
```

---

## File 2: session-data.json

### Format

**Standard JSON**: Single JSON object containing session metadata.

### Structure

```typescript
interface SessionData {
  sessionId: string;           // Unique session identifier
  startTime: number;           // Session start timestamp (ms)
  endTime: number;             // Session end timestamp (ms)
  preExistingState: unknown;   // Optional pre-existing session state
  modes: string[];             // Active session modes
  models: string[];            // Models used in session
  eventCount: number;          // Total number of events
  totalTokenCount: number;     // Total tokens used
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | Unique identifier for the session. Example: `"session-123"`. |
| `startTime` | `number` | Unix timestamp in milliseconds when session started. |
| `endTime` | `number` | Unix timestamp in milliseconds when session ended. |
| `preExistingState` | `unknown \| null` | Optional state from a previous session. `null` if none. |
| `modes` | `string[]` | Array of active session modes. Empty array if none. |
| `models` | `string[]` | Array of model names used. Empty array if none. |
| `eventCount` | `number` | Total number of events in `replay-events.jsonl`. |
| `totalTokenCount` | `number` | Sum of all `tokenCount` values from events. |

### Example session-data.json

```json
{
  "sessionId": "session-123",
  "startTime": 1775354041629,
  "endTime": 1775354041629,
  "preExistingState": null,
  "modes": [],
  "models": [],
  "eventCount": 1,
  "totalTokenCount": 29
}
```

---

## Complete Fixture Example

### Directory Structure

```
fixtures/replay-data/captured/1775354041629/
├── replay-events.jsonl
└── session-data.json
```

### replay-events.jsonl

```jsonl
{"envelope":{"version":1,"seq":0,"timestamp_ms":1775354041629,"type":"acp_payload","payload":{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"1.0"},"id":1}},"tokenCount":45,"timestamp":1775354041629,"direction":"out"}
{"envelope":{"version":1,"seq":1,"timestamp_ms":1775354041730,"type":"acp_payload","payload":{"jsonrpc":"2.0","result":{"capabilities":{}},"id":1}},"tokenCount":32,"timestamp":1775354041730,"direction":"in"}
{"envelope":{"version":1,"seq":2,"timestamp_ms":1775354041850,"type":"acp_payload","payload":{"jsonrpc":"2.0","method":"chat/create","params":{"messages":[]},"id":2}},"tokenCount":67,"timestamp":1775354041850,"direction":"out"}
{"envelope":{"version":1,"seq":3,"timestamp_ms":1775354042100,"type":"acp_payload","payload":{"jsonrpc":"2.0","result":{"sessionId":"abc123"},"id":2}},"tokenCount":28,"timestamp":1775354042100,"direction":"in"}
```

### session-data.json

```json
{
  "sessionId": "session-123",
  "startTime": 1775354041629,
  "endTime": 1775354042100,
  "preExistingState": null,
  "modes": ["proxy"],
  "models": ["gpt-4"],
  "eventCount": 4,
  "totalTokenCount": 172
}
```

---

## Creating New Fixtures

### Method 1: Capture from Live Session

Fixtures are automatically captured during integration test runs.

**Process:**
1. Run integration test with capture enabled
2. Test executes against real ACP bridge
3. All events are recorded to `replay-events.jsonl`
4. Session metadata saved to `session-data.json`
5. Fixture directory created with timestamp name

**Location:** Captured fixtures appear in `fixtures/replay-data/captured/{timestamp}/`

### Method 2: Manual Creation

You can create fixtures manually for specific test scenarios.

**Steps:**

1. **Create directory:**
   ```bash
   mkdir -p fixtures/replay-data/captured/$(date +%s%3N)
   ```

2. **Create replay-events.jsonl:**
   ```jsonl
   {"envelope":{"version":1,"seq":0,"timestamp_ms":1234567890123,"type":"acp_payload","payload":{"jsonrpc":"2.0","method":"test"}},"tokenCount":29,"timestamp":1234567890123,"direction":"in"}
   ```

3. **Create session-data.json:**
   ```json
   {
     "sessionId": "test-session",
     "startTime": 1234567890123,
     "endTime": 1234567890123,
     "preExistingState": null,
     "modes": [],
     "models": [],
     "eventCount": 1,
     "totalTokenCount": 29
   }
   ```

4. **Update counts:** Ensure `eventCount` matches number of lines in JSONL file and `totalTokenCount` is sum of all `tokenCount` values.

---

## Using Fixtures in Tests

### Loading Fixtures

Fixtures are loaded by the `ReplayBridge` class for deterministic testing.

```typescript
import { ReplayBridge } from './ReplayBridge';

const bridge = new ReplayBridge('fixtures/replay-data/captured/1775354041629');
await bridge.connect();
```

### Fixture Replay Behavior

1. Events are replayed in sequence order (`seq` field)
2. Timing can be preserved or accelerated
3. Direction determines mock behavior (in vs out)
4. Token counts are tracked for testing

---

## Reference

### Type Definitions

```typescript
// Full replay event
interface ReplayEvent {
  envelope: {
    version: number;
    seq: number;
    timestamp_ms: number;
    type: string;
    payload: unknown;
  };
  tokenCount: number;
  timestamp: number;
  direction: "in" | "out";
}

// Session metadata
interface SessionData {
  sessionId: string;
  startTime: number;
  endTime: number;
  preExistingState: unknown | null;
  modes: string[];
  models: string[];
  eventCount: number;
  totalTokenCount: number;
}
```

### Validation Rules

- `seq` values must be sequential (0, 1, 2, ...)
- `timestamp` and `envelope.timestamp_ms` must match
- `eventCount` must equal number of lines in JSONL
- `totalTokenCount` must equal sum of all `tokenCount` values
- All timestamps are Unix milliseconds (not seconds)

---

## Related Documentation

- [Integration Testing Patterns](./integration-testing-patterns.md) - How fixtures are used in tests
- [Unit Testing Patterns](./unit-testing-patterns.md) - Mock-based testing approaches

---

**Last Updated:** April 2026  
**Location:** `packages/acp-chat-core/docs/fixture-specification.md`
