import { useMemo, memo, useCallback } from "react";
import { VirtualizedThread } from "./VirtualizedThread.js";
import { ThreadItemRenderer } from "./ThreadItemRenderer.js";
import { useTimelineItems, useIsConnected, useActiveStreamingMessage } from "../hooks/index.js";
import type { AcpStore } from "../store/index.js";
import type { ThreadItem } from "./types.js";
import type { ThoughtGroupWithState, ThoughtStackRenderContext } from "../thought/types.js";
import { isThoughtGroupActive } from "@acp/chat-core";
import type { NormalizedMessage } from "@acp/chat-core";
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
}: ThreadProps) {
  const timelineItems = useTimelineItems(store);
  const isConnected = useIsConnected(store);
  const streamingMessage = useActiveStreamingMessage(store);
  const isAgentTyping = !!streamingMessage;

  const threadItems: ThreadItem[] = useMemo(() => {
    const result: ThreadItem[] = [];
    let currentThoughtGroup: ThoughtGroupWithState | null = null;

    for (const item of timelineItems) {
      if (item.type === "thought" || item.type === "tool_call") {
        if (!currentThoughtGroup) {
          currentThoughtGroup = {
            id: `thought-group-${result.length}`,
            items: [],
            startTime: item.data.createdAt ?? Date.now(),
            endTime: item.data.createdAt ?? Date.now(),
            isActive: false,
          };
        }
        currentThoughtGroup.items.push({
          type: item.type,
          id: item.id,
          data: item.data,
        });
        if (item.data.createdAt) {
          currentThoughtGroup.endTime = item.data.createdAt;
        }
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
          {...(messageActions ? { messageActions } : {})}
          {...(renderThoughtClosed ? { renderThoughtClosed } : {})}
          {...(renderThoughtOpen ? { renderThoughtOpen } : {})}
        />
      );
    },
    [messageActions, renderThoughtClosed, renderThoughtOpen]
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
