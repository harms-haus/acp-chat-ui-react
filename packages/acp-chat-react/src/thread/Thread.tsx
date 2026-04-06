import { useMemo, memo, useCallback } from "react";
import { VirtualizedThread } from "./VirtualizedThread.js";
import { ThreadItemRenderer } from "./ThreadItemRenderer.js";
import { useTimelineItems, useIsConnected, useActiveStreamingMessage, useToolCalls } from "../hooks/index.js";
import type { AcpStore } from "../store/index.js";
import type { ThreadItem } from "./types.js";
import type { ThoughtGroupWithState, ThoughtStackRenderContext } from "../thought/types.js";
import { isThoughtGroupActive } from "@acp/chat-core";
import type { NormalizedMessage, NormalizedPermissionRequest, NormalizedThought, NormalizedToolCall } from "@acp/chat-core";
import type { MessageAction } from "../actions/types.js";
import type { ReactNode } from "react";

export interface ThreadProps {
  store: AcpStore;
  className?: string;
  layout?: "centered" | "expanded";
  followScroll?: boolean;
  scrollThreshold?: number;
  emptyState?: React.ReactNode;
  estimatedRowHeight?: number;
  rowGap?: number;
  padding?: number;
  messageActions?: MessageAction[] | undefined;
  renderThoughtClosed?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
  renderThoughtOpen?: ((context: ThoughtStackRenderContext) => ReactNode) | undefined;
  onPermissionRespond?: (requestId: number, optionId: string) => void;
}

const MemoizedThreadItemRenderer = memo(ThreadItemRenderer);

export function Thread({
  store,
  className,
  layout = "centered",
  followScroll = true,
  scrollThreshold = 100,
  emptyState,
  estimatedRowHeight,
  rowGap,
  padding,
  messageActions,
  renderThoughtClosed,
  renderThoughtOpen,
  onPermissionRespond,
}: ThreadProps) {
  const timelineItems = useTimelineItems(store);
  const isConnected = useIsConnected(store);
  const streamingMessage = useActiveStreamingMessage(store);
  const isAgentTyping = !!streamingMessage;
  const toolCallsArray = useToolCalls(store);
  const toolCalls = useMemo(() => {
    return new Map(toolCallsArray.map(call => [call.toolCallId, call]));
  }, [toolCallsArray]);

  const threadItems: ThreadItem[] = useMemo(() => {
    const result: ThreadItem[] = [];
    let currentThoughtGroup: ThoughtGroupWithState | null = null;

    const pendingPermissionToolCallIds = new Set<string>();
    for (const item of timelineItems) {
      if (item.type === "permission_request") {
        const req = item.data as NormalizedPermissionRequest;
        if (req.status === "pending") {
          pendingPermissionToolCallIds.add(req.toolCallId);
        }
      }
    }

    for (const item of timelineItems) {
      if (item.type === "thought") {
        const thought = item.data as NormalizedThought;
        if (!currentThoughtGroup) {
          currentThoughtGroup = {
            id: `thought-group-${result.length}`,
            items: [],
            startTime: thought.createdAt ?? Date.now(),
            endTime: thought.createdAt ?? Date.now(),
            isActive: false,
          };
        }
        currentThoughtGroup.items.push({
          type: item.type,
          id: item.id,
          data: thought,
        });
        if (thought.createdAt) {
          currentThoughtGroup.endTime = thought.createdAt;
        }
      } else if (item.type === "tool_call") {
        const toolCall = item.data as NormalizedToolCall;
        if (pendingPermissionToolCallIds.has(toolCall.toolCallId)) {
          continue;
        }
        if (!currentThoughtGroup) {
          currentThoughtGroup = {
            id: `thought-group-${result.length}`,
            items: [],
            startTime: toolCall.createdAt ?? Date.now(),
            endTime: toolCall.createdAt ?? Date.now(),
            isActive: false,
          };
        }
        currentThoughtGroup.items.push({
          type: item.type,
          id: item.id,
          data: toolCall,
        });
        if (toolCall.createdAt) {
          currentThoughtGroup.endTime = toolCall.createdAt;
        }
      } else if (item.type === "permission_request") {
        const req = item.data as NormalizedPermissionRequest;
        // Only show permission requests that are still pending
        if (req.status !== "pending") {
          continue;
        }
        if (currentThoughtGroup) {
          const isActive = isThoughtGroupActive([currentThoughtGroup], isAgentTyping);
          currentThoughtGroup.isActive = isActive;
          result.push({
            type: "thought_group",
            id: currentThoughtGroup.id,
            data: currentThoughtGroup,
          });
          currentThoughtGroup = null;
        }
        result.push({
          type: "permission_request",
          id: item.id,
          data: item.data as NormalizedPermissionRequest,
        });
      } else {
        if (currentThoughtGroup) {
          const isActive = isThoughtGroupActive([currentThoughtGroup], isAgentTyping);
          currentThoughtGroup.isActive = isActive;
          result.push({
            type: "thought_group",
            id: currentThoughtGroup.id,
            data: currentThoughtGroup,
          });
          currentThoughtGroup = null;
        }
        result.push({
          type: "message",
          id: item.id,
          data: item.data as NormalizedMessage,
        });
      }
    }

    if (currentThoughtGroup) {
      const isActive = isThoughtGroupActive([currentThoughtGroup], isAgentTyping);
      currentThoughtGroup.isActive = isActive;
      result.push({
        type: "thought_group",
        id: currentThoughtGroup.id,
        data: currentThoughtGroup,
      });
    }

    return result;
  }, [timelineItems, isAgentTyping]);

  const renderItem = useCallback(
    (item: ThreadItem) => {
      return (
        <MemoizedThreadItemRenderer
          item={item}
          toolCalls={toolCalls}
          {...(messageActions ? { messageActions } : {})}
          {...(renderThoughtClosed ? { renderThoughtClosed } : {})}
          {...(renderThoughtOpen ? { renderThoughtOpen } : {})}
          {...(onPermissionRespond ? { onPermissionRespond } : {})}
        />
      );
    },
    [messageActions, renderThoughtClosed, renderThoughtOpen, onPermissionRespond, toolCalls]
  );

  const defaultEmptyState = useMemo(
    () => (
      <div className="acp-thread__empty-text">
        {isConnected ? "No messages yet - waiting for session updates..." : "Connect to a session to view messages"}
      </div>
    ),
    [isConnected]
  );

  return (
    <VirtualizedThread
      items={threadItems}
      renderItem={renderItem}
      className={className ?? ""}
      layout={layout}
      followScroll={followScroll}
      scrollThreshold={scrollThreshold}
      emptyState={emptyState ?? defaultEmptyState}
      estimatedRowHeight={estimatedRowHeight}
      rowGap={rowGap}
      padding={padding}
    />
  );
}
