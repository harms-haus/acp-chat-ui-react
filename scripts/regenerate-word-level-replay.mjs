#!/usr/bin/env node
import fs from 'fs';

const BASE_TIMESTAMP = 1701000000000;

function createEnvelope(seq, offset, base, tokenCount = 4) {
  const envelope = {
    version: 1,
    seq,
    timestamp_ms: BASE_TIMESTAMP + offset,
    ...base,
  };
  return JSON.stringify({ ...envelope, tokenCount, timestamp: BASE_TIMESTAMP + offset, direction: 'in' });
}

function createAcpEnvelope(seq, offset, method, params, tokenCount = 4) {
  return createEnvelope(seq, offset, {
    type: 'acp_payload',
    payload: { jsonrpc: '2.0', method, params },
  }, tokenCount);
}

function createStatusEnvelope(seq, offset, status, tokenCount = 4) {
  return createEnvelope(seq, offset, { type: 'bridge_status', status }, tokenCount);
}

function createMetadataEnvelope(seq, offset, description, total, tokenCount = 4) {
  return createEnvelope(seq, offset, {
    type: 'replay_metadata',
    captured_at_ms: BASE_TIMESTAMP,
    total_envelopes: total,
    description,
  }, tokenCount);
}

function generateWordLevelSession1() {
  const lines = [];
  let seq = 1, offset = 0;

  // Initial connection
  offset += 100;
  lines.push(createStatusEnvelope(seq++, offset, 'starting'));
  offset += 100;
  lines.push(createStatusEnvelope(seq++, offset, 'connected'));
  offset += 800;

  // User message
  offset += 1000;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'user_message',
      turnId: 'turn-0',
      role: 'user',
      content: [{ type: 'text', text: 'Analyze the architecture.' }],
    },
  }));

  // === THINKING BLOCK 1: Initial approach ===
  offset += 500;
  const thought1 = `Let me analyze this architecture systematically. I'll start by examining the project structure and configuration files to understand the overall organization.`;
  const words1 = thought1.split(/(\s+)/).filter(w => w.length > 0);
  for (let i = 0; i < words1.length; i++) {
    offset += 15;
    lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
      sessionId: 'lc-analysis-001',
      update: {
        type: 'agent_thought_chunk',
        turnId: 'turn-1',
        role: 'assistant',
        content: [{ type: 'text', text: words1[i] }],
        status: 'in_progress',
      },
    }, 4));
  }

  // === TOOL 1: Read package.json ===
  offset += 300;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-1',
      name: 'read',
      arguments: { path: 'package.json' },
      status: 'pending',
    },
  }, 8));

  offset += 200;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call_update',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-1',
      name: 'read',
      status: 'running',
      progress: 0.5,
    },
  }, 6));

  offset += 200;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call_update',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-1',
      name: 'read',
      status: 'done',
      result: { success: true, content: '{"name":"acp-chat","workspaces":["packages/*","apps/*"]}' },
    },
  }, 12));

  // === THINKING BLOCK 2: After package.json ===
  offset += 400;
  const thought2 = `\n\nThe package.json reveals this is a monorepo using npm workspaces. I can see packages/* and apps/* workspace patterns. Let me check the TypeScript configuration next.`;
  const words2 = thought2.split(/(\s+)/).filter(w => w.length > 0);
  for (let i = 0; i < words2.length; i++) {
    offset += 15;
    lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
      sessionId: 'lc-analysis-001',
      update: {
        type: 'agent_thought_chunk',
        turnId: 'turn-1',
        role: 'assistant',
        content: [{ type: 'text', text: words2[i] }],
        status: 'in_progress',
      },
    }, 4));
  }

  // === TOOL 2: Read tsconfig.json ===
  offset += 300;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-2',
      name: 'read',
      arguments: { path: 'tsconfig.json' },
      status: 'pending',
    },
  }, 8));

  offset += 200;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call_update',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-2',
      name: 'read',
      status: 'done',
      result: { success: true, content: '{"compilerOptions":{"target":"ES2022","module":"NodeNext"}}' },
    },
  }, 10));

  // === THINKING BLOCK 3: After tsconfig.json ===
  offset += 400;
  const thought3 = `\n\nTypeScript uses ES2022 target with NodeNext module resolution - modern setup. Now I need to examine the core session controller to understand the ACP protocol implementation.`;
  const words3 = thought3.split(/(\s+)/).filter(w => w.length > 0);
  for (let i = 0; i < words3.length; i++) {
    offset += 15;
    lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
      sessionId: 'lc-analysis-001',
      update: {
        type: 'agent_thought_chunk',
        turnId: 'turn-1',
        role: 'assistant',
        content: [{ type: 'text', text: words3[i] }],
        status: 'in_progress',
      },
    }, 4));
  }

  // === TOOL 3: Read controller.ts ===
  offset += 300;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-3',
      name: 'read',
      arguments: { path: 'packages/acp-chat-core/src/session/controller.ts' },
      status: 'pending',
    },
  }, 8));

  offset += 250;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call_update',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-3',
      name: 'read',
      status: 'running',
      progress: 0.3,
    },
  }, 6));

  offset += 250;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call_update',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-3',
      name: 'read',
      status: 'running',
      progress: 0.7,
    },
  }, 6));

  offset += 250;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call_update',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-3',
      name: 'read',
      status: 'done',
      result: { success: true, content: '// SessionController - implements ACP protocol with JSON-RPC' },
    },
  }, 15));

  // === THINKING BLOCK 4: After controller ===
  offset += 400;
  const thought4 = `\n\nThe session controller implements the full ACP protocol with JSON-RPC methods. I can see initialize, session/new, session/prompt handlers. Let me examine the normalization store to understand state management.`;
  const words4 = thought4.split(/(\s+)/).filter(w => w.length > 0);
  for (let i = 0; i < words4.length; i++) {
    offset += 15;
    lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
      sessionId: 'lc-analysis-001',
      update: {
        type: 'agent_thought_chunk',
        turnId: 'turn-1',
        role: 'assistant',
        content: [{ type: 'text', text: words4[i] }],
        status: 'in_progress',
      },
    }, 4));
  }

  // === TOOL 4: Read store.ts ===
  offset += 300;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-4',
      name: 'read',
      arguments: { path: 'packages/acp-chat-core/src/normalization/store.ts' },
      status: 'pending',
    },
  }, 8));

  offset += 250;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call_update',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-4',
      name: 'read',
      status: 'running',
      progress: 0.5,
    },
  }, 6));

  offset += 250;
  lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
    sessionId: 'lc-analysis-001',
    update: {
      type: 'tool_call_update',
      turnId: 'turn-1',
      role: 'assistant',
      toolCallId: 'tool-4',
      name: 'read',
      status: 'done',
      result: { success: true, content: '// NormalizedState - map-based state with messages, thoughts, toolCalls maps' },
    },
  }, 12));

  // === THINKING BLOCK 5: Synthesis ===
  offset += 400;
  const thought5 = `\n\nExcellent! Now I have a complete picture. The normalization store uses map-based architecture with separate maps for messages, thoughts, and tool calls. This provides O(1) lookup and clean separation. I have enough information to provide a comprehensive summary.`;
  const words5 = thought5.split(/(\s+)/).filter(w => w.length > 0);
  for (let i = 0; i < words5.length; i++) {
    offset += 15;
    const isLast = i === words5.length - 1;
    lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
      sessionId: 'lc-analysis-001',
      update: {
        type: 'agent_thought_chunk',
        turnId: 'turn-1',
        role: 'assistant',
        content: [{ type: 'text', text: words5[i] }],
        status: isLast ? 'done' : 'in_progress',
      },
    }, 4));
  }

  // === FINAL MESSAGE: Comprehensive summary ===
  offset += 600;
  const finalSummary = `## Architecture Analysis Summary

Based on my examination of the codebase, here's a comprehensive overview:

### Project Structure
This is a TypeScript monorepo using npm workspaces with clear separation between core logic and UI components.

### Core Layer (acp-chat-core)
The heart of the system implements the ACP (Agent Communication Protocol) over JSON-RPC:

- **SessionController**: Manages WebSocket connections to the Rust bridge, handles protocol methods (initialize, session/new, session/prompt, session/cancel), maintains connection state, and emits events.

- **Normalization Layer (store.ts)**: State management using map-based structures:
  - \`messages\`: Map - stores conversation messages
  - \`thoughts\`: Map - stores agent reasoning  
  - \`toolCalls\`: Map - tracks tool execution
  - \`timelineOrder\`: Array - maintains conversation sequence
  - Supports additive chunk streaming for efficient updates

- **Transport Layer**: WebSocket client with reconnection, serialization, and traffic monitoring.

### Bridge Layer (Rust)
The acp-bridge implements MCP (Model Context Protocol):
- **replay_v2**: Token-count based streaming at 65 TPS
- **Live mode**: Real-time LLM with tool execution
- **Permission system**: User approval for sensitive operations

### React Integration (acp-chat-react)
UI components consuming the core package:
- **ReactStoreAdapter**: Connects state to React
- **MessageCard, ThoughtStack, ToolCallPanel**: Presentation components
- **PermissionDialog**: Handles approval requests

### Key Design Patterns
- Event-driven architecture
- Additive streaming (~70% bandwidth reduction)
- Clear layer separation
- Full TypeScript coverage
- Comprehensive testing with replay

### Architecture Quality
Strong architectural principles with clear abstraction boundaries, consistent patterns, well-defined interfaces, and production-ready error handling.`;

  const sentences = finalSummary.split(/(\n\n)/).filter(s => s.length > 0);
  for (let i = 0; i < sentences.length; i++) {
    offset += 30;
    const isLast = i === sentences.length - 1;
    lines.push(createAcpEnvelope(seq++, offset, 'session/update', {
      sessionId: 'lc-analysis-001',
      update: {
        type: 'agent_message_chunk',
        turnId: 'turn-2',
        role: 'assistant',
        content: [{ type: 'text', text: sentences[i] }],
        status: isLast ? 'done' : 'in_progress',
      },
    }, 20));
  }

  offset += 2000;
  lines.push(createStatusEnvelope(seq++, offset, 'disconnected'));

  const totalEnvelopes = lines.length + 1;
  const metadataEnvelope = createMetadataEnvelope(0, 0, 'Architecture analysis with 4 file reads and comprehensive summary', totalEnvelopes);
  lines.unshift(metadataEnvelope);

  return lines;
}

const session1 = generateWordLevelSession1();
fs.writeFileSync('fixtures/replay-data/long-context/session-1/replay-events.jsonl', session1.join('\n') + '\n');
console.log('Generated session-1 with', session1.length, 'events');

const session2 = [];
session2.push(createMetadataEnvelope(0, 0, 'Session 2', 4)); // Use actual envelope count
session2.push(createStatusEnvelope(1, 100, 'starting'));
session2.push(createStatusEnvelope(2, 200, 'connected'));
session2.push(createStatusEnvelope(3, 300, 'disconnected'));
fs.writeFileSync('fixtures/replay-data/long-context/session-2/replay-events.jsonl', session2.join('\n') + '\n');
console.log('Generated session-2 with', session2.length, 'events');
