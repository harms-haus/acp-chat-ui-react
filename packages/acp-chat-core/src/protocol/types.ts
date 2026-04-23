/**
 * ACP Protocol Types - Pure ACP standard types only
 * Based on: https://agentclientprotocol.com/protocol/schema
 * 
 * These types represent the official ACP protocol specification.
 * No transport-specific or implementation-specific types should be added here.
 * 
 * @see https://agentclientprotocol.com/protocol/schema
 * @see https://agentclientprotocol.com/protocol/overview
 * @see https://agentclientprotocol.com/protocol/prompt-turn
 */

// ============================================================================
// Standard ACP Methods (Client → Agent)
// ============================================================================

/**
 * All ACP methods that a client can call on an agent.
 * Based on the official ACP schema and actual usage in this codebase.
 * 
 * Core session methods (REQUIRED for all agents):
 * - initialize, session/new, session/load, session/prompt, session/cancel
 * 
 * Optional capabilities (agent-dependent):
 * - session/list, session/set_mode, session/set_config_option
 * - authenticate (if authentication required)
 * - fs/* (if filesystem capability)
 * - terminal/* (if terminal capability)
 */
export type ACPMethod =
  // Core methods (always available)
  | 'initialize'
  | 'session/new'
  | 'session/load'
  | 'session/prompt'
  | 'session/cancel'
  
  // Session management (optional capabilities)
  | 'session/list'
  | 'session/set_mode'
  | 'session/set_config_option'
  
  // Authentication (if required by agent)
  | 'authenticate'
  
  // File system operations (if filesystem capability)
  | 'fs/read_text_file'
  | 'fs/write_text_file'
  
  // Terminal operations (if terminal capability)
  | 'terminal/create'
  | 'terminal/kill'
  | 'terminal/output'
  | 'terminal/release'
  | 'terminal/wait_for_exit';

// ============================================================================
// Standard ACP Notification Types (Agent → Client)
// ============================================================================

/**
 * All session/update notification types that an agent can send.
 * These are sent via the session/update notification method.
 * 
 * Based on actual usage in this codebase (normalization/store.ts):
 * - user_message / user_message_chunk - User message content
 * - agent_message_chunk - Agent response chunks
 * - agent_thought_chunk - Agent thinking/reasoning
 * - tool_call - Tool invocation
 * - tool_call_update - Tool call status change
 * - permission_request - Permission request for tool call
 * 
 * Note: The following ACP standard types are NOT yet handled in this codebase:
 * - plan_entry_update
 * - available_commands_update
 * - current_mode_update
 * - config_option_update
 * - session_info_update
 */
export type ACPUpdateType =
  // Message content
  | 'user_message'
  | 'user_message_chunk'
  | 'agent_message_chunk'
  | 'agent_thought_chunk'
  
  // Tool calls
  | 'tool_call'
  | 'tool_call_update'
  
  // Permission requests
  | 'permission_request';

// ============================================================================
// ACP JSON-RPC Base Types
// ============================================================================

/**
 * JSON-RPC 2.0 request structure for ACP methods.
 */
export interface ACPRequest<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  method: ACPMethod;
  params?: T;
}

/**
 * JSON-RPC 2.0 response structure for ACP methods.
 */
export interface ACPResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC 2.0 notification structure (one-way, no response expected).
 */
export interface ACPNotification<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
}

// ============================================================================
// Session Update Notification
// ============================================================================

/**
 * Session update notification sent by the agent.
 * 
 * All agent→client progress updates are sent via this notification.
 * The update type determines how to interpret the payload.
 * 
 * @see https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output
 */
export interface SessionUpdateNotification {
  jsonrpc: '2.0';
  method: 'session/update';
  params: {
    sessionId: string;
    update: {
      type: ACPUpdateType;
      [key: string]: unknown;
    };
  };
}

/**
 * Type guard to check if a notification is a session update.
 */
export function isSessionUpdateNotification(
  notification: ACPNotification
): notification is SessionUpdateNotification {
  return (
    notification.method === 'session/update' &&
    'params' in notification &&
    typeof notification.params === 'object' &&
    'update' in notification.params &&
    typeof notification.params.update === 'object' &&
    'type' in notification.params.update
  );
}

/**
 * Type guard to check if an update matches a specific type.
 */
export function isUpdateType<T extends ACPUpdateType>(
  update: { type: string },
  type: T
): update is { type: T } & Record<string, unknown> {
  return update.type === type;
}

// ============================================================================
// Common ACP Types (from schema)
// ============================================================================

/**
 * Session identifier format.
 * @see https://agentclientprotocol.com/protocol/schema#sessionid
 */
export type SessionId = string;

/**
 * Content block types that can appear in messages.
 * @see https://agentclientprotocol.com/protocol/content
 */
export type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceLink
  | EmbeddedResource;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64 encoded
  mimeType: string;
}

export interface AudioContent {
  type: 'audio';
  data: string; // base64 encoded
  mimeType: string;
}

export interface ResourceLink {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    name?: string;
    description?: string;
  };
}

export interface EmbeddedResource {
  type: 'resource';
  resource: {
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
  };
}

/**
 * Tool call structure.
 * @see https://agentclientprotocol.com/protocol/tool-calls
 */
export interface ToolCall {
  toolCallId: string;
  name: string;
  arguments?: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Permission request structure.
 * @see https://agentclientprotocol.com/protocol/tool-calls#permission-requests
 */
export interface PermissionRequest {
  toolCallId: string;
  options: Array<{
    optionId: string;
    name: string;
    kind: 'allow_once' | 'allow_always' | 'deny' | 'deny_always';
  }>;
}

/**
 * Stop reason for prompt completion.
 * @see https://agentclientprotocol.com/protocol/schema#stopreason
 */
export type StopReason =
  | 'end_turn'
  | 'end_session'
  | 'cancel'
  | 'error';
