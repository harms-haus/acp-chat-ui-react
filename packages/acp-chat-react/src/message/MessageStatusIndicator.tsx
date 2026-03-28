import { memo } from "react";
import type { MessageStatusIndicatorProps } from "./types.js";

export const MessageStatusIndicator = memo(function MessageStatusIndicator({
  status,
  className = "",
}: MessageStatusIndicatorProps) {
  const statusLabel = {
    streaming: "Streaming",
    complete: "Complete",
    cancelled: "Cancelled",
    error: "Error",
  }[status];

  return (
    <span
      data-acp-message-status={status}
      className={`acp-message__status acp-message__status--${status} ${className}`}
    >
      {status === "streaming" && (
        <span className="acp-message__status-indicator" aria-hidden="true">
          ●
        </span>
      )}
      {status === "complete" && (
        <span className="acp-message__status-indicator" aria-hidden="true">
          ✓
        </span>
      )}
      {status === "cancelled" && (
        <span className="acp-message__status-indicator" aria-hidden="true">
          ○
        </span>
      )}
      {status === "error" && (
        <span className="acp-message__status-indicator" aria-hidden="true">
          ✕
        </span>
      )}
      <span className="acp-message__status-text">{statusLabel}</span>
    </span>
  );
});

MessageStatusIndicator.displayName = "MessageStatusIndicator";
