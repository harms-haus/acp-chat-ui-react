import { memo } from "react";
import type { MessageEmptyStateProps } from "./types.js";

export const MessageEmptyState = memo(function MessageEmptyState({
  message = "No messages yet",
  className = "",
}: MessageEmptyStateProps) {
  return (
    <div
      data-acp-message-empty
      className={`acp-message-empty ${className}`}
    >
      <div className="acp-message-empty__content">
        <span className="acp-message-empty__icon" aria-hidden="true">
          💬
        </span>
        <p className="acp-message-empty__text">{message}</p>
      </div>
    </div>
  );
});

MessageEmptyState.displayName = "MessageEmptyState";
