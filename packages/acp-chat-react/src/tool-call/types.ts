import type { NormalizedToolCall } from "@acp/chat-core";

export interface ToolCallProps {
  toolCall: NormalizedToolCall;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export interface ToolCallHeaderProps {
  toolCall: NormalizedToolCall;
  isExpanded: boolean;
}

export interface ToolCallContentProps {
  toolCall: NormalizedToolCall;
}
