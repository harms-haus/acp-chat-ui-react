# Bridge Protocol Specification

Complete specification of the ACP WebSocket Bridge communication protocol.

## Overview

The ACP WebSocket Bridge enables bidirectional communication between browser-based applications and ACP (Agent Communication Protocol) agents. The bridge acts as a transparent proxy, wrapping ACP JSON-RPC messages in a versioned envelope for reliable delivery.

## Architecture

```
┌─────────────┐      WebSocket       ┌──────────────┐      stdio      ┌─────────────┐
│   Browser   │ ◄──────────────────► │   Bridge     │ ◄─────────────► │  ACP Agent  │
│             │      (JSON)          │  Server      │      (stdio)    │             │
└─────────────┘                      └──────────────┘                 └─────────────┘
     │                                      │                               │
     │  TransportClient                     │                               │
     │  - Connects to bridge                │                               │
     │  - Sends init requests               │                               │
     │  - Receives envelopes                │                               │
     │                                      │                               │
     │  Message Flow:                       │                               │
     │  1. Browser → TransportClient        │                               │
     │  2. TransportClient → Bridge         │                               │
     │  3. Bridge → ACP Agent               │                               │
     │  4. ACP Agent → Bridge               │                               │
     │  5. Bridge → TransportClient         │                               │
     │  6. TransportClient → Browser        │                               │
```

## BridgeEnvelope Structure

All messages between the bridge and browser are wrapped in a `BridgeEnvelope`. This provides versioning, sequencing, and metadata support.

### TypeScript Type Definition

```typescript
interface BridgeEnvelope {
  version: number;              // Envelope format version (must be 1)
  seq: number;                  // Sequence number (0 in live mode, increasing in replay)
  timestamp_ms: number;         // Unix timestamp in milliseconds
  extraData?: Record<string, unknown>;  // Optional metadata
  // BridgeMessage variant (flattened)
  type: string;                 // Message type discriminator
  // ... message-specific fields
}
```

### Rust Type Definition

```rust
pub struct BridgeEnvelope {
    pub version: u32,
    pub seq: u64,
    pub timestamp_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_data: Option<serde_json::Value>,
    #[serde(flatten)]
    pub message: BridgeMessage,
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `number` | Yes | Envelope format version. Currently `1`. |
| `seq` | `number` | Yes | Sequence number. `0` in live mode, monotonically increasing in replay mode. |
| `timestamp_ms` | `number` | Yes | Unix timestamp (ms) when envelope was created. |
| `extraData` | `Record<string, unknown>` | No | Optional metadata. Omitted from JSON if undefined. |
| `type` | `string` | Yes | Message type discriminator (from flattened BridgeMessage). |

### JSON Example

```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "extraData": {
    "replaySpeed": 1.0
  },
  "type": "acp_payload",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }
}
```

## BridgeMessage Variants

The bridge supports 6 message variants, distinguished by the `type` field.

### 1. AcpPayload

Raw ACP JSON-RPC messages from the agent.

**Type:** `"acp_payload"`

**Fields:**
- `payload`: `JsonValue` - The raw JSON-RPC message

**Example:**
```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "type": "acp_payload",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "file_read",
      "arguments": { "path": "/tmp/test.txt" }
    }
  }
}
```

### 2. BridgeStatus

Bridge lifecycle state notifications.

**Type:** `"bridge_status"`

**Fields:**
- `status`: `BridgeStatus` - One of: `"starting"`, `"connected"`, `"reconnecting"`, `"disconnected"`, `"error"`

**Example:**
```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "type": "bridge_status",
  "status": "connected"
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `starting` | Bridge is initializing |
| `connected` | Bridge is connected and proxying ACP traffic |
| `reconnecting` | Bridge is attempting to reconnect |
| `disconnected` | Bridge has disconnected |
| `error` | Bridge encountered an error |

### 3. Stderr

Standard error output from the ACP agent process.

**Type:** `"stderr"`

**Fields:**
- `line`: `string` - The stderr line content

**Example:**
```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "type": "stderr",
  "line": "[ERROR] Failed to connect to MCP server"
}
```

### 4. ProcessExit

Notification that the ACP agent process has terminated.

**Type:** `"process_exit"`

**Fields:**
- `code`: `number | null` - Exit code (if available)
- `signal`: `string | null` - Termination signal (if any)

**Example:**
```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "type": "process_exit",
  "code": 0,
  "signal": null
}
```

**Example with signal:**
```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "type": "process_exit",
  "code": null,
  "signal": "SIGINT"
}
```

### 5. ReplayMetadata

Metadata at the start of a replay session.

**Type:** `"replay_metadata"`

**Fields:**
- `captured_at_ms`: `number` - Original capture timestamp
- `total_envelopes`: `number` - Total envelopes in replay file
- `description`: `string | null` - Optional session description

**Example:**
```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "type": "replay_metadata",
  "captured_at_ms": 1234500000,
  "total_envelopes": 150,
  "description": "Session with file operations"
}
```

### 6. StartAgent

Command to spawn an ACP agent process (client-to-server only).

**Type:** `"start_agent"`

**Fields:**
- `command`: `string` - Command to execute
- `args`: `string[]` - Command arguments
- `cwd`: `string | null` - Working directory
- `env`: `Array<[string, string]>` - Environment variables as key-value pairs

**Example:**
```json
{
  "version": 1,
  "seq": 0,
  "timestamp_ms": 1234567890,
  "type": "start_agent",
  "command": "node",
  "args": ["agent.js", "--verbose"],
  "cwd": "/workspace",
  "env": [
    ["NODE_ENV", "production"],
    ["API_KEY", "secret"]
  ]
}
```

## Message Flow

### Live Mode Flow

1. **Browser → Bridge: Init Request**
   ```json
   {
     "type": "init",
     "initId": "abc123",
     "mode": "live",
     "command": "node",
     "args": ["agent.js"],
     "cwd": "/workspace",
     "env": [["KEY", "value"]]
   }
   ```

2. **Bridge → Browser: Init Response**
   ```json
   {
     "type": "init",
     "initId": "abc123",
     "status": "success",
     "mode": "live"
   }
   ```

3. **Bridge → Browser: Status Updates**
   ```json
   {
     "version": 1,
     "seq": 0,
     "timestamp_ms": 1234567890,
     "type": "bridge_status",
     "status": "starting"
   }
   ```

4. **ACP Agent → Bridge → Browser: ACP Messages**
   ```json
   {
     "version": 1,
     "seq": 0,
     "timestamp_ms": 1234567891,
     "type": "acp_payload",
     "payload": {
       "jsonrpc": "2.0",
       "id": 1,
       "result": "success"
     }
   }
   ```

### Replay Mode Flow

1. **Browser → Bridge: Init Request**
   ```json
   {
     "type": "init",
     "initId": "def456",
     "mode": "replay",
     "script": "session.json",
     "sessionId": "my-session"
   }
   ```

2. **Bridge → Browser: Replay Metadata**
   ```json
   {
     "version": 1,
     "seq": 0,
     "timestamp_ms": 1234567890,
     "type": "replay_metadata",
     "captured_at_ms": 1234500000,
     "total_envelopes": 150,
     "description": "Recorded session"
   }
   ```

3. **Bridge → Browser: Replay Envelopes**
   ```json
   {
     "version": 1,
     "seq": 1,
     "timestamp_ms": 1234567891,
     "extraData": {
       "replaySpeed": 1.0
     },
     "type": "acp_payload",
     "payload": {
       "jsonrpc": "2.0",
       "id": 1,
       "method": "initialize"
     }
   }
   ```

## Init Protocol

### Init Request (Browser → Bridge)

Initiates a connection to the bridge.

**Fields:**
- `type`: `"init"` (constant)
- `initId`: `string` - Unique correlation ID
- `mode`: `"live" | "replay"` - Connection mode
- `command`?: `string` - Agent command (live mode only)
- `args`?: `string[]` - Agent arguments (live mode only)
- `cwd`?: `string` - Working directory (live mode only)
- `env`?: `Array<[string, string]>` - Environment variables (live mode only)
- `script`?: `string` - Replay script path (replay mode only)
- `sessionId`?: `string` - Session identifier (replay mode only)

### Init Response (Bridge → Browser)

Responds to an init request.

**Fields:**
- `type`: `"init"` (constant)
- `initId`: `string` - Matches request initId
- `status`: `"success" | "error"`
- `mode`: `"live" | "replay"`
- `message`?: `string` - Error message (if status is "error")

## Version Negotiation

### Current Version

- `ENVELOPE_VERSION = 1`
- `SUPPORTED_VERSIONS = [1]`

### Version Validation

The bridge validates envelope versions on receipt:

```typescript
// TypeScript
function isSupportedVersion(version: number): boolean {
  return version === 1;
}

// Rust
pub fn is_supported_version(&self) -> bool {
  SUPPORTED_VERSIONS.contains(&self.version)
}
```

### Unsupported Version Error

```json
{
  "received": 2,
  "supported": [1]
}
```

## extraData Field

The `extraData` field provides optional metadata that passes through the bridge unchanged.

### TypeScript Convention

```typescript
interface BridgeEnvelope {
  extraData?: Record<string, unknown>  // camelCase in TypeScript API
}
```

### JSON Serialization

```json
{
  "extraData": {              // camelCase preserved in JSON
    "replaySpeed": 1.0,
    "customField": "value"
  }
}
```

### Common Use Cases

**Replay Speed Control:**
```json
{
  "version": 1,
  "seq": 42,
  "timestamp_ms": 1234567890,
  "extraData": {
    "replaySpeed": 2.0
  },
  "type": "acp_payload",
  "payload": { ... }
}
```

**Custom Metadata:**
```json
{
  "version": 1,
  "seq": 42,
  "timestamp_ms": 1234567890,
  "extraData": {
    "traceId": "abc-123-def",
    "userId": "user-456",
    "tags": ["important", "review"]
  },
  "type": "acp_payload",
  "payload": { ... }
}
```

## Error Handling

### Malformed JSON

The bridge rejects envelopes with invalid JSON syntax:
- Empty strings
- Invalid JSON syntax
- Trailing commas
- Missing closing braces
- Non-object JSON values

### Missing Required Fields

Envelopes must include:
- `version`
- `seq`
- `timestamp_ms`
- `type` (message discriminator)

Missing any required field causes rejection.

### Type Mismatches

Field types must match:
- `version`: number
- `seq`: number
- `timestamp_ms`: number

Type mismatches cause deserialization failures.

## Field Naming Convention

### JSON Wire Format

Uses `snake_case` for compatibility with Rust:
- `timestamp_ms` (not `timestampMs`)
- `captured_at_ms` (not `capturedAtMs`)
- `total_envelopes` (not `totalEnvelopes`)
- `extra_data` in Rust, `extraData` in TypeScript

### TypeScript API

Uses camelCase for TypeScript idioms:
- `extraData` (serialized as `extraData` in JSON)
- `timestampMs` parameter (serialized as `timestamp_ms`)
- `capturedAtMs` parameter (serialized as `captured_at_ms`)

## Reference

- **Source Files:**
  - Rust: `crates/acp-ws-bridge/src/contract/envelope.rs`
  - Rust: `crates/acp-ws-bridge/src/contract/message.rs`
  - TypeScript: `packages/acp-chat-core/src/generated/BridgeEnvelope.ts`
  - TypeScript: `packages/acp-ws-bridge/src/client.ts`

- **Tests:**
  - Rust: 147 tests in `crates/acp-ws-bridge/src/`
  - TypeScript: 95 tests in `packages/acp-ws-bridge/src/`

- **Coverage:**
  - Rust: >80% line coverage
  - TypeScript: 82.83% line coverage, 91.66% branch coverage
