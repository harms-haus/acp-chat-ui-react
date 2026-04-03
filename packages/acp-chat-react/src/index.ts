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
  ThreadProps,
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
  SettingsRowRenderProps,
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

export {
  SettingsPanel,
  useSettings,
  SettingsSelect,
  SettingsCheckbox,
  SettingsSwitch,
  SettingsTabs,
} from "./settings/index.js";
export type {
  AcpMode,
  AcpModel,
  SettingsPanelProps,
  SettingsPanelState,
  SettingsPanelActions,
  SettingsSelectOption,
  SettingsSelectProps,
  SettingsCheckboxProps,
  SettingsSwitchProps,
  SettingsTabItem,
  SettingsTabsProps,
} from "./settings/index.js";
export { DEFAULT_ACP_MODES, DEFAULT_ACP_MODELS } from "./settings/index.js";

export { SessionList } from "./session-list/index.js";
export type {
  SessionListProps,
  SessionItem,
  SessionItemRenderProps,
  SessionListState,
  SessionListActions,
} from "./session-list/index.js";

export { ThoughtStack } from "./thought/index.js";
export type {
  ThoughtStackProps,
  ThoughtItem,
  ThoughtGroup,
  ThoughtItemProps,
  ThoughtItemRenderProps,
  ThoughtStackRenderContext,
} from "./thought/index.js";

export { ToolCall } from "./tool-call/index.js";
export type {
  ToolCallProps,
  ToolCallHeaderProps,
  ToolCallContentProps,
} from "./tool-call/index.js";

export { SlashSuggestions, useSlashCommands } from "./slash/index.js";
export type {
  SlashCommand,
  SlashSuggestionProps,
  SlashTriggerProps,
  UseSlashCommandsOptions,
  UseSlashCommandsReturn,
} from "./slash/index.js";

export { MessageActionBar, useMessageActions } from "./actions/index.js";
export type {
  MessageAction,
  MessageActionBarProps,
  MessageActionMenuProps,
  UseMessageActionsOptions,
  UseMessageActionsReturn,
} from "./actions/index.js";