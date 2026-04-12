/**
 * Factory functions for creating mock test data.
 *
 * This module provides factory functions for creating realistic mock data
 * for messages, thoughts, tool calls, and permission requests.
 */

import type {
  NormalizedMessage,
  NormalizedThought,
  NormalizedToolCall,
  NormalizedPermissionRequest,
  ContentBlock,
} from '@harms-haus/acp-chat-core';

/**
 * Options for creating a mock message.
 */
export interface MockMessageOptions {
  /** Message ID (auto-generated if not provided) */
  id?: string;
  /** Turn ID (auto-generated if not provided) */
  turnId?: string;
  /** Message role */
  role?: 'user' | 'agent';
  /** Message status */
  status?: 'streaming' | 'completed' | 'cancelled' | 'error';
  /** Message content */
  content?: string;
  /** Content blocks */
  contentBlocks?: ContentBlock[];
  /** Timestamp */
  timestamp?: number;
  /** Parent message ID (for threaded conversations) */
  parentMessageId?: string;
}

/**
 * Create a mock message with sensible defaults.
 *
 * @example
 * ```tsx
 * const message = createMockMessage({
 *   role: 'user',
 *   content: 'Hello, world!'
 * });
 * ```
 */
export function createMockMessage(options: MockMessageOptions = {}): NormalizedMessage {
  const id = options.id ?? `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const now = Date.now();

  const result: NormalizedMessage = {
    id,
    role: options.role ?? 'agent',
    status: options.status ?? 'completed',
    content: options.content ?? 'Test message',
    contentBlocks: options.contentBlocks ?? [
      { type: 'text', text: options.content ?? 'Test message' },
    ],
    createdAt: options.timestamp ?? now,
    updatedAt: options.timestamp ?? now,
    turnId: options.turnId ?? `turn-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
  };

  if (options.parentMessageId !== undefined) {
    result.parentMessageId = options.parentMessageId;
  }

  return result;
}

/**
 * Options for creating a mock thought.
 */
export interface MockThoughtOptions {
  /** Thought ID (auto-generated if not provided) */
  id?: string;
  /** Turn ID (optional) */
  turnId?: string;
  /** Thought content */
  content?: string;
  /** Thought status */
  status?: 'streaming' | 'completed' | 'cancelled' | 'error';
  /** Created timestamp */
  createdAt?: number;
  /** Updated timestamp */
  updatedAt?: number;
}

/**
 * Create a mock thought with sensible defaults.
 *
 * @example
 * ```tsx
 * const thought = createMockThought({
 *   content: 'Thinking about the solution...'
 * });
 * ```
 */
export function createMockThought(options: MockThoughtOptions = {}): NormalizedThought {
  const id = options.id ?? `thought-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const now = Date.now();

  const result: NormalizedThought = {
    id,
    content: options.content ?? 'Thinking...',
    status: options.status ?? 'completed',
    createdAt: options.createdAt ?? now - 1000,
    updatedAt: options.updatedAt ?? now,
  };

  if (options.turnId !== undefined) {
    result.turnId = options.turnId;
  }

  return result;
}

/**
 * Options for creating a mock tool call.
 */
export interface MockToolCallOptions {
  /** Tool call ID (auto-generated if not provided) */
  toolCallId?: string;
  /** Tool kind */
  kind?: 'read' | 'search' | 'edit' | 'write' | 'execute' | 'glob' | 'grep' | 'unknown';
  /** Tool title */
  title?: string;
  /** Tool call status */
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  /** Raw input */
  rawInput?: Record<string, unknown>;
  /** Raw output */
  rawOutput?: {
    metadata: {
      loaded?: string[];
      preview?: string;
      truncated: boolean;
      exit?: number;
    };
    output: string;
  };
  /** Created timestamp */
  createdAt?: number;
  /** Updated timestamp */
  updatedAt?: number;
}

/**
 * Create a mock tool call with sensible defaults.
 *
 * @example
 * ```tsx
 * const toolCall = createMockToolCall({
 *   kind: 'search',
 *   title: 'Search test',
 *   status: 'completed'
 * });
 * ```
 */
export function createMockToolCall(options: MockToolCallOptions = {}): NormalizedToolCall {
  const toolCallId = options.toolCallId ?? `tool-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const now = Date.now();

  const result: NormalizedToolCall = {
    toolCallId,
    kind: options.kind ?? 'unknown',
    title: options.title ?? 'Test tool',
    status: options.status ?? 'completed',
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
  };

  if (options.rawInput !== undefined) {
    result.rawInput = options.rawInput;
  }

  if (options.rawOutput !== undefined) {
    result.rawOutput = options.rawOutput;
  }

  return result;
}

/**
 * Options for creating a mock permission request.
 */
export interface MockPermissionRequestOptions {
  /** Request ID (auto-generated if not provided) */
  id?: number;
  /** Session ID (required) */
  sessionId?: string;
  /** Parent tool call ID (required) */
  toolCallId?: string;
  /** Available options */
  options?: Array<{ optionId: string; name: string; kind: string }>;
  /** Request status */
  status?: 'pending' | 'approved' | 'denied' | 'cancelled';
  /** Selected option ID (if approved/denied) */
  selectedOptionId?: string;
  /** Created timestamp */
  createdAt?: number;
}

/**
 * Create a mock permission request with sensible defaults.
 *
 * @example
 * ```tsx
 * const permissionRequest = createMockPermissionRequest({
 *   sessionId: 'session-123',
 *   toolCallId: 'tool-123',
 *   status: 'pending'
 * });
 * ```
 */
export function createMockPermissionRequest(
  options: MockPermissionRequestOptions = {}
): NormalizedPermissionRequest {
  const id = options.id ?? Math.floor(Math.random() * 1000000);

  const result: NormalizedPermissionRequest = {
    requestId: id,
    sessionId: options.sessionId ?? `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    toolCallId: options.toolCallId ?? `tool-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    options: options.options ?? [
      { optionId: 'approve', name: 'Approve', kind: 'allow_once' },
      { optionId: 'deny', name: 'Deny', kind: 'deny' },
    ],
    status: options.status ?? 'pending',
    createdAt: options.createdAt ?? Date.now(),
  };

  if (options.selectedOptionId !== undefined) {
    result.selectedOptionId = options.selectedOptionId;
  }

  return result;
}
