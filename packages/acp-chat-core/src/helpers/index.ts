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
} from "./composer-logic.js";
export type { ComposerState, PromptPhase, PromptLifecycleState } from "./composer-logic.js";

export {
  groupThoughtItems,
  createGroupedTimeline,
  isThoughtGroupActive,
  shouldThoughtGroupBeOpen,
} from "./thought-stack-logic.js";
export type { ThoughtItem, ThoughtGroup, GroupedTimelineItem } from "./thought-stack-logic.js";

// Token estimation utilities
export {
  estimateTokenCount,
  ZERO_TOKEN_DELAY_MS,
  DEFAULT_TPS,
  BURST_THRESHOLD,
  CHUNK_SIZE,
  calculateTokenDelay,
  shouldSplitBurst,
  calculateChunkCount,
} from "./token-estimation.js";