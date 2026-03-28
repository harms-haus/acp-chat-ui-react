import {
  forwardRef,
  useRef,
  useCallback,
  useState,
  useEffect,
  useImperativeHandle,
  memo,
} from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type {
  VirtualizedThreadProps,
  VirtualizedThreadRef,
  ThreadItem,
  ScrollState,
} from "./types.js";
import { DEFAULT_VIRTUALIZATION_CONFIG } from "./types.js";

interface ThreadRowProps {
  virtualItem: VirtualItem;
  item: ThreadItem;
  renderItem: (item: ThreadItem, index: number) => React.ReactNode;
  index: number;
}

const ThreadRow = memo(function ThreadRow({
  virtualItem,
  item,
  renderItem,
  index,
}: ThreadRowProps) {
  return (
    <div
      data-acp-thread-row
      data-acp-message-id={item.id}
      data-acp-item-type={item.type}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualItem.start}px)`,
        paddingBottom: DEFAULT_VIRTUALIZATION_CONFIG.gap,
        boxSizing: "border-box",
      }}
    >
      {renderItem(item, index)}
    </div>
  );
});

export const VirtualizedThread = forwardRef<VirtualizedThreadRef, VirtualizedThreadProps>(
  function VirtualizedThread(
    {
      items,
      renderItem,
      className = "",
      layout = "centered",
      followScroll = true,
      scrollThreshold = 100,
      emptyState,
      estimatedRowHeight = DEFAULT_VIRTUALIZATION_CONFIG.estimatedRowHeight,
      rowGap = DEFAULT_VIRTUALIZATION_CONFIG.gap,
      padding = DEFAULT_VIRTUALIZATION_CONFIG.padding,
    },
    ref
  ) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const scrollStateRef = useRef<ScrollState>({
      isNearBottom: true,
      userScrolledAway: false,
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
    });
    const [followScrollEnabled, setFollowScrollEnabled] = useState(followScroll);
    const [isNearBottomState, setIsNearBottomState] = useState(true);
    const scrollRafRef = useRef<number | null>(null);
    const previousItemCountRef = useRef(items.length);

    const virtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => viewportRef.current,
      estimateSize: () => estimatedRowHeight,
      overscan: DEFAULT_VIRTUALIZATION_CONFIG.overscan,
      measureElement: (el) => el.getBoundingClientRect().height,
      getItemKey: (index) => items[index]?.id ?? `fallback-${index}`,
      gap: rowGap,
      paddingStart: padding,
      paddingEnd: padding,
    });

    const virtualItems = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();

    const checkScrollPosition = useCallback(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom < scrollThreshold;

      scrollStateRef.current = {
        isNearBottom,
        userScrolledAway: scrollStateRef.current.userScrolledAway,
        scrollTop,
        scrollHeight,
        clientHeight,
      };

      setIsNearBottomState(isNearBottom);

      if (!isNearBottom) {
        scrollStateRef.current.userScrolledAway = true;
      } else if (isNearBottom && scrollStateRef.current.userScrolledAway) {
        scrollStateRef.current.userScrolledAway = false;
      }
    }, [scrollThreshold]);

    const handleScroll = useCallback(() => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }

      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        checkScrollPosition();
      });
    }, [checkScrollPosition]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      });
    }, []);

    const scrollToItem = useCallback(
      (id: string, behavior: ScrollBehavior = "smooth") => {
        const index = items.findIndex((item) => item.id === id);
        if (index === -1) return;

        virtualizer.scrollToIndex(index, { align: "start", behavior });
      },
      [items, virtualizer]
    );

    const getViewport = useCallback(() => viewportRef.current, []);

    const isNearBottom = useCallback(() => scrollStateRef.current.isNearBottom, []);

    const setFollowScroll = useCallback((enabled: boolean) => {
      setFollowScrollEnabled(enabled);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        scrollToBottom,
        scrollToItem,
        getViewport,
        isNearBottom,
        setFollowScroll,
      }),
      [scrollToBottom, scrollToItem, getViewport, isNearBottom, setFollowScroll]
    );

    useEffect(() => {
      const currentItemCount = items.length;
      const previousItemCount = previousItemCountRef.current;

      if (currentItemCount > previousItemCount && followScrollEnabled) {
        const { userScrolledAway } = scrollStateRef.current;
        if (!userScrolledAway) {
          scrollToBottom("auto");
        }
      }

      previousItemCountRef.current = currentItemCount;
    }, [items.length, followScrollEnabled, scrollToBottom]);

    useEffect(() => {
      return () => {
        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
        }
      };
    }, []);

    const layoutClass = layout === "centered" ? "acp-thread--centered" : "acp-thread--expanded";

    if (items.length === 0) {
      return (
        <div
          data-acp-thread
          data-acp-thread-empty
          className={`acp-thread ${layoutClass} ${className}`}
        >
          <div data-acp-thread-scroll-viewport className="acp-thread__viewport">
            <div className="acp-thread__empty">
              {emptyState ?? <span>No messages yet</span>}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        data-acp-thread
        data-acp-thread-populated
        className={`acp-thread ${layoutClass} ${className}`}
      >
        <div
          ref={viewportRef}
          data-acp-thread-scroll-viewport
          className="acp-thread__viewport"
          onScroll={handleScroll}
          style={{
            overflow: "auto",
            height: "100%",
            position: "relative",
          }}
        >
          <div
            ref={parentRef}
            data-acp-thread-scroll-content
            style={{
              height: `${totalSize}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualItem) => {
              const item = items[virtualItem.index];
              if (!item) return null;

              return (
                <ThreadRow
                  key={virtualItem.key}
                  virtualItem={virtualItem}
                  item={item}
                  renderItem={renderItem}
                  index={virtualItem.index}
                />
              );
            })}
          </div>
        </div>

        {followScrollEnabled && !isNearBottomState && items.length > 0 && (
          <button
            type="button"
            data-acp-thread-scroll-indicator
            onClick={() => {
              scrollStateRef.current.userScrolledAway = false;
              scrollToBottom("smooth");
            }}
            aria-label="Scroll to newest messages"
            className="acp-thread__scroll-indicator"
          >
            <span>New messages</span>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

VirtualizedThread.displayName = "VirtualizedThread";
