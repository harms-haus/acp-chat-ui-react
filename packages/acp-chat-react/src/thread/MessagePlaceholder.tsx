import { memo } from "react";
import type { ThreadItem } from "./types.js";

interface MessagePlaceholderProps {
  item: ThreadItem;
}

export const MessagePlaceholder = memo(function MessagePlaceholder({
  item,
}: MessagePlaceholderProps) {
  const isUser = item.type === "message" && "role" in item.data && item.data.role === "user";
  const content =
    item.type === "message"
      ? (item.data as { content?: string }).content ?? ""
      : item.type === "thought"
        ? (item.data as { content?: string }).content ?? ""
        : "Tool call";

  return (
    <div
      data-acp-message-placeholder
      data-acp-message-id={item.id}
      data-acp-message-role={isUser ? "user" : "agent"}
      style={{
        padding: "12px 16px",
        borderRadius: "8px",
        backgroundColor: isUser ? "var(--acp-color-user-bg, #e3f2fd)" : "var(--acp-color-agent-bg, #f5f5f5)",
        maxWidth: "80%",
        alignSelf: isUser ? "flex-end" : "flex-start",
        wordBreak: "break-word",
      }}
    >
      <div style={{ fontSize: "12px", color: "var(--acp-color-muted, #666)", marginBottom: "4px" }}>
        {isUser ? "User" : item.type === "thought" ? "Thought" : item.type === "tool_call" ? "Tool" : "Agent"}
      </div>
      <div style={{ fontSize: "14px", lineHeight: "1.5" }}>
        {content.slice(0, 200)}
        {content.length > 200 ? "..." : ""}
      </div>
    </div>
  );
});
