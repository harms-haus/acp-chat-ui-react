# ACP Protocol Reference

Official specification of the Agent Client Protocol (ACP) as implemented in `@harms-haus/acp-chat-core`.

## Protocol Overview

**ACP (Agent Client Protocol)** is a JSON-RPC 2.0 based protocol for communication between clients and AI agents.

### Key Concepts

- **Sessions**: Isolated conversation contexts
- **Prompt Turns**: Request/response cycles
- **Notifications**: Asynchronous agent updates
- **Capabilities**: Feature negotiation

### Transport Mechanisms

- JSON-RPC 2.0 over stdio
- HTTP/WebSocket (via bridge)
- Version negotiation

## Protocol Initialization

### Client Capabilities

```typescript
interface ClientCapabilities {
  protocolVersion: string;
  capabilities: {
    sampling?: boolean;
    experimental?: Record<string, unknown>;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}
```

### Agent Capabilities

```typescript
interface AgentCapabilities {
  protocolVersion: string;
  capabilities: {
    tools?: boolean;
    prompts?: boolean;
    resources?: boolean;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}
```

### Initialize Flow

```typescript
// Client sends
{
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: { ... },
    clientInfo: { name: "acp-chat-core", version: "0.0.1" }
  }
}

// Agent responds
{
  jsonrpc: "2.0",
  id: 1,
  result: {
    protocolVersion: "2024-11-05",
    capabilities: { ... },
    serverInfo: { name: "agent", version: "1.0.0" }
  }
}
```

## Session Management

### Session States

- `idle` - Session initialized, awaiting prompt
- `processing` - Agent processing prompt
- `complete` - Prompt processing finished
- `error` - Error occurred

### Core Methods

#### `session/new`
Create a new session.

```typescript
interface NewSessionRequest {
  jsonrpc: "2.0";
  id: number;
  method: "session/new";
  params: {
    cwd: string;
    mcpServers?: unknown[];
    config?: SessionConfig;
  };
}
```

#### `session/load`
Load existing session.

```typescript
interface LoadSessionRequest {
  jsonrpc: "2.0";
  id: number;
  method: "session/load";
  params: {
    sessionId: string;
  };
}
```

#### `session/prompt`
Send prompt to agent.

```typescript
interface PromptRequest {
  jsonrpc: "2.0";
  id: number;
  method: "session/prompt";
  params: {
    prompt: string;
  };
}
```

#### `session/cancel`
Cancel current prompt.

```typescript
interface CancelRequest {
  jsonrpc: "2.0";
  id: number;
  method: "session/cancel";
  params: {
    sessionId: string;
  };
}
```

## Content Blocks

### `TextContent`
Plain text content.

```typescript
interface TextContent {
  type: 'text';
  text: string;
}
```

### `ImageContent`
Image content (base64 or URL).

```typescript
interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}
```

### `ResourceLink`
Link to external resource.

```typescript
interface ResourceLink {
  type: 'resource_link';
  uri: string;
  name: string;
  description?: string;
}
```

## Session Update Events

| Event | Description |
|-------|-------------|
| `user_message` | User message content |
| `agent_message_chunk` | Streaming agent response |
| `agent_thought_chunk` | Agent thought process |
| `tool_call` | Tool invocation |
| `tool_call_update` | Tool call status update |
| `permission_request` | Permission request |

## Protocol Versioning

### Semantic Versioning
ACP uses date-based versioning (e.g., `2024-11-05`).

### Capability Negotiation
Client and agent exchange capabilities during initialization.

### Extensibility
Protocol supports experimental features via capabilities object.

## Error Handling

### Standard JSON-RPC Error Codes

| Code | Description |
|------|-------------|
| `-32600` | Invalid Request |
| `-32601` | Method Not Found |
| `-32602` | Invalid Params |
| `-32603` | Internal Error |

### ACP-Specific Errors

| Code | Description |
|------|-------------|
| `-1` | Session not found |
| `-2` | Invalid session state |
| `-3` | Permission denied |
| `-4` | Tool execution failed |

## Related Documentation

- [Session Management](./acp-chat-core-Session-Management) - Controller API
- [Events](./acp-chat-core-Events) - Event system
- [Types Reference](./acp-chat-core-Types-Reference) - Type definitions
- [Implementation Guide](./acp-chat-core-Implementation-Guide) - Usage patterns
