import { memo, useMemo } from "react";
import type { MessageCardProps } from "./types.js";
import { ContentRenderer } from "../content/ContentRenderer.js";
import { MessageStatusIndicator } from "./MessageStatusIndicator.js";
import { MessageTimestamp } from "./MessageTimestamp.js";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const MessageCard = memo(function MessageCard({
  message,
  showStatus = true,
  children,
  className = "",
}: MessageCardProps) {
  const roleClass = useMemo(
    () => (message.role === "user" ? "acp-message--user" : "acp-message--agent"),
    [message.role]
  );

  const statusClass = useMemo(
    () => `acp-message--status-${message.status}`,
    [message.status]
  );

  const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0;

  return (
    <div
      data-acp-message-role={message.role}
      data-acp-message-status={message.status}
      data-acp-message-id={message.id}
      className={`acp-message ${roleClass} ${statusClass} ${className}`}
    >
      <div className="acp-message__header">
        <span className="acp-message__role-label">
          {message.role === "user" ? "You" : "Agent"}
        </span>
        {message.createdAt && (
          <MessageTimestamp timestamp={message.createdAt} />
        )}
        {showStatus && <MessageStatusIndicator status={message.status} />}
      </div>

      <div className="acp-message__content">
        {children ? (
          children
        ) : hasContentBlocks ? (
          <ContentRenderer blocks={message.contentBlocks} />
        ) : (
          <div className="acp-message__text" data-acp-content-type="text">
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
});

MessageCard.displayName = "MessageCard";
