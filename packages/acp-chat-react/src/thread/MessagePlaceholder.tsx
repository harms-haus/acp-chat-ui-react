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
      data-testid="acp-message-placeholder"
      data-acp-message-id={item.id}
      data-acp-message-role={isUser ? "user" : "agent"}
      className={`acp-message-placeholder ${isUser ? "acp-message-placeholder--user" : "acp-message-placeholder--agent"}`}
    >
      <div className="acp-message-placeholder__label">
        {label}
      </div>
      <div className="acp-message-placeholder__content" data-testid="acp-message-placeholder-content">
        {content.slice(0, 200)}
        {content.length > 200 ? "..." : ""}
      </div>
    </div>
  );
});
