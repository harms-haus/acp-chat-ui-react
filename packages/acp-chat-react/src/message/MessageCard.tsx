import { memo, useMemo, useCallback } from "react";
import type { NormalizedMessage } from "@harms-haus/acp-chat-core";
import type { MessageCardProps } from "./types.js";
import { noOpLogger, type Logger } from "../utils/logger.js";
import { ContentRenderer } from "../content/ContentRenderer.js";
import { MessageStatusIndicator } from "./MessageStatusIndicator.js";
import { MessageTimestamp } from "./MessageTimestamp.js";
import { MessageActionBar } from "../actions/MessageActionBar.js";
import type { MessageAction } from "../actions/types.js";

function _formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface MessageCardExtendedProps extends MessageCardProps {
  actions?: MessageAction[] | undefined;
  onCopy?: ((msg: NormalizedMessage) => void) | undefined;
  logger?: Logger;
}

export const MessageCard = memo(function MessageCard({
  message,
  showStatus = true,
  children,
  className = "",
  actions,
  onCopy,
  logger: _logger = noOpLogger,
}: MessageCardExtendedProps) {
  const roleClass = useMemo(
    () => (message.role === "user" ? "acp-message--user" : "acp-message--agent"),
    [message.role]
  );

  const statusClass = useMemo(
    () => `acp-message--status-${message.status}`,
    [message.status]
  );

  const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0;

  const handleCopy = useCallback(() => {
    onCopy?.(message);
  }, [message, onCopy]);

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
      <div className="acp-message__actions">
        <MessageActionBar
          message={message}
          actions={actions}
          onCopy={handleCopy}
        />
      </div>
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
