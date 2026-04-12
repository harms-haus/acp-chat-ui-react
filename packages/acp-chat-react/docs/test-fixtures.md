# Test Fixture Usage Guide

Guide to using test factory functions and fixtures for ACP Chat React component testing.

## Table of Contents

- [Overview](#overview)
- [Factory Functions](#factory-functions)
- [Creating Test Data](#creating-test-data)
- [Fixture Patterns](#fixture-patterns)
- [Best Practices](#best-practices)

---

## Overview

ACP Chat React provides factory functions for creating realistic mock test data. These factories live in `src/test-utils/factories.ts` and provide sensible defaults while allowing customization.

### Why Use Factories?

- **Consistency**: All tests use the same data structure
- **Maintainability**: Changes to types update in one place
- **Readability**: Tests focus on what matters, not boilerplate
- **Type Safety**: Full TypeScript support with correct types

### Importing Factories

```typescript
import {
  createMockMessage,
  createMockThought,
  createMockToolCall,
  createMockPermissionRequest,
} from '@harms-haus/acp-chat-react/test-utils';
```

Or from local path during development:

```typescript
import {
  createMockMessage,
  createMockThought,
  createMockToolCall,
  createMockPermissionRequest,
} from '../test-utils/factories.js';
```

---

## Factory Functions

### createMockMessage()

Creates a `NormalizedMessage` for testing message rendering and behavior.

**Signature:**

```typescript
function createMockMessage(options?: MockMessageOptions): NormalizedMessage
```

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | Auto-generated | Message ID |
| `turnId` | `string` | Auto-generated | Turn ID for grouping |
| `role` | `'user' \| 'agent'` | `'agent'` | Message role |
| `status` | `'streaming' \| 'completed' \| 'cancelled' \| 'error'` | `'completed'` | Message status |
| `content` | `string` | `'Test message'` | Message content |
| `contentBlocks` | `ContentBlock[]` | Auto-generated from content | Content blocks |
| `timestamp` | `number` | `Date.now()` | Created timestamp |
| `parentMessageId` | `string` | `undefined` | Parent for threading |

**Examples:**

```typescript
// Basic user message
const userMessage = createMockMessage({
  role: 'user',
  content: 'Hello, world!',
});

// Agent message with streaming status
const streamingMessage = createMockMessage({
  role: 'agent',
  status: 'streaming',
  content: 'Processing your request...',
});

// Message with specific timestamp
const oldMessage = createMockMessage({
  content: 'Historical message',
  timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
});

// Threaded message with parent
const replyMessage = createMockMessage({
  content: 'This is a reply',
  parentMessageId: 'msg-parent-123',
});

// Message with custom content blocks
const richMessage = createMockMessage({
  content: 'Check this out',
  contentBlocks: [
    { type: 'text', text: 'Check this out' },
    {
      type: 'resource',
      resource: {
        uri: 'file:///test.txt',
        mimeType: 'text/plain',
        text: 'File contents',
      },
    },
  ],
});
```

---

### createMockThought()

Creates a `NormalizedThought` for testing thought rendering and expand/collapse behavior.

**Signature:**

```typescript
function createMockThought(options?: MockThoughtOptions): NormalizedThought
```

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | Auto-generated | Thought ID |
| `turnId` | `string` | `undefined` | Turn ID (optional) |
| `content` | `string` | `'Thinking...'` | Thought content |
| `status` | `'streaming' \| 'completed' \| 'cancelled' \| 'error'` | `'completed'` | Thought status |
| `createdAt` | `number` | `Date.now() - 1000` | Created timestamp |
| `updatedAt` | `number` | `Date.now()` | Updated timestamp |

**Examples:**

```typescript
// Basic thought
const thought = createMockThought({
  content: 'Analyzing the problem...',
});

// Streaming thought
const streamingThought = createMockThought({
  content: 'Working on solution',
  status: 'streaming',
});

// Thought with specific timing
const timedThought = createMockThought({
  content: 'Quick thought',
  createdAt: Date.now() - 500,
  updatedAt: Date.now(),
});

// Multiple thoughts for a group
const thoughts = [
  createMockThought({ content: 'First step' }),
  createMockThought({ content: 'Second step' }),
  createMockThought({ content: 'Final conclusion' }),
];
```

---

### createMockToolCall()

Creates a `NormalizedToolCall` for testing tool call rendering, expansion, and input/output display.

**Signature:**

```typescript
function createMockToolCall(options?: MockToolCallOptions): NormalizedToolCall
```

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `toolCallId` | `string` | Auto-generated | Tool call ID |
| `kind` | `'read' \| 'search' \| 'edit' \| 'write' \| 'execute' \| 'glob' \| 'grep' \| 'unknown'` | `'unknown'` | Tool kind |
| `title` | `string` | `'Test tool'` | Tool title |
| `status` | `'pending' \| 'in_progress' \| 'completed' \| 'failed' \| 'cancelled'` | `'completed'` | Tool status |
| `rawInput` | `Record<string, unknown>` | `undefined` | Raw input data |
| `rawOutput` | `object` | `undefined` | Raw output data |
| `createdAt` | `number` | `Date.now()` | Created timestamp |
| `updatedAt` | `number` | `Date.now()` | Updated timestamp |

**Examples:**

```typescript
// Basic tool call
const toolCall = createMockToolCall({
  kind: 'read',
  title: 'Read configuration file',
});

// Tool call with input
const readToolCall = createMockToolCall({
  kind: 'read',
  title: 'Read file',
  rawInput: {
    filePath: '/home/user/project/config.json',
  },
});

// Tool call with input and output
const completeToolCall = createMockToolCall({
  kind: 'search',
  title: 'Search for patterns',
  rawInput: {
    pattern: 'function.*test',
    path: '/src',
  },
  rawOutput: {
    output: 'Found 3 matches',
    metadata: {
      loaded: ['/src/test.ts'],
      preview: 'function test() {...}',
      truncated: false,
    },
  },
});

// Failed tool call
const failedToolCall = createMockToolCall({
  kind: 'execute',
  title: 'Run command',
  status: 'failed',
  rawInput: {
    command: 'npm run build',
  },
  rawOutput: {
    output: 'Error: Build failed',
    metadata: {
      exit: 1,
      truncated: false,
    },
  },
});

// Multiple tool calls for testing lists
const toolCalls = [
  createMockToolCall({ kind: 'read', title: 'Read file' }),
  createMockToolCall({ kind: 'search', title: 'Search code' }),
  createMockToolCall({ kind: 'edit', title: 'Edit file' }),
];
```

---

### createMockPermissionRequest()

Creates a `NormalizedPermissionRequest` for testing permission dialog and approval flows.

**Signature:**

```typescript
function createMockPermissionRequest(options?: MockPermissionRequestOptions): NormalizedPermissionRequest
```

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `number` | Auto-generated | Request ID |
| `sessionId` | `string` | Auto-generated | Session ID |
| `toolCallId` | `string` | Auto-generated | Parent tool call ID |
| `description` | `string` | `undefined` | Permission description |
| `options` | `Array<{ optionId: string; name: string; kind: string }>` | Default approve/deny | Available options |
| `status` | `'pending' \| 'approved' \| 'denied' \| 'cancelled'` | `'pending'` | Request status |
| `selectedOptionId` | `string` | `undefined` | Selected option |

**Examples:**

```typescript
// Basic pending permission request
const permissionRequest = createMockPermissionRequest({
  sessionId: 'session-123',
  toolCallId: 'tool-456',
  status: 'pending',
});

// Permission request with custom options
const customPermissionRequest = createMockPermissionRequest({
  sessionId: 'session-123',
  toolCallId: 'tool-456',
  options: [
    { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
    { optionId: 'deny', name: 'Deny', kind: 'deny' },
    { optionId: 'allow_always', name: 'Always Allow', kind: 'allow_always' },
  ],
});

// Approved permission request
const approvedRequest = createMockPermissionRequest({
  sessionId: 'session-123',
  toolCallId: 'tool-456',
  status: 'approved',
  selectedOptionId: 'approve',
});

// Denied permission request
const deniedRequest = createMockPermissionRequest({
  sessionId: 'session-123',
  toolCallId: 'tool-456',
  status: 'denied',
  selectedOptionId: 'deny',
});
```

---

## Creating Test Data

### Single Fixtures

Create individual fixtures for focused tests:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageCard } from './MessageCard.js';
import { createMockMessage } from '../test-utils/factories.js';

describe('MessageCard', () => {
  it('renders user message correctly', () => {
    const message = createMockMessage({
      role: 'user',
      content: 'Hello from user',
    });

    render(<MessageCard message={message} />);

    expect(screen.getByText('Hello from user')).toBeInTheDocument();
  });
});
```

### Multiple Fixtures

Create multiple fixtures for testing lists or collections:

```typescript
import { createMockMessage, createMockThought } from '../test-utils/factories.js';

describe('MessageList', () => {
  it('renders multiple messages', () => {
    const messages = [
      createMockMessage({ role: 'user', content: 'User message 1' }),
      createMockMessage({ role: 'agent', content: 'Agent response 1' }),
      createMockMessage({ role: 'user', content: 'User message 2' }),
      createMockMessage({ role: 'agent', content: 'Agent response 2' }),
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByText('User message 1')).toBeInTheDocument();
    expect(screen.getByText('Agent response 2')).toBeInTheDocument();
  });
});
```

### Fixture Sequences

Create sequences of related fixtures for testing workflows:

```typescript
describe('Conversation flow', () => {
  it('handles complete conversation', () => {
    // Setup: Create a conversation sequence
    const userMessage = createMockMessage({
      role: 'user',
      content: 'Write a test function',
    });

    const thought = createMockThought({
      content: 'I need to create a test function',
    });

    const toolCall = createMockToolCall({
      kind: 'write',
      title: 'Write test file',
      status: 'completed',
    });

    const agentMessage = createMockMessage({
      role: 'agent',
      content: 'Test file created',
      status: 'completed',
    });

    // Test the complete flow
    render(
      <Conversation
        messages={[userMessage, agentMessage]}
        thoughts={[thought]}
        toolCalls={[toolCall]}
      />
    );

    // Verify all elements rendered
    expect(screen.getByText('Write a test function')).toBeInTheDocument();
    expect(screen.getByText('I need to create a test function')).toBeInTheDocument();
    expect(screen.getByText('Write test file')).toBeInTheDocument();
    expect(screen.getByText('Test file created')).toBeInTheDocument();
  });
});
```

---

## Fixture Patterns

### Pattern 1: Test Helper Functions

Create reusable helper functions in your test files:

```typescript
// In your test file
function createUserMessage(content: string) {
  return createMockMessage({
    role: 'user',
    content,
    status: 'completed',
  });
}

function createAgentResponse(content: string) {
  return createMockMessage({
    role: 'agent',
    content,
    status: 'completed',
  });
}

describe('Composer', () => {
  it('sends message', () => {
    const message = createUserMessage('Test message');
    // Use in test...
  });
});
```

### Pattern 2: Fixture Objects

Create fixture objects for complex test scenarios:

```typescript
const fixtures = {
  userMessages: {
    hello: createMockMessage({ role: 'user', content: 'Hello' }),
    question: createMockMessage({ role: 'user', content: 'What is TypeScript?' }),
    command: createMockMessage({ role: 'user', content: '/clear' }),
  },
  agentMessages: {
    greeting: createMockMessage({ role: 'agent', content: 'Hello! How can I help?' }),
    answer: createMockMessage({ role: 'agent', content: 'TypeScript is...' }),
    error: createMockMessage({ role: 'agent', content: 'Error occurred', status: 'error' }),
  },
  thoughts: {
    analyzing: createMockThought({ content: 'Analyzing request...' }),
    solution: createMockThought({ content: 'Found the solution' }),
  },
  toolCalls: {
    readFile: createMockToolCall({ kind: 'read', title: 'Read file' }),
    searchCode: createMockToolCall({ kind: 'search', title: 'Search codebase' }),
    editFile: createMockToolCall({ kind: 'edit', title: 'Edit file' }),
  },
};

describe('Components', () => {
  it('renders fixtures', () => {
    render(<MessageCard message={fixtures.userMessages.hello} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Pattern 3: Parameterized Fixtures

Create parameterized fixtures for testing variations:

```typescript
function createMessagesWithStatuses(statuses: NormalizedMessage['status'][]) {
  return statuses.map((status) =>
    createMockMessage({
      role: 'agent',
      status,
      content: `Message with ${status} status`,
    })
  );
}

describe('MessageStatusIndicator', () => {
  it('renders all statuses', () => {
    const statuses: NormalizedMessage['status'][] = [
      'streaming',
      'completed',
      'cancelled',
      'error',
    ];

    const messages = createMessagesWithStatuses(statuses);

    messages.forEach((message) => {
      render(<MessageStatusIndicator status={message.status} />);
      expect(screen.getByText(message.status)).toBeInTheDocument();
      // Cleanup or re-render for next iteration
    });
  });
});
```

### Pattern 4: Scenario-Based Fixtures

Create fixtures for specific test scenarios:

```typescript
import type { ThoughtItem } from '@harms-haus/acp-chat-react';

// Error scenario
const errorScenario = {
  message: createMockMessage({
    role: 'agent',
    status: 'error',
    content: 'Failed to process request',
  }),
  thought: createMockThought({
    content: 'Attempting to solve...',
    status: 'error',
  }),
  toolCall: createMockToolCall({
    kind: 'execute',
    title: 'Run command',
    status: 'failed',
    rawOutput: {
      output: 'Command failed with exit code 1',
      metadata: { exit: 1, truncated: false },
    },
  }),
};

describe('Error handling', () => {
  it('displays error state', () => {
    const thoughtGroup = {
      id: 'group-1',
      items: [
        { type: 'thought', id: errorScenario.thought.id, data: errorScenario.thought }
      ] as ThoughtItem[],
      startTime: Date.now() - 1000,
      endTime: Date.now(),
    };

    render(
      <>
        <MessageCard message={errorScenario.message} />
        <ThoughtStack group={thoughtGroup} />
        <ToolCall toolCall={errorScenario.toolCall} />
      </>
    );

    expect(screen.getByText('Failed to process request')).toBeInTheDocument();
    expect(screen.getByText('Command failed with exit code 1')).toBeInTheDocument();
  });
});
```

---

## Best Practices

### 1. Use Factories for All Test Data

Avoid creating mock objects manually. Factories ensure type correctness and reduce boilerplate:

```typescript
// ❌ Don't do this
const message: NormalizedMessage = {
  id: 'msg-1',
  role: 'user',
  status: 'completed',
  content: 'Test',
  contentBlocks: [{ type: 'text', text: 'Test' }],
  createdAt: Date.now(),
  // Easy to miss required fields
};

// ✅ Use factories
const message = createMockMessage({
  role: 'user',
  content: 'Test',
});
```

### 2. Override Only What You Need

Factories provide sensible defaults. Only specify what matters for your test:

```typescript
// ✅ Good - minimal override
const message = createMockMessage({ role: 'user' });

// ❌ Verbose - too many defaults specified
const message = createMockMessage({
  role: 'user',
  status: 'completed',
  content: 'Test message',
  timestamp: Date.now(),
});
```

### 3. Keep Factories in Sync

When types change, update factory functions immediately. The factories file should be the first place you check for type compatibility.

### 4. Use Descriptive Names

When creating fixtures, use descriptive variable names:

```typescript
// ✅ Clear intent
const streamingAgentMessage = createMockMessage({
  role: 'agent',
  status: 'streaming',
});

const completedUserMessage = createMockMessage({
  role: 'user',
  status: 'completed',
});

// ❌ Unclear
const msg1 = createMockMessage({ role: 'agent', status: 'streaming' });
const msg2 = createMockMessage({ role: 'user', status: 'completed' });
```

### 5. Group Related Fixtures

For complex tests, group related fixtures at the top of the test:

```typescript
describe('ToolCall', () => {
  it('shows input and output when expanded', () => {
    const toolCall = createMockToolCall({
      kind: 'read',
      title: 'Read configuration',
      rawInput: { filePath: '/config.json' },
      rawOutput: {
        output: '{"setting": "value"}',
        metadata: { truncated: false },
      },
    });

    render(<ToolCall toolCall={toolCall} isExpanded={true} />);

    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
  });
});
```

---

## Additional Resources

- [Component Testing Guide](./component-testing.md) - General component testing patterns
- [Test Utilities](../src/test-utils/index.ts) - Export location for all test utilities
