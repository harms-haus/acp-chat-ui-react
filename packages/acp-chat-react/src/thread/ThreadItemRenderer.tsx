import { memo, useMemo } from "react";
import type { ThreadItem } from "./types.js";
import type { ThoughtGroupWithState, ThoughtStackRenderContext } from "../thought/types.js";
import { MessageCard } from "../message/MessageCard.js";
import { ThoughtStack } from "../thought/ThoughtStack.js";
import type { NormalizedMessage } from "@acp/chat-core";
import type { MessageAction } from "../actions/types.js";
import type { ReactNode } from "react";

export interface ThreadItemRendererProps {
  item: ThreadItem;
  messageActions?: MessageAction[] | undefined;
  renderThoughtClosed?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
  renderThoughtOpen?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
}

function isThoughtGroup(data: NormalizedMessage | ThoughtGroupWithState): data is ThoughtGroupWithState {
  return "items" in data && "startTime" in data;
}

export const ThreadItemRenderer = memo(function ThreadItemRenderer({
  item,
  messageActions,
  renderThoughtClosed,
  renderThoughtOpen,
}: ThreadItemRendererProps) {
  const rendered = useMemo(() => {
    switch (item.type) {
      case "message": {
        const message = item.data as NormalizedMessage;
        return (
          <MessageCard
            message={message}
            showStatus={message.role === "agent"}
            actions={messageActions}
          />
        );
      }
      case "thought_group": {
        const group = item.data as ThoughtGroupWithState;
        return (
          <ThoughtStack
            group={group}
            isActive={group.isActive}
            renderClosed={renderThoughtClosed}
            renderOpen={renderThoughtOpen}
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
  }, [item, messageActions, renderThoughtClosed, renderThoughtOpen]);

  return (
    <div
      className="acp-thread__item"
      data-acp-thread-item
      data-acp-thread-item-type={item.type}
      data-acp-thread-item-id={item.id}
    >
      {rendered}
    </div>
  );
});

ThreadItemRenderer.displayName = "ThreadItemRenderer";
