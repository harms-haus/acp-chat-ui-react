/**
 * @acp/chat-core
 *
 * Internal TypeScript package for generated bridge types, ACP transport client,
 * session controller, dev-launch preset parsing, and incremental normalization.
 */

export const PACKAGE_VERSION = "0.0.1";

// Re-export generated types from TS-RS
export type {
  BridgeEnvelope,
  BridgeMessage,
  BridgeStatus,
  UnsupportedVersionError,
} from "./generated/index.js";

// Re-export bridge parser utilities
export {
  BridgeVersionError,
  ENVELOPE_VERSION,
  SUPPORTED_VERSIONS,
  createUnsupportedVersionError,
  isSupportedVersion,
  parseEnvelope,
  parseEnvelopeSafe,
  validateEnvelope,
} from "./bridge/index.js";

// Transport client
export { TransportClient } from "./transport/index.js";
export type { ConnectionStatus, TransportConfig, TransportEvents } from "./transport/index.js";

// Session controller
export { SessionController } from "./session/index.js";
export type { SessionControllerState, StartAgentConfig, PermissionRequestParams, PermissionOption } from "./session/index.js";

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

// Pure helpers (moved from Svelte package)
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