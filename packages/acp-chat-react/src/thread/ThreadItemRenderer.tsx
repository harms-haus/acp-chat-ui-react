import { memo, useMemo } from "react";
import type { ThreadItem } from "./types.js";
import type { ThoughtGroupWithState, ThoughtStackRenderContext, ThoughtStackProps } from "../thought/types.js";
import { MessageCard } from "../message/MessageCard.js";
import { ThoughtStack } from "../thought/ThoughtStack.js";
import { PermissionRequestCard } from "../permission-request/index.js";
import type { NormalizedMessage, NormalizedPermissionRequest, NormalizedToolCall, SessionController } from "@harms-haus/acp-chat-core";
import type { MessageAction } from "../actions/types.js";
import type { ReactNode } from "react";

export interface ThreadItemRendererProps {
  item: ThreadItem;
  messageActions?: MessageAction[] | undefined;
  renderThoughtClosed?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
  renderThoughtOpen?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
  onPermissionRespond?: (requestId: number, optionId: string) => void;
  toolCalls?: Map<string, NormalizedToolCall> | undefined;
  messageAppearedAfter?: boolean | undefined;
  expandedItems?: Set<string> | undefined;
  onExpansionChange?: (expandedItems: Set<string>) => void;
  onThoughtCreated?: (thoughtId: string, groupId: string) => void;
  onThoughtCompleted?: (thoughtId: string, groupId: string) => void;
  onToolCreated?: (toolId: string, groupId: string) => void;
  onToolCompleted?: (toolId: string, groupId: string) => void;
  onThoughtGroupCompleted?: (groupId: string) => void;
  follow?: boolean | undefined;
  controller?: SessionController | undefined;
}

export const ThreadItemRenderer = memo(function ThreadItemRenderer({
  item,
  messageActions,
  renderThoughtClosed,
  renderThoughtOpen,
  onPermissionRespond,
  toolCalls,
  messageAppearedAfter,
  expandedItems,
  onExpansionChange,
  onThoughtCreated,
  onThoughtCompleted,
  onToolCreated,
  onToolCompleted,
  onThoughtGroupCompleted,
  follow,
  controller,
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
        const thoughtStackProps: ThoughtStackProps = {
          group,
        };

        // Conditionally add optional props to avoid exactOptionalPropertyTypes error
        if (renderThoughtClosed !== undefined) {
          thoughtStackProps.renderClosed = renderThoughtClosed;
        }
        if (renderThoughtOpen !== undefined) {
          thoughtStackProps.renderOpen = renderThoughtOpen;
        }
        if (expandedItems !== undefined) {
          thoughtStackProps.expandedItems = expandedItems;
        }
        if (onExpansionChange !== undefined) {
          thoughtStackProps.onExpansionChange = onExpansionChange;
        }
        if (onThoughtCreated !== undefined) {
          thoughtStackProps.onThoughtCreated = onThoughtCreated;
        }
        if (onThoughtCompleted !== undefined) {
          thoughtStackProps.onThoughtCompleted = onThoughtCompleted;
        }
        if (onToolCreated !== undefined) {
          thoughtStackProps.onToolCreated = onToolCreated;
        }
        if (onToolCompleted !== undefined) {
          thoughtStackProps.onToolCompleted = onToolCompleted;
        }
        if (onThoughtGroupCompleted !== undefined) {
          thoughtStackProps.onThoughtGroupCompleted = onThoughtGroupCompleted;
        }
        if (follow !== undefined) {
          thoughtStackProps.follow = follow;
        }
        if (controller !== undefined) {
          thoughtStackProps.controller = controller;
        }
        if (messageAppearedAfter !== undefined) {
          thoughtStackProps.messageAppearedAfter = messageAppearedAfter;
        }

        return <ThoughtStack {...thoughtStackProps} />;
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
  }, [item, messageActions, renderThoughtClosed, renderThoughtOpen, onPermissionRespond, toolCalls, messageAppearedAfter, expandedItems, onExpansionChange, onThoughtCreated, onThoughtCompleted, onToolCreated, onToolCompleted, onThoughtGroupCompleted, follow, controller]);

  return (
    <div
      className="acp-thread__item"
      data-acp-thread-item
      data-testid="acp-thread-item"
      data-acp-thread-item-type={item.type}
      data-acp-thread-item-id={item.id}
    >
      {rendered}
    </div>
  );
});

ThreadItemRenderer.displayName = "ThreadItemRenderer";
