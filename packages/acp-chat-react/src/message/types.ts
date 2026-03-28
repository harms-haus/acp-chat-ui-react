import type { ReactNode } from "react";
import type {
  NormalizedMessage,
  MessageRole,
  MessageStatus,
} from "@acp/chat-core";

export interface MessageCardProps {
  message: NormalizedMessage;
  showStatus?: boolean;
  children?: ReactNode;
  className?: string;
}

export interface MessageListProps {
  messages: NormalizedMessage[];
  className?: string;
  renderMessage?: (message: NormalizedMessage, index: number) => ReactNode;
  gap?: number;
}

export interface MessageGroupProps {
  messages: NormalizedMessage[];
  role: MessageRole;
  className?: string;
}

export interface MessageStatusIndicatorProps {
  status: MessageStatus;
  className?: string;
}

export interface MessageAvatarProps {
  role: MessageRole;
  className?: string;
}

export interface MessageTimestampProps {
  timestamp?: number;
  className?: string;
}

export interface MessageEmptyStateProps {
  message?: string;
  className?: string;
}

export interface MessageErrorFallbackProps {
  error: Error;
  onReset?: () => void;
}
