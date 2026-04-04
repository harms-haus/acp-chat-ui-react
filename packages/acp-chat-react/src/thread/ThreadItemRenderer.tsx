import { memo, useMemo } from "react";
import type { ThreadItem } from "./types.js";
import type { ThoughtGroupWithState, ThoughtStackRenderContext } from "../thought/types.js";
import { MessageCard } from "../message/MessageCard.js";
import { ThoughtStack } from "../thought/ThoughtStack.js";
import { PermissionRequestCard } from "../permission-request/index.js";
import type { NormalizedMessage, NormalizedPermissionRequest, NormalizedToolCall } from "@acp/chat-core";
import type { MessageAction } from "../actions/types.js";
import type { ReactNode } from "react";

export interface ThreadItemRendererProps {
  item: ThreadItem;
  messageActions?: MessageAction[] | undefined;
  renderThoughtClosed?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
  renderThoughtOpen?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
  onPermissionRespond?: (requestId: number, optionId: string) => void;
  toolCalls?: Map<string, NormalizedToolCall> | undefined;
}

function isThoughtGroup(data: NormalizedMessage | ThoughtGroupWithState | NormalizedPermissionRequest): data is ThoughtGroupWithState {
  return "items" in data && "startTime" in data;
}

export const ThreadItemRenderer = memo(function ThreadItemRenderer({
  item,
  messageActions,
  renderThoughtClosed,
  renderThoughtOpen,
  onPermissionRespond,
  toolCalls,
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
      case "permission_request": {
        const request = item.data as NormalizedPermissionRequest;
        const toolCall = toolCalls?.get(request.toolCallId);
        return (
          <PermissionRequestCard
            request={request}
            toolCall={toolCall}
            onRespond={(optionId) => {
              onPermissionRespond?.(request.requestId, optionId);
            }}
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
  }, [item, messageActions, renderThoughtClosed, renderThoughtOpen, onPermissionRespond, toolCalls]);

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
