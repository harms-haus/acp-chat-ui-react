/**
 * ACP Protocol - Public API
 * 
 * Exports all ACP standard types and utilities.
 * This is the only place where ACP protocol types should be exported from.
 */

export {
  // Types
  type ACPMethod,
  type ACPUpdateType,
  type ACPRequest,
  type ACPResponse,
  type ACPNotification,
  type SessionUpdateNotification,
  type SessionId,
  type ContentBlock,
  type TextContent,
  type ImageContent,
  type AudioContent,
  type ResourceLink,
  type EmbeddedResource,
  type ToolCall,
  type PermissionRequest,
  type StopReason,
  
  // Type guards
  isSessionUpdateNotification,
  isUpdateType,
} from './types.js';
