# ACP Protocol Reference

This page documents the **Agent Client Protocol (ACP)** — the standardized protocol that `acp-chat-core` uses to communicate with AI agents. Understanding ACP is essential for working with the core library, building custom integrations, or debugging protocol-level issues.

---

## Table of Contents

- [1. Protocol Overview](#1-protocol-overview)
- [2. Protocol Initialization](#2-protocol-initialization)
- [3. Session Management](#3-session-management)
- [4. Prompt Turn Processing](#4-prompt-turn-processing)
- [5. Session Update Events](#5-session-update-events)
- [6. Content Blocks](#6-content-blocks)
- [7. File System Operations](#7-file-system-operations)
- [8. Tool Calls and Permissions](#8-tool-calls-and-permissions)
- [9. Session Modes](#9-session-modes)
- [10. Event Lifecycle and Ordering](#10-event-lifecycle-and-ordering)
- [11. Protocol Versioning](#11-protocol-versioning)
- [12. Message Structure (JSON-RPC 2.0)](#12-message-structure-json-rpc-20)
- [13. Error Handling](#13-error-handling)
- [14. Semantic Mappings to acp-chat-core](#14-semantic-mappings-to-acp-chat-core)

---

## 1. Protocol Overview

### What is ACP?

The **Agent Client Protocol (ACP)** is an open standard that defines how AI coding agents and client applications (like code editors) communicate. It solves the same problem for AI agents that the Language Server Protocol (LSP) solved for language servers — instead of every editor building a custom integration for every agent, ACP provides a single, standardized protocol.

**Without ACP**: Each editor must build custom integrations for every agent, and each agent must implement editor-specific APIs. This creates integration overhead, limited compatibility, and developer lock-in.

**With ACP**: Agents that implement ACP work with any compatible client, and clients that support ACP gain access to all ACP-compatible agents.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Agent** | An AI program (e.g., Claude Code, Goose, Kiro) that processes prompts and performs tasks. Runs as a subprocess of the Client. |
| **Client** | The application (typically an IDE or editor) that provides the interface between users and agents. Manages the environment, user interactions, and resource access. |
| **Session** | An independent conversation context with a unique ID. Each session maintains its own message history, agent state, tool calls, and configuration. |
| **Prompt Turn** | A complete interaction cycle: user sends a message, agent processes it (possibly invoking tools), and responds. Turns may involve multiple round-trips to the language model. |
| **Capabilities** | Feature flags exchanged during initialization that describe what each side supports (e.g., file system access, image prompts, session loading). |
| **Notification** | A one-way JSON-RPC message that does not expect a response. Used for streaming updates. |
| **MCP Servers** | Model Context Protocol servers that agents can connect to for accessing external tools and data sources. |

### Transport

ACP uses **JSON-RPC 2.0** as its message format. The protocol defines the following transports:

| Transport | Description | Use Case |
|-----------|-------------|----------|
| **stdio** | Agent reads from `stdin`, writes to `stdout`. Messages are newline-delimited JSON. | Default. Used when clients spawn agents as subprocesses. |
| **Streamable HTTP** | HTTP-based transport (draft proposal in progress). | For remote or stateless clients. |
| **Custom** | Any bidirectional channel that supports JSON-RPC message exchange. | For WebSocket bridges, custom integrations. |

In `acp-chat-core`, the Rust bridge provides a **WebSocket** transport that wraps the underlying stdio communication with the agent. The bridge handles process management and message forwarding, exposing a WebSocket endpoint to the TypeScript client.

**stdio rules:**
- Messages are individual JSON-RPC requests, notifications, or responses
- Messages are delimited by newlines (`\n`) and MUST NOT contain embedded newlines
- Agents MAY write UTF-8 strings to `stderr` for logging
- Agents MUST NOT write anything to `stdout` that is not a valid ACP message

---

## 2. Protocol Initialization

Every ACP connection begins with an initialization handshake. This is mandatory — clients **MUST NOT** create sessions before initialization completes.

### Initialization Flow

```
Client                                          Agent
  │                                               │
  │  ─── initialize (request) ──────────────────► │
  │                                               │
  │  ◄── initialize (response: capabilities) ─── │
  │                                               │
  │            Connection initialized             │
```

### Client → Agent: `initialize`

The client sends the latest protocol version it supports, its capabilities, and identifying information:

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": {
        "readTextFile": true,
        "writeTextFile": true
      },
      "terminal": true
    },
    "clientInfo": {
      "name": "acp-chat-react-harness",
      "title": "ACP Chat React",
      "version": "1.0.0"
    }
  }
}
```

### Agent → Client: Response

The agent responds with the negotiated protocol version, its own capabilities, and identifying information:

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": {
        "image": true,
        "audio": false,
        "embeddedContext": true
      },
      "mcpCapabilities": {
        "http": true,
        "sse": false
      }
    },
    "agentInfo": {
      "name": "my-agent",
      "title": "My Agent",
      "version": "1.0.0"
    },
    "authMethods": []
  }
}
```

### ClientCapabilities

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fs.readTextFile` | `boolean` | `false` | Client supports `fs/read_text_file` method |
| `fs.writeTextFile` | `boolean` | `false` | Client supports `fs/write_text_file` method |
| `terminal` | `boolean` | `false` | Client supports all `terminal/*` methods |

All client capabilities are **OPTIONAL**. Omitted capabilities are treated as unsupported.

### AgentCapabilities

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `loadSession` | `boolean` | `false` | Agent supports `session/load` for resuming previous sessions |
| `promptCapabilities.image` | `boolean` | `false` | Agent accepts `ContentBlock::Image` in prompts |
| `promptCapabilities.audio` | `boolean` | `false` | Agent accepts `ContentBlock::Audio` in prompts |
| `promptCapabilities.embeddedContext` | `boolean` | `false` | Agent accepts `ContentBlock::Resource` (embedded resources) in prompts |
| `mcpCapabilities.http` | `boolean` | `false` | Agent can connect to MCP servers over HTTP |
| `mcpCapabilities.sse` | `boolean` | `false` | Agent can connect to MCP servers over SSE (deprecated by MCP spec) |

As a baseline, all agents **MUST** support `ContentBlock::Text` and `ContentBlock::ResourceLink` in prompts, regardless of `promptCapabilities`.

### authMethods

If the agent requires authentication, it returns an array of auth method objects:

```json
{
  "id": "provider-config",
  "name": "Configure Provider",
  "description": "Run setup to configure your AI provider"
}
```

When `authMethods` is empty or absent, no authentication is needed.

---

## 3. Session Management

Sessions represent independent conversation contexts. Each session has its own history, state, working directory, and configuration. After initialization, clients create sessions before sending prompts.

### `session/new` — Create a Session

Creates a new conversation with a unique session ID.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/new",
  "params": {
    "cwd": "/home/user/project",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/path/to/mcp-server",
        "args": ["--stdio"],
        "env": [
          { "name": "API_KEY", "value": "secret123" }
        ]
      }
    ]
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cwd` | `string` | Yes | Absolute path for the session's working directory |
| `mcpServers` | `McpServer[]` | No | MCP servers the agent should connect to |

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456",
    "modes": {
      "currentModeId": "ask",
      "availableModes": [
        { "id": "ask", "name": "Ask", "description": "Request permission before changes" },
        { "id": "architect", "name": "Architect", "description": "Design and plan without implementation" },
        { "id": "code", "name": "Code", "description": "Write and modify code with full tool access" }
      ]
    }
  }
}
```

The response includes:
- `sessionId`: Unique identifier for the conversation
- `modes` (optional): Available session modes and current mode
- `models` (optional): Available models and current model (agent-specific)

### `session/load` — Load an Existing Session

Resume a previous conversation. Requires `loadSession: true` capability.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/load",
  "params": {
    "sessionId": "sess_789xyz",
    "cwd": "/home/user/project",
    "mcpServers": []
  }
}
```

**Response:**

The agent replays the entire conversation history as `session/update` notifications (same format as during `session/prompt`), then responds:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": null
}
```

### `session/list` — List Sessions

Returns available sessions. This is an optional method — some agents implement it as a custom extension (e.g., `_session/list`).

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session/list",
  "params": {
    "cursor": null,
    "cwd": "/home/user/project"
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "sessions": [
      {
        "sessionId": "sess_abc123",
        "title": "My Project",
        "cwd": "/home/user/project",
        "updatedAt": "2026-04-01T12:00:00Z"
      }
    ],
    "nextCursor": null
  }
}
```

### `session/set_mode` — Change Session Mode

Switches the agent's operating mode.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "session/set_mode",
  "params": {
    "sessionId": "sess_abc123def456",
    "modeId": "code"
  }
}
```

### `session/cancel` — Cancel In-Progress Work

Cancels the current prompt turn. This is a **notification** (no response expected from agent to this specific message).

**Notification:**

```json
{
  "jsonrpc": "2.0",
  "method": "session/cancel",
  "params": {
    "sessionId": "sess_abc123def456"
  }
}
```

After receiving this, the agent stops all language model requests and tool invocations, sends any pending updates, then responds to the original `session/prompt` request with `stopReason: "cancelled"`.

### MCP Server Configuration

MCP servers can be connected via different transports:

**Stdio** (all agents MUST support):

```json
{
  "name": "filesystem",
  "command": "/path/to/mcp-server",
  "args": ["--stdio"],
  "env": [{ "name": "API_KEY", "value": "secret123" }]
}
```

**HTTP** (requires `mcpCapabilities.http`):

```json
{
  "type": "http",
  "name": "api-server",
  "url": "https://api.example.com/mcp",
  "headers": [{ "name": "Authorization", "value": "Bearer token123" }]
}
```

**SSE** (requires `mcpCapabilities.sse`, deprecated):

```json
{
  "type": "sse",
  "name": "event-stream",
  "url": "https://events.example.com/mcp",
  "headers": [{ "name": "X-API-Key", "value": "apikey456" }]
}
```

---

## 4. Prompt Turn Processing

A **prompt turn** is the core interaction cycle in ACP. It begins when the user sends a message and ends when the agent completes its response (or the turn is cancelled).

### Turn Lifecycle

```
   Client                                         Agent
     │                                              │
     │  ─── session/prompt (request) ──────────────► │
     │                                              │
     │  ◄── session/update (plan) ────────────────  │
     │  ◄── session/update (agent_message_chunk) ──  │  Step 2-3:
     │  ◄── session/update (tool_call) ────────────  │  Agent processes
     │  ◄── session/request_permission ────────────  │  and streams
     │  ─── permission response ───────────────────► │  updates
     │  ◄── session/update (tool_call_update) ────  │
     │  ◄── session/update (agent_message_chunk) ──  │
     │                                              │
     │  ◄── session/prompt (response: stopReason) ─  │
     │                                              │
     │              Turn complete                    │
```

### Step 1: User Sends Prompt

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123def456",
    "prompt": [
      { "type": "text", "text": "Analyze this code for issues" },
      {
        "type": "resource",
        "resource": {
          "uri": "file:///home/user/project/main.py",
          "mimeType": "text/x-python",
          "text": "def process_data(items):\n    for item in items:\n        print(item)"
        }
      }
    ]
  }
}
```

The `prompt` field is an array of `ContentBlock` items. Clients **MUST** only include content types the agent declared support for via `promptCapabilities`.

### Steps 2–3: Agent Reports Output

The agent sends zero or more `session/update` notifications as it processes:

- **Plan** — The agent's execution strategy
- **Agent message chunks** — Streaming text responses
- **Tool calls** — Actions the agent is taking
- **Tool call updates** — Progress and results from tools

### Step 4: Check for Completion

If there are no pending tool calls, the turn ends with a response to the original `session/prompt`:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "stopReason": "end_turn"
  }
}
```

### Steps 5–6: Tool Invocation and Continuation

If the model requested tools, the agent executes them (possibly requesting permission first), then sends the results back to the model. The cycle repeats from step 2 until the model completes without requesting more tools.

### StopReason Values

| Value | Description |
|-------|-------------|
| `end_turn` | Model finished responding without requesting more tools |
| `max_tokens` | Maximum token limit reached |
| `max_turn_requests` | Maximum model requests in a single turn exceeded |
| `refusal` | Agent refused to continue |
| `cancelled` | Client cancelled the turn via `session/cancel` |

### Cancellation Flow

Clients may cancel at any time:

1. Client sends `session/cancel` notification
2. Client preemptively marks all non-finished tool calls as `cancelled`
3. Client responds to all pending `session/request_permission` with `cancelled` outcome
4. Agent stops all operations and sends pending updates
5. Agent responds to original `session/prompt` with `stopReason: "cancelled"`

The agent **MAY** send updates after receiving the cancel notification, but **MUST** do so before responding to the `session/prompt` request.

---

## 5. Session Update Events

All streaming data from the agent to the client flows through `session/update` notifications. The `sessionUpdate` field determines the type of update.

### Complete Table of SessionUpdate Variants

| `sessionUpdate` Value | Direction | When Sent | Description |
|---|---|---|---|
| `user_message_chunk` | Agent → Client | During `session/load` replay | Replays a user message from conversation history |
| `agent_message_chunk` | Agent → Client | During prompt processing | Streaming text/content from the agent's response |
| `agent_thought_chunk` | Agent → Client | During prompt processing | Agent's internal reasoning/thinking (displayed separately) |
| `tool_call` | Agent → Client | When model requests a tool invocation | New tool call with title, kind, and status |
| `tool_call_update` | Agent → Client | As tools execute | Progress updates for running tools (status, content, locations) |
| `plan` | Agent → Client | When agent creates/updates execution plan | Execution strategy with prioritized entries |
| `available_commands_update` | Agent → Client | After session creation or when commands change | List of available slash commands |
| `current_mode_update` | Agent → Client | When session mode changes | New active mode ID |
| `config_option_update` | Agent → Client | When configuration changes | Updated config option (e.g., model selection) |
| `session_info_update` | Agent → Client | When session metadata changes | Updated session information |
| `usage_update` | Agent → Client | After model interactions | Token usage and cost information |

### Common Update Structures

#### `agent_message_chunk`

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "turnId": "turn_001",
      "content": {
        "type": "text",
        "text": "Let me check the files"
      }
    }
  }
}
```

#### `tool_call`

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_001",
      "title": "Reading configuration file",
      "kind": "read",
      "status": "pending"
    }
  }
}
```

#### `tool_call_update`

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_001",
      "status": "completed",
      "content": [
        {
          "type": "content",
          "content": { "type": "text", "text": "Found 3 configuration files..." }
        }
      ],
      "locations": [
        { "path": "/home/user/project/main.rs", "line": 1 }
      ]
    }
  }
}
```

All fields except `toolCallId` are optional in updates. Only changed fields need to be included.

#### `plan`

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "plan",
      "entries": [
        { "content": "Analyze codebase structure", "priority": "high", "status": "pending" },
        { "content": "Identify components to refactor", "priority": "high", "status": "pending" },
        { "content": "Create unit tests", "priority": "medium", "status": "pending" }
      ]
    }
  }
}
```

Plan entries have `priority` (`high`, `medium`, `low`) and `status` (`pending`, `in_progress`, `completed`). Plans can evolve — the agent sends complete plan replacements with updated entries as work progresses.

#### `current_mode_update`

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "current_mode_update",
      "modeId": "code"
    }
  }
}
```

### Batched Updates

In some implementations, updates may be batched for efficiency:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "batched": true,
    "updates": [
      { "sessionUpdate": "agent_message_chunk", "content": { "type": "text", "text": "Hello" } },
      { "sessionUpdate": "agent_message_chunk", "content": { "type": "text", "text": " world" } }
    ]
  }
}
```

---

## 6. Content Blocks

Content blocks are structured data units that flow through ACP — in user prompts, agent messages, and tool results. They use the same `ContentBlock` structure as the Model Context Protocol (MCP), enabling agents to forward MCP tool outputs without transformation.

### ContentBlock Types

#### Text Content (Baseline — always supported)

Plain text messages. The foundation of most interactions.

```json
{
  "type": "text",
  "text": "What's the weather like today?"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"text"` | Yes | Content block type identifier |
| `text` | `string` | Yes | The text content |
| `annotations` | `Annotations` | No | Metadata about display/usage |

#### Image Content (requires `image` prompt capability)

Base64-encoded images for visual context or analysis.

```json
{
  "type": "image",
  "mimeType": "image/png",
  "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...",
  "uri": "file:///home/user/screenshot.png"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"image"` | Yes | Content block type identifier |
| `data` | `string` | Yes | Base64-encoded image data |
| `mimeType` | `string` | Yes | MIME type (e.g., `image/png`, `image/jpeg`) |
| `uri` | `string` | No | URI reference for the image source |
| `annotations` | `Annotations` | No | Metadata about display/usage |

#### Audio Content (requires `audio` prompt capability)

Base64-encoded audio data for transcription or analysis.

```json
{
  "type": "audio",
  "mimeType": "audio/wav",
  "data": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAAB..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"audio"` | Yes | Content block type identifier |
| `data` | `string` | Yes | Base64-encoded audio data |
| `mimeType` | `string` | Yes | MIME type (e.g., `audio/wav`, `audio/mp3`) |
| `annotations` | `Annotations` | No | Metadata about display/usage |

#### Embedded Resource (requires `embeddedContext` prompt capability)

Complete resource contents embedded directly in the message. The preferred way to include context like file references.

```json
{
  "type": "resource",
  "resource": {
    "uri": "file:///home/user/script.py",
    "mimeType": "text/x-python",
    "text": "def hello():\n    print('Hello, world!')"
  }
}
```

The `resource` object can contain either text or binary data:

**Text resource:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uri` | `string` | Yes | URI identifying the resource |
| `text` | `string` | Yes | Text content |
| `mimeType` | `string` | No | MIME type of the text content |

**Blob resource:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uri` | `string` | Yes | URI identifying the resource |
| `blob` | `string` | Yes | Base64-encoded binary data |
| `mimeType` | `string` | No | MIME type of the blob |

#### Resource Link (Baseline — always supported)

References to resources the agent can access. Unlike embedded resources, these are pointers rather than inline content.

```json
{
  "type": "resource_link",
  "uri": "file:///home/user/document.pdf",
  "name": "document.pdf",
  "mimeType": "application/pdf",
  "size": 1024000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"resource_link"` | Yes | Content block type identifier |
| `uri` | `string` | Yes | URI of the resource |
| `name` | `string` | Yes | Human-readable name |
| `mimeType` | `string` | No | MIME type of the resource |
| `title` | `string` | No | Display title |
| `description` | `string` | No | Description of contents |
| `size` | `integer` | No | Size in bytes |
| `annotations` | `Annotations` | No | Metadata about display/usage |

### Content in acp-chat-core

In the current `acp-chat-core` implementation, the codebase works with three content block types:

```typescript
type ContentBlockType = "text" | "resource" | "resource_link";

type ContentBlock =
  | TextContentBlock      // { type: "text", text: string }
  | ResourceContentBlock   // { type: "resource", resource: { uri, mimeType?, text?, blob? } }
  | ResourceLinkContentBlock; // { type: "resource_link", resourceLink: { uri, mimeType? } }
```

Image and audio content blocks are defined in the ACP specification but are not yet processed by the normalization layer.

---

## 7. File System Operations

The file system capability allows agents to request file access from the client's environment. This is useful when the agent runs in a sandboxed environment but needs to read or write files that only the client has access to.

### Capability Negotiation

File system access is negotiated during initialization:

```json
{
  "clientCapabilities": {
    "fs": {
      "readTextFile": true,
      "writeTextFile": true
    }
  }
}
```

If `fs` is omitted or its fields are `false`, the agent MUST NOT attempt file system calls.

### `fs/read_text_file` — Read a File

**Agent → Client request:**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "fs/read_text_file",
  "params": {
    "path": "/home/user/project/src/main.ts"
  }
}
```

**Client → Agent response:**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "result": {
    "content": "import { hello } from './greet';\n\nhello();\n"
  }
}
```

### `fs/read_text_file` with Line Range

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "fs/read_text_file",
  "params": {
    "path": "/home/user/project/src/main.ts",
    "offset": 1,
    "limit": 50
  }
}
```

`offset` and `limit` are 1-based line numbers that allow agents to read specific portions of large files.

### `fs/write_text_file` — Write a File

**Agent → Client request:**

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "fs/write_text_file",
  "params": {
    "path": "/home/user/project/src/main.ts",
    "content": "import { hello } from './greet';\n\nhello('world');\n"
  }
}
```

**Client → Agent response:**

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "result": null
}
```

### Path Requirements

- All file paths in the protocol **MUST** be absolute
- Line numbers are **1-based**

---

## 8. Tool Calls and Permissions

### Tool Call Lifecycle

Tool calls progress through defined statuses:

```
 pending  ──►  in_progress  ──►  completed
    │               │
    │               └──►  failed
    │
    └──►  cancelled  (via session/cancel)
```

| Status | Description |
|--------|-------------|
| `pending` | Tool call hasn't started yet (input streaming or awaiting approval) |
| `in_progress` | Tool is currently running |
| `completed` | Tool finished successfully |
| `failed` | Tool encountered an error |

### Tool Kinds

The `kind` field helps clients choose appropriate icons and display treatment:

| Kind | Description |
|------|-------------|
| `read` | Reading files or data |
| `edit` | Modifying files or content |
| `delete` | Removing files or data |
| `move` | Moving or renaming files |
| `search` | Searching for information |
| `execute` | Running commands or code |
| `think` | Internal reasoning or planning |
| `fetch` | Retrieving external data |
| `other` | Other tool types (default) |

### Tool Call Content Types

Tool calls can produce different types of content in their updates:

**Regular content:**

```json
{
  "type": "content",
  "content": { "type": "text", "text": "Analysis complete. Found 3 issues." }
}
```

**Diffs:**

```json
{
  "type": "diff",
  "path": "/home/user/project/src/config.json",
  "oldText": "{\n  \"debug\": false\n}",
  "newText": "{\n  \"debug\": true\n}"
}
```

**Terminals (requires `terminal` capability):**

```json
{
  "type": "terminal",
  "terminalId": "term_xyz789"
}
```

### File Locations (Follow-Along)

Tool calls can report file locations for "follow-along" features in editors:

```json
{
  "locations": [
    { "path": "/home/user/project/src/main.py", "line": 42 }
  ]
}
```

### Permission Request Flow

For sensitive operations, agents request user permission before proceeding:

```
   Client                                         Agent
     │                                              │
     │  ◄── session/request_permission (request) ── │
     │                                              │
     │    [ User sees permission UI ]               │
     │                                              │
     │  ─── result (selected/cancelled) ──────────► │
     │                                              │
```

**Agent → Client:**

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123",
    "toolCall": {
      "toolCallId": "call_001",
      "title": "Execute Command",
      "kind": "execute",
      "status": "pending",
      "rawInput": { "command": "npm test" },
      "content": [
        { "type": "text", "text": "Run test suite?" }
      ]
    },
    "options": [
      { "optionId": "allow-once", "name": "Allow once", "kind": "allow_once" },
      { "optionId": "allow-always", "name": "Allow always", "kind": "allow_always" },
      { "optionId": "reject-once", "name": "Reject", "kind": "reject_once" },
      { "optionId": "reject-always", "name": "Reject always", "kind": "reject_always" }
    ]
  }
}
```

**Client → Agent (approved):**

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "result": {
    "outcome": {
      "outcome": "selected",
      "optionId": "allow-once"
    }
  }
}
```

**Client → Agent (cancelled):**

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "result": {
    "outcome": {
      "outcome": "cancelled"
    }
  }
}
```

### Permission Option Kinds

| Kind | Description |
|------|-------------|
| `allow_once` | Allow this operation only this time |
| `allow_always` | Allow and remember the choice |
| `reject_once` | Reject this operation only this time |
| `reject_always` | Reject and remember the choice |

Clients **MAY** auto-approve or auto-reject based on user settings.

---

## 9. Session Modes

Session modes allow agents to operate in different "personalities" — affecting system prompts, tool availability, and permission behavior.

### Common Modes

| Mode | ID | Description |
|------|----|-------------|
| **Ask** | `ask` | Request permission before making any changes. Read-only analysis and Q&A. |
| **Architect** | `architect` | Design and plan software systems without direct implementation. Creates plans and specifications. |
| **Code** | `code` | Write and modify code with full tool access. May auto-approve safe operations. |

These are the most common modes, but agents may define additional custom modes.

### Mode State

Modes are returned during session creation:

```json
{
  "modes": {
    "currentModeId": "ask",
    "availableModes": [
      { "id": "ask", "name": "Ask", "description": "Request permission before changes" },
      { "id": "architect", "name": "Architect", "description": "Design without implementation" },
      { "id": "code", "name": "Code", "description": "Full tool access" }
    ]
  }
}
```

### Changing Modes

**From the client** — Call `session/set_mode`:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "session/set_mode",
  "params": {
    "sessionId": "sess_abc123",
    "modeId": "code"
  }
}
```

**From the agent** — Send `current_mode_update` notification:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "current_mode_update",
      "modeId": "code"
    }
  }
}
```

A common pattern: an agent in "architect" mode uses a special tool to request switching to "code" mode, asking permission first so the user can choose whether to auto-accept or manually approve subsequent operations.

---

## 10. Event Lifecycle and Ordering

The complete lifecycle of an ACP connection follows a strict ordering:

### Full Connection Lifecycle

```
 1. Connection Established
    │
    │  Transport connects (WebSocket, stdio pipe opened, etc.)
    │
 2. Initialization
    │
    │  Client ──initialize──► Agent
    │  Client ◄──result────── Agent  (capabilities exchanged)
    │
 3. Session Creation
    │
    │  Client ──session/new──► Agent
    │  Client ◄──result─────── Agent  (sessionId + modes received)
    │
 4. Prompt Turns (repeated)
    │
    │  ┌─────────────────────────────────────┐
    │  │ Client ──session/prompt──► Agent     │
    │  │ Client ◄──session/update── Agent     │  (streaming updates)
    │  │ Client ◄──session/update── Agent     │
    │  │ ...                                  │
    │  │ [Optional: permission requests]      │
    │  │ [Optional: tool calls + updates]     │
    │  │ Client ◄──result────────── Agent     │  (stopReason)
    │  └─────────────────────────────────────┘
    │
 5. Completion
    │
    │  Connection closes (transport disconnects)
```

### Ordering Guarantees

1. **Initialization before sessions**: Clients MUST complete initialization before calling any session methods.
2. **Session before prompts**: Clients MUST create or load a session before sending prompts.
3. **One prompt at a time**: Clients MUST NOT send a new `session/prompt` while one is in progress. Wait for the response (or cancel first).
4. **Updates before response**: All `session/update` notifications for a turn arrive BEFORE the `session/prompt` response.
5. **Notifications are unordered**: Individual `session/update` notifications may arrive in any order, but tool call updates logically follow tool call creation.

### acp-chat-core Connection Flow

In `acp-chat-core`, the flow includes the Rust bridge layer:

```
Browser/React App
       │
       │  WebSocket
       ▼
  Rust Bridge
       │
       │  stdio (JSON-RPC 2.0)
       ▼
  ACP Agent (e.g., Claude Code, Goose)
```

1. **TransportClient** connects WebSocket to Rust bridge
2. Client sends bridge init message (`{ type: "init", mode: "live" | "replay" }`)
3. Bridge responds with init acknowledgment
4. **SessionController** sends `initialize` → bridge forwards to agent
5. Agent responds with capabilities → bridge wraps in `BridgeEnvelope` → client
6. Session operations (`session/new`, `session/prompt`, etc.) follow the same forwarding pattern
7. Agent notifications (`session/update`) are forwarded through the bridge as `acp_payload` messages

---

## 11. Protocol Versioning

### Version Scheme

ACP uses a single integer for protocol versioning, representing **MAJOR** versions only:

- The current protocol version is **`1`**
- Version is only incremented when **breaking changes** are introduced
- New capabilities (non-breaking) are added through the capability negotiation system

### Version Negotiation

1. Client sends its **latest supported version** in the `initialize` request
2. If the agent supports that version, it responds with the **same version**
3. If not, the agent responds with the **latest version it supports**
4. If the client doesn't support the version in the agent's response, it **SHOULD** close the connection

### Extensibility

ACP provides three extension mechanisms that **do not** require version changes:

#### 1. `_meta` Fields

All protocol types include a `_meta` field (`{ [key: string]: unknown }`) for custom data:

```json
{
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123",
    "prompt": [...],
    "_meta": {
      "traceparent": "00-80e1afed08e019fc...-7a085853722dc6d2-01",
      "customField": true
    }
  }
}
```

Reserved root-level `_meta` keys for W3C trace context: `traceparent`, `tracestate`, `baggage`.

#### 2. Extension Methods

Method names starting with underscore (`_`) are reserved for custom extensions:

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "_zed.dev/workspace/buffers",
  "params": { "language": "rust" }
}
```

Unknown extension requests receive `-32601` (Method not found). Unknown extension notifications **SHOULD** be silently ignored.

#### 3. Custom Capabilities

Advertise extensions via `_meta` in capability objects:

```json
{
  "agentCapabilities": {
    "loadSession": true,
    "_meta": {
      "zed.dev": {
        "workspace": true,
        "fileNotifications": true
      }
    }
  }
}
```

---

## 12. Message Structure (JSON-RPC 2.0)

ACP follows the [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification). All messages are UTF-8 encoded JSON.

### Request

A message that expects a response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123",
    "prompt": [{ "type": "text", "text": "Hello" }]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jsonrpc` | `"2.0"` | Yes | Protocol version identifier |
| `id` | `number \| string` | Yes | Unique identifier for matching responses |
| `method` | `string` | Yes | Method name to invoke |
| `params` | `object` | No | Parameters for the method |

### Response (Success)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "stopReason": "end_turn"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jsonrpc` | `"2.0"` | Yes | Protocol version identifier |
| `id` | `number \| string` | Yes | Matches the request ID |
| `result` | `any` | Yes | The result (may be `null`) |

### Response (Error)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": { "details": "Unknown method: session/foo" }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jsonrpc` | `"2.0"` | Yes | Protocol version identifier |
| `id` | `number \| string` | Yes | Matches the request ID |
| `error` | `object` | Yes | Error object with `code`, `message`, optional `data` |

### Notification

A one-way message that does not expect a response (no `id` field):

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": { "sessionUpdate": "agent_message_chunk", "content": { "type": "text", "text": "Hello" } }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jsonrpc` | `"2.0"` | Yes | Protocol version identifier |
| `method` | `string` | Yes | Notification method name |
| `params` | `object` | No | Notification parameters |

> **Note**: Notifications never have an `id` field and never receive a response.

---

## 13. Error Handling

### Standard JSON-RPC Error Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `-32700` | Parse error | Invalid JSON received by the server |
| `-32600` | Invalid Request | The JSON sent is not a valid Request object |
| `-32601` | Method not found | The method does not exist or is not available |
| `-32602` | Invalid params | Invalid method parameter(s) |
| `-32603` | Internal error | Internal JSON-RPC error |

### ACP-Specific Error Codes

Error codes from `-32000` to `-32099` are reserved for implementation-defined server errors:

| Code | Meaning | Description |
|------|---------|-------------|
| `-32000` | Authentication required | Agent requires authentication (see `authMethods`) |
| `-32001` | Session not found | The specified session ID does not exist |
| `-32002` | Session already exists | Attempted to create a session that already exists |
| `-32003` | Permission denied | Permission request was rejected |
| `-32004` | Capability not supported | Requested method requires a capability not advertised |
| `-32005` | Prompt capability not supported | Content type not supported (e.g., image sent but `image` not in `promptCapabilities`) |

### Error Object Structure

```json
{
  "code": -32602,
  "message": "Invalid params",
  "data": {
    "field": "sessionId",
    "reason": "Session ID is required"
  }
}
```

The `data` field is optional and may contain additional context about the error.

### Error Handling Best Practices

1. **Always check for `error`** in responses before accessing `result`
2. **Gracefully handle unknown methods** — extension methods may not be supported
3. **Log the full error** for debugging, including `code`, `message`, and `data`
4. **Use timeouts** — JSON-RPC requests should have reasonable timeouts (acp-chat-core uses 30s default)

---

## 14. Semantic Mappings to acp-chat-core

This section maps ACP protocol concepts to their corresponding types and state in `acp-chat-core`.

### ACP Event → acp-chat-core State Mapping

| ACP Protocol Event | acp-chat-core Handler | Resulting State Change |
|---|---|---|
| `initialize` response | `SessionController.initialize()` | Sets `capabilities`, `initialized = true` |
| `session/new` response | `SessionController.createSession()` | Sets `sessionId`, optionally `modes` |
| `session/load` response | `SessionController.loadSession()` | Sets `sessionId`, replays history into state |
| `session/prompt` request sent | `SessionController.sendPrompt()` | Emits `PromptPhase: "active"` |
| `session/prompt` response | `SessionController` (request resolver) | Emits `PromptPhase: "complete"` / `"cancelled"` |
| `session/cancel` | `SessionController.cancelPrompt()` | Emits `PromptPhase: "cancelled"` |
| `session/update` (notification) | `SessionController.handleAcpPayload()` | Calls `applySessionUpdate()` on state |
| `session/request_permission` | `SessionController` → emits `permissionRequest` | Creates `NormalizedPermissionRequest` |

### SessionUpdate → NormalizedState Mapping

| `sessionUpdate` Variant | `applySessionUpdate()` Output | `NormalizedState` Map |
|---|---|---|
| `user_message_chunk` | `NormalizedMessage` (role: `"user"`) | `state.messages` |
| `agent_message_chunk` | `NormalizedMessage` (role: `"agent"`) | `state.messages` |
| `agent_thought_chunk` | `NormalizedThought` | `state.thoughts` |
| `tool_call` | `NormalizedToolCall` (status: `"pending"`) | `state.toolCalls` |
| `tool_call_update` | Updates existing `NormalizedToolCall` | `state.toolCalls` |
| `permission_request` | `NormalizedPermissionRequest` | `state.permissionRequests` |

### Protocol Types → Core Types

| ACP Type | acp-chat-core Type | File |
|---|---|---|
| `ContentBlock::Text` | `TextContentBlock` | `normalization/store.ts` |
| `ContentBlock::Resource` | `ResourceContentBlock` | `normalization/store.ts` |
| `ContentBlock::ResourceLink` | `ResourceLinkContentBlock` | `normalization/store.ts` |
| `ToolCallStatus` | `ToolCallStatus` = `"pending" \| "completed"` | `normalization/store.ts` |
| `ToolKind` | `ToolCallKind` = `"read" \| "search" \| "edit" \| "write" \| "execute" \| "glob" \| "grep" \| "unknown"` | `normalization/store.ts` |
| `PermissionOptionKind` | `PermissionOption.kind` | `session/controller.ts` |
| `StopReason` | Used in prompt phase transitions | `helpers/composer-logic.ts` |

### Connection Status Mapping

| Bridge Event | acp-chat-core State | Description |
|---|---|---|
| WebSocket connected | `ConnectionStatus: "connected"` | Transport ready |
| `bridge_status: starting` | `BridgeStatus: "starting"` | Bridge initializing |
| `bridge_status: connected` | `BridgeStatus: "connected"` | Agent ready |
| `bridge_status: disconnected` | `BridgeStatus: "disconnected"` | Agent gone |
| `bridge_status: error` | `BridgeStatus: "error"` | Bridge error |
| WebSocket close | `ConnectionStatus: "disconnected"` | Transport closed |

### Event Subscription (React)

| Hook | ACP Events | Purpose |
|---|---|---|
| `useChatEvent("sessionUpdate")` | All `session/update` variants | Subscribe to session updates |
| `useThoughtEvents(controller)` | `agent_thought_chunk` | Track agent reasoning |
| `useToolCallEvents(controller, id)` | `tool_call`, `tool_call_update` | Track specific tool call |
| `usePermissionResponse(store, controller)` | `session/request_permission` | Handle permission UI |
| `useActiveItems(store)` | Derived from all updates | Currently active tool calls/thoughts |

---

## External Resources

- **[Agent Client Protocol](https://agentclientprotocol.com)** — Official specification and documentation
- **[ACP GitHub](https://github.com/agentclientprotocol/agent-client-protocol)** — Protocol source and RFDs
- **[ACP TypeScript Library](https://agentclientprotocol.com/libraries/typescript)** — Official TypeScript types
- **[ACP Rust Library](https://agentclientprotocol.com/libraries/rust)** — Official Rust implementation
- **[JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)** — Message format reference
- **[Model Context Protocol](https://modelcontextprotocol.io)** — MCP specification (used for tool servers)

---

**See Also:**
- [Architecture](./Architecture) — How acp-chat-core layers map to ACP
- [Events](./Events) — Complete event system documentation
- [Session Management](./Session-Management) — SessionController API and usage
- [Bridge Protocol](./Bridge-Protocol) — How the Rust bridge wraps ACP messages

---

**Last Updated:** April 2026
