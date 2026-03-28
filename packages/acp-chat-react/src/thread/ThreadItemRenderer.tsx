import { memo, useMemo } from "react";
import type { ThreadItem } from "./types.js";
import { MessageCard } from "../message/MessageCard.js";
import { UpdateRow } from "../update/UpdateRow.js";
import type { NormalizedMessage, NormalizedThought, NormalizedToolCall } from "@acp/chat-core";

interface ThreadItemRendererProps {
  item: ThreadItem;
}

export const ThreadItemRenderer = memo(function ThreadItemRenderer({
  item,
}: ThreadItemRendererProps) {
  const rendered = useMemo(() => {
    switch (item.type) {
      case "message": {
        const message = item.data as NormalizedMessage;
        return (
          <MessageCard
            message={message}
            showStatus={message.role === "agent"}
          />
        );
      }
      case "thought": {
        const thought = item.data as NormalizedThought;
        return (
          <UpdateRow
            type="thought"
            title={thought.content.slice(0, 50)}
            status="completed"
            timestamp={thought.createdAt}
          />
        );
      }
      case "tool_call": {
        const toolCall = item.data as NormalizedToolCall;
        return (
          <UpdateRow
            type={toolCall.kind}
            title={toolCall.title}
            status={toolCall.status === "completed" ? "completed" : "pending"}
            timestamp={toolCall.createdAt}
          />
        );
      }
      default:
        return (
          <div data-acp-thread-item-unknown>
            Unknown item type
          </div>
        );
    }
  }, [item]);

  return (
    <div
      data-acp-thread-item
      data-acp-thread-item-type={item.type}
      data-acp-thread-item-id={item.id}
    >
      {rendered}
    </div>
  );
});

ThreadItemRenderer.displayName = "ThreadItemRenderer";
