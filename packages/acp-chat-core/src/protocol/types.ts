/**
 * ACP Protocol Types - Re-exported from @agentclientprotocol/sdk
 * 
 * This module re-exports the official ACP SDK types for standardized
 * communication between code editors and AI-powered coding agents.
 * 
 * Custom types that extend beyond the standard ACP spec are defined here.
 * 
 * @see https://agentclientprotocol.com/protocol/schema
 * @see https://agentclientprotocol.com/protocol/overview
 */

// =============================================================================
// ACP Standard Types (from official SDK)
// =============================================================================

export type {
  // Core types
  AgentCapabilities,
  ClientCapabilities,
  SessionId,
  StopReason,
  
  // Content types
  Content,
  ContentBlock,
  TextContent,
  ImageContent,
  AudioContent,
  BlobResourceContents,
  TextResourceContents,
  ResourceLink,
  EmbeddedResource,
  
  // Tool/Call types
  ToolCall,
  ToolCallUpdate,
  
  // Session types
  NewSessionRequest,
  NewSessionResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  CloseSessionRequest,
  CloseSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  PromptRequest,
  SessionNotification,
  SessionUpdate,
  SessionInfo,
  SessionInfoUpdate,
  SessionMode,
  SessionModeState,
  SessionConfigOption,
  ConfigOptionUpdate,
  
  // Permission types
  PermissionOption,
  PermissionOptionId,
  PermissionOptionKind,
  RequestPermissionRequest,
  RequestPermissionResponse,
  RequestPermissionOutcome,
  
  // File system types
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  
  // Terminal types
  CreateTerminalRequest,
  CreateTerminalResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  
  // Initialization
  InitializeRequest,
  InitializeResponse,
  
  // Plan and commands
  Plan,
  PlanEntry,
  PlanEntryStatus,
  PlanEntryPriority,
  AvailableCommand,
  AvailableCommandsUpdate,
  CurrentModeUpdate,
  
  // Other useful types
  Annotations,
  Cost,
  Usage,
  UsageUpdate,
  ModelId,
  ModelInfo,
} from "@agentclientprotocol/sdk";

// =============================================================================
// Custom Types (Non-standard ACP extensions specific to this project)
// =============================================================================

/**
 * Session update type classification.
 * These are the specific update types we handle in our normalization layer.
 * Maps to ACP SessionUpdate.type and other agent→client notifications.
 * @see https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output
 */
export type ACPUpdateType =
  // Message content
  | "user_message"
  | "user_message_chunk"
  | "agent_message_chunk"
  | "agent_thought_chunk"
  // Tool calls
  | "tool_call"
  | "tool_call_update"
  // Permission requests
  | "permission_request"
  // Plan and commands
  | "plan_entry_update"
  | "available_commands_update"
  | "commands_update"
  // Session state
  | "current_mode_update"
  | "config_option_update"
  | "session_info_update"
  // Other updates
  | "cancelled"
  | string; // Allow extensibility

/**
 * ACP Method names (client → agent)
 * Based on the official ACP schema
 */
export type ACPMethod =
  // Core methods
  | "initialize"
  | "authenticate"
  // Session methods
  | "session/new"
  | "session/load"
  | "session/list"
  | "session/prompt"
  | "session/cancel"
  | "session/set_mode"
  | "session/set_config_option"
  // File system methods (if capability enabled)
  | "fs/read_text_file"
  | "fs/write_text_file"
  // Terminal methods (if capability enabled)
  | "terminal/create"
  | "terminal/kill"
  | "terminal/output"
  | "terminal/release"
  | "terminal/wait_for_exit";

/**
 * ACP Request structure (JSON-RPC 2.0)
 * Wrapper around AgentRequest with typed method field.
 * @see https://agentclientprotocol.com/protocol/schema
 */
export interface ACPRequest<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  method: ACPMethod;
  params?: T;
}

/**
 * ACP Response structure (JSON-RPC 2.0)
 * Wrapper around AgentResponse with typed error field.
 */
export interface ACPResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * ACP Notification structure (JSON-RPC 2.0)
 * One-way message, no response expected.
 * Wrapper around AgentNotification/ClientNotification with typed method field.
 */
export interface ACPNotification<T = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: T;
}

// =============================================================================
// Type Guards and Helpers
// =============================================================================

/**
 * Type guard to check if a notification is a session/update notification.
 * Session updates are the primary way agents report output to clients.
 */
export function isSessionUpdateNotification(
  notification: ACPNotification
): notification is ACPNotification<{
  sessionId: string;
  update: { type: ACPUpdateType; [key: string]: unknown };
}> {
  return (
    notification.method === "session/update" &&
    typeof notification.params === "object" &&
    notification.params !== null &&
    "update" in notification.params &&
    typeof notification.params.update === "object" &&
    notification.params.update !== null &&
    "type" in notification.params.update
  );
}

/**
 * Type guard to check if an update matches a specific type.
 * Used in switch statements for handling different update types.
 */
export function isUpdateType<T extends ACPUpdateType>(
  update: { type: string },
  type: T
): update is { type: T } & Record<string, unknown> {
  return update.type === type;
}
