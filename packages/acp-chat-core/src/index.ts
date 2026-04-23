/**
 * @harms-haus/acp-chat-core
 *
 * Pure ACP protocol implementation. Session control, incremental normalization.
 * NO bridge protocol - transport layer is the responsibility of acp-ws-bridge.
 * 
 * This package provides:
 * - ACP standard types and interfaces
 * - Transport interface (abstract only)
 * - SessionController (ACP protocol only)
 * - Normalization layer (ACP events → UI state)
 * - Capture infrastructure (test data generation)
 * 
 * For actual transport, use @harms-haus/acp-ws-bridge which provides:
 * - WebSocket transport
 * - Bridge envelope protocol
 * - Replay infrastructure
 */

export const PACKAGE_VERSION = "0.0.1";

// Protocol types (ACP standard only)
// Note: ContentBlock, ImageContent, ResourceLink are NOT exported here
// because we export normalized versions from the normalization layer
export type {
 ACPMethod,
 ACPUpdateType,
 ACPRequest,
 ACPResponse,
 ACPNotification,
 SessionNotification,
 SessionId,
 TextContent,
 AudioContent,
 EmbeddedResource,
 ToolCall,
 StopReason,
} from './protocol/types.js';

export {
  isSessionUpdateNotification,
  isUpdateType,
} from './protocol/types.js';

// Transport interface (abstract - implementations in transport packages)
export type { Transport, ConnectionStatus } from './transport/transport-interface.js';
export { isTerminalStatus, isConnected } from './transport/transport-interface.js';

// Session controller (ACP protocol only)
export { SessionController } from "./session/index.js";
export type { 
  SessionControllerState, 
  StartAgentConfig, 
  PermissionRequestParams, 
  PermissionOption, 
  ConfigOption,
  ConfigOptionValue,
} from "./session/index.js";

// Factory functions
export { 
  createSessionControllerWithTransport
} from './session/factory.js';

// Capture infrastructure (for testing)
export { DefaultSessionCaptureInterceptor } from "./session/index.js";
export type { 
  CapturedSession, 
  CapturedEvent, 
  SessionCaptureInterceptor 
} from "./session/index.js";

// Normalization
export {
 createNormalizedState,
 applySessionUpdate,
 getMessages,
 getMessage,
 getMessagesByTurn,
 getThoughts,
 getToolCalls,
 getToolCall,
 getTimeline,
 getPermissionRequests,
 getPendingPermissionRequests,
 getPermissionRequest,
 updatePermissionRequestStatus,
} from "./normalization/index.js";
export type {
 NormalizedMessage,
 NormalizedState,
 NormalizedThought,
 NormalizedToolCall,
 MessageRole,
 MessageStatus,
 ThoughtStatus,
 ToolCallKind,
 ToolCallStatus,
 ContentBlock,
 ContentBlockType,
 TextContentBlock,
 ResourceContentBlock,
 ResourceLinkContentBlock,
 TimelineItem,
 SessionUpdateParams,
 NormalizedPermissionRequest,
 PermissionRequestStatus,
} from "./normalization/index.js";

// Launch presets
export { parseLaunchPreset, isPresetValid } from "./presets/index.js";
export type { LaunchPreset } from "./presets/index.js";

// Replay types (useful for testing with ws-bridge)
export { estimateTokenCount } from "./replay/types.js";
export type {
  ReplaySessionMetadata,
  ReplaySessionData,
  ReplayEvent,
  ACPReplayEvent,
  ReplayManifest,
} from "./replay/types.js";

// Pure helpers
export {
  shouldSendOnKeydown,
  canSend,
  canStop,
  getButtonState,
  getSendText,
  isSendButtonDisabled,
  startPrompt,
  completePrompt,
  cancelPrompt,
  failPrompt,
  isPromptActive,
  shouldShowStopButton,
  groupThoughtItems,
  createGroupedTimeline,
  isThoughtGroupActive,
  shouldThoughtGroupBeOpen,
} from "./helpers/index.js";
export type {
  ComposerState,
  PromptPhase,
  PromptLifecycleState,
  ThoughtItem,
  ThoughtGroup,
  GroupedTimelineItem,
} from "./helpers/index.js";

// Filesystem types
export type {
  FileReadRequest,
  FileReadResponse,
  FileWriteRequest,
  FileWriteResponse,
  FileReadHandler,
  FileWriteHandler,
  FileSystemSubscription,
} from "./filesystem/types.js";

export { FileSystemSubscriptionManager } from "./filesystem/subscription-manager.js";
