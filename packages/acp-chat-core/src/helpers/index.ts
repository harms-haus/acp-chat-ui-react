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