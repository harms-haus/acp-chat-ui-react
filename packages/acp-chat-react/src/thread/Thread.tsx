import { useMemo, memo, useCallback } from "react";
import { VirtualizedThread } from "./VirtualizedThread.js";
import { ThreadItemRenderer } from "./ThreadItemRenderer.js";
import { useTimelineItems, useIsConnected } from "../hooks/index.js";
import type { AcpStore } from "../store/index.js";
import type { ThreadItem } from "./types.js";

interface ThreadProps {
  store: AcpStore;
  className?: string;
  layout?: "centered" | "expanded";
  followScroll?: boolean;
  scrollThreshold?: number;
  emptyState?: React.ReactNode;
  estimatedRowHeight?: number;
  rowGap?: number;
  padding?: number;
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
}: ThreadProps) {
  const timelineItems = useTimelineItems(store);
  const isConnected = useIsConnected(store);

  const threadItems: ThreadItem[] = useMemo(() => {
    return timelineItems.map((item) => ({
      type: item.type,
      id: item.id,
      data: item.data,
    }));
  }, [timelineItems]);

  const renderItem = useCallback(
    (item: ThreadItem) => {
      return <MemoizedThreadItemRenderer item={item} />;
    },
    []
  );

  const defaultEmptyState = useMemo(
    () => (
      <div style={{ textAlign: "center", color: "var(--acp-color-muted, #666)" }}>
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
