import { memo } from "react";
import type { ThreadItem } from "./types.js";

interface MessagePlaceholderProps {
  item: ThreadItem;
}

function getContent(item: ThreadItem): string {
  if (item.type === "message") {
    return (item.data as { content?: string }).content ?? "";
  }
  if (item.type === "thought_group") {
    const group = item.data as { items?: Array<{ data?: { content?: string } }> };
    return group.items?.[0]?.data?.content ?? "Thought group";
  }
  return "";
}

function getLabel(item: ThreadItem, isUser: boolean): string {
  if (isUser) return "User";
  if (item.type === "thought_group") return "Thought";
  return "Agent";
}

export const MessagePlaceholder = memo(function MessagePlaceholder({
  item,
}: MessagePlaceholderProps) {
  const isUser = item.type === "message" && "role" in item.data && item.data.role === "user";
  const content = getContent(item);
  const label = getLabel(item, isUser);

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
        {label}
      </div>
      <div style={{ fontSize: "14px", lineHeight: "1.5" }}>
        {content.slice(0, 200)}
        {content.length > 200 ? "..." : ""}
      </div>
    </div>
  );
});
