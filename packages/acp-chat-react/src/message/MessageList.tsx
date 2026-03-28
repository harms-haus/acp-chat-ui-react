import { memo, useCallback } from "react";
import type { MessageListProps } from "./types.js";
import { MessageCard } from "./MessageCard.js";

export const MessageList = memo(function MessageList({
  messages,
  className = "",
  renderMessage,
  gap = 8,
}: MessageListProps) {
  const defaultRenderMessage = useCallback(
    (message: typeof messages[0], index: number) => (
      <MessageCard
        key={message.id}
        message={message}
        showStatus={message.role === "agent"}
      />
    ),
    []
  );

  const renderFn = renderMessage ?? defaultRenderMessage;

  return (
    <div
      data-acp-message-list
      className={`acp-message-list ${className}`}
      style={{ display: "flex", flexDirection: "column", gap }}
    >
      {messages.map((message, index) => (
        <div
          key={message.id}
          data-acp-message-wrapper
          data-acp-message-index={index}
        >
          {renderFn(message, index)}
        </div>
      ))}
    </div>
  );
});

MessageList.displayName = "MessageList";
