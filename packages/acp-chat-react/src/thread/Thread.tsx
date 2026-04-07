import { useMemo, memo, useCallback } from "react";
import { VirtualizedThread } from "./VirtualizedThread.js";
import { ThreadItemRenderer } from "./ThreadItemRenderer.js";
import { useTimelineItems, useIsConnected, useActiveStreamingMessage, useToolCalls } from "../hooks/index.js";
import type { AcpStore } from "../store/index.js";
import type { ThreadItem } from "./types.js";
import type { ThoughtGroupWithState, ThoughtStackRenderContext } from "../thought/types.js";
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
  /** Controlled expansion: set of item IDs that should be expanded */
  expandedItems?: Set<string> | undefined;
  /** Callback when expansion state changes */
  onExpansionChange?: (expandedItems: Set<string>) => void;
  /** Callback when a thought item is created */
  onThoughtCreated?: (thoughtId: string, groupId: string) => void;
  /** Callback when a thought item is completed */
  onThoughtCompleted?: (thoughtId: string, groupId: string) => void;
  /** Callback when a tool call item is created */
  onToolCreated?: (toolId: string, groupId: string) => void;
  /** Callback when a tool call item is completed */
  onToolCompleted?: (toolId: string, groupId: string) => void;
  /** Callback when the entire thought group is completed */
  onThoughtGroupCompleted?: (groupId: string) => void;
  /** Auto-follow: auto-open thought stack and auto-expand items while active. Defaults to false. */
  follow?: boolean | undefined;
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
  expandedItems,
  onExpansionChange,
  onThoughtCreated,
  onThoughtCompleted,
  onToolCreated,
  onToolCompleted,
  onThoughtGroupCompleted,
  follow,
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
    let hasSeenMessage = false; // Track if we've passed a message

    const pendingPermissionToolCallIds = new Set<string>();
    for (const item of timelineItems) {
      if (item.type === "permission_request") {
        const req = item.data as NormalizedPermissionRequest;
        if (req.status === "pending") {
          pendingPermissionToolCallIds.add(req.toolCallId);
        }
      }
    }

    // Build thought groups and messages
    for (const item of timelineItems) {
      if (item.type === "thought") {
        const thought = item.data as NormalizedThought;
        // Start new group if we've seen a message or no group exists
        if (hasSeenMessage || !currentThoughtGroup) {
          currentThoughtGroup = {
            id: `thought-group-${result.filter(r => r.type === 'thought_group').length}`,
            items: [],
            startTime: thought.createdAt ?? Date.now(),
            endTime: thought.createdAt ?? Date.now(),
            isActive: false,
          };
          hasSeenMessage = false; // Reset for new group
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
        // Start new group if we've seen a message or no group exists
        if (hasSeenMessage || !currentThoughtGroup) {
          currentThoughtGroup = {
            id: `thought-group-${result.filter(r => r.type === 'thought_group').length}`,
            items: [],
            startTime: toolCall.createdAt ?? Date.now(),
            endTime: toolCall.createdAt ?? Date.now(),
            isActive: false,
          };
          hasSeenMessage = false; // Reset for new group
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
      } else if (item.type === "message") {
        if (currentThoughtGroup) {
          result.push({
            type: "thought_group",
            id: currentThoughtGroup.id,
            data: currentThoughtGroup,
          });
          currentThoughtGroup = null;
        }
        hasSeenMessage = true; // Mark that we've seen a message
        result.push({
          type: "message",
          id: item.id,
          data: item.data as NormalizedMessage,
        });
      }
    }

    // Final group - always inactive (active state detected by ThoughtStack via events)
    if (currentThoughtGroup) {
      result.push({
        type: "thought_group",
        id: currentThoughtGroup.id,
        data: currentThoughtGroup,
      });
    }

    return result;
  }, [timelineItems]);

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
          {...(expandedItems !== undefined ? { expandedItems } : {})}
          {...(onExpansionChange !== undefined ? { onExpansionChange } : {})}
          {...(onThoughtCreated !== undefined ? { onThoughtCreated } : {})}
          {...(onThoughtCompleted !== undefined ? { onThoughtCompleted } : {})}
          {...(onToolCreated !== undefined ? { onToolCreated } : {})}
          {...(onToolCompleted !== undefined ? { onToolCompleted } : {})}
          {...(onThoughtGroupCompleted !== undefined ? { onThoughtGroupCompleted } : {})}
          {...(follow !== undefined ? { follow } : {})}
        />
      );
    },
    [messageActions, renderThoughtClosed, renderThoughtOpen, onPermissionRespond, toolCalls, expandedItems, onExpansionChange, onThoughtCreated, onThoughtCompleted, onToolCreated, onToolCompleted, onThoughtGroupCompleted, follow]
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
