export { PACKAGE_VERSION, ENVELOPE_VERSION, SUPPORTED_VERSIONS, isSupportedVersion } from "@acp/chat-core";

export { AcpStore, createAcpStore } from "./store/index.js";
export type {
  AcpStoreConfig,
  AcpStoreSnapshot,
  SnapshotSelector,
  StoreSubscriber,
} from "./store/index.js";

export {
  useMessages,
  useMessage,
  useMessageByTurnId,
  useThoughts,
  useToolCalls,
  useToolCall,
  useTimeline,
  useSessionState,
  useIsConnected,
  useIsInitialized,
  useSessionId,
  useStoreVersion,
  useSnapshotSelector,
  useTimelineItems,
  useMessagesCount,
  useThoughtsCount,
  useToolCallsCount,
  useActiveStreamingMessage,
} from "./hooks/index.js";

export { VirtualizedThread, MessagePlaceholder, Thread } from "./thread/index.js";
export type {
  VirtualizedThreadProps,
  VirtualizedThreadRef,
  ThreadItem,
  ThreadItemType,
  ScrollState,
  ThreadRowProps,
  VirtualizationConfig,
  DEFAULT_VIRTUALIZATION_CONFIG,
} from "./thread/index.js";

export {
  MessageCard,
  MessageList,
  MessageStatusIndicator,
  MessageTimestamp,
  MessageEmptyState,
} from "./message/index.js";
export type {
  MessageCardProps,
  MessageListProps,
  MessageGroupProps,
  MessageStatusIndicatorProps,
  MessageAvatarProps,
  MessageTimestampProps,
  MessageEmptyStateProps,
  MessageErrorFallbackProps,
} from "./message/index.js";

export {
  ContentRenderer,
  TextContent,
  ResourceContent,
  ResourceLinkContent,
  UnsupportedContent,
} from "./content/index.js";
export type {
  ContentRendererProps,
  TextContentProps,
  ResourceContentProps,
  ResourceLinkContentProps,
  UnsupportedContentProps,
} from "./content/index.js";

export { UpdateRow, UpdateList, UpdateIndicator } from "./update/index.js";
export type {
  UpdateStatus,
  UpdateRowProps,
  UpdateIndicatorProps,
  UpdateListProps,
  UpdateEmptyStateProps,
} from "./update/index.js";

export { Composer } from "./composer/index.js";
export type {
  ComposerProps,
  ComposerState,
  ComposerTextareaProps,
  ComposerControlsProps,
} from "./composer/index.js";
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
  type PromptPhase,
  type PromptLifecycleState,
  type ComposerLogicState,
} from "./composer/index.js";