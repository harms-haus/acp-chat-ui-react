import type { NormalizedToolCall } from "@acp/chat-core";
import type { Logger } from "../utils/logger.js";

export interface ToolCallProps {
  toolCall: NormalizedToolCall;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
  logger?: Logger;
}

export interface ToolCallHeaderProps {
  toolCall: NormalizedToolCall;
  isExpanded: boolean;
}

export interface ToolCallContentProps {
  toolCall: NormalizedToolCall;
}
