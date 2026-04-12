import {
  forwardRef,
  useRef,
  useCallback,
  useState,
  useEffect,
  useImperativeHandle,
  memo,
  useMemo,
} from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type {
  VirtualizedThreadProps,
  VirtualizedThreadRef,
  ThreadItem,
  ScrollState,
} from "./types.js";
import { DEFAULT_VIRTUALIZATION_CONFIG } from "./types.js";
import { createPretextEstimator } from "./pretext-estimator.js";
import { DEFAULT_HEIGHT_ESTIMATOR_CONFIG } from "../types/height-estimator.js";
import type {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ViewportObserverFactory,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Scheduler,
} from "../types/browser-apis.js";
import {
  createViewportObserverFactory,
  defaultScheduler,
} from "../utils/browser-apis.js";

interface ThreadRowProps {
  virtualItem: VirtualItem;
  item: ThreadItem;
  renderItem: (item: ThreadItem, index: number, allItems: ThreadItem[]) => React.ReactNode;
  index: number;
  allItems: ThreadItem[];
  measureRef: (el: HTMLElement | null) => void;
}

const ThreadRow = memo(function ThreadRow({
  virtualItem,
  item,
  renderItem,
  index,
  allItems,
  measureRef,
}: ThreadRowProps) {
  return (
    <div
      ref={measureRef}
      data-index={index}
      data-acp-thread-row
      data-acp-message-id={item.id}
      data-acp-item-type={item.type}
      className="acp-thread__row"
      style={{
        transform: `translateY(${virtualItem.start}px)`,
        paddingBottom: 'var(--acp-thread-row-gap, 8px)',
      }}
    >
      {renderItem(item, index, allItems)}
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
      scrollBehavior = "smooth",
      emptyState,
      estimatedRowHeight = DEFAULT_VIRTUALIZATION_CONFIG.estimatedRowHeight,
      rowGap = DEFAULT_VIRTUALIZATION_CONFIG.gap,
      padding = DEFAULT_VIRTUALIZATION_CONFIG.padding,
      heightEstimator = createPretextEstimator(DEFAULT_HEIGHT_ESTIMATOR_CONFIG),
      onHeightRecalculated,
      onContainerResize,
      onContentChange,
      onScroll,
      onReachBottom,
      onItemsRendered,
      viewportObserverFactory,
      scheduler,
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
    const [containerWidth, setContainerWidth] = useState(600);
    const scrollRafRef = useRef<number | null>(null);
    const previousItemCountRef = useRef(items.length);
    const previousItemsRef = useRef<ThreadItem[]>(items);
    const [recalcTrigger, setRecalcTrigger] = useState(0);
    const _recalculateIdsRef = useRef<Set<string>>(new Set());

    const injectedViewportObserverFactory = viewportObserverFactory ?? createViewportObserverFactory();
    const injectedScheduler = scheduler ?? defaultScheduler;

    const itemHeights = useMemo(() => {
      const heights = new Map<string, number>();

      items.forEach((item) => {
        const height = heightEstimator.estimate(item, containerWidth, DEFAULT_HEIGHT_ESTIMATOR_CONFIG) as number;
        heights.set(item.id, height);
      });

      recalcTrigger;
      return heights;
    }, [items, containerWidth, heightEstimator, recalcTrigger]);

    useEffect(() => {
      onHeightRecalculated?.(new Map(itemHeights));
    }, [itemHeights, onHeightRecalculated]);

    useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const observer = injectedViewportObserverFactory.create((entries) => {
        for (const entry of entries) {
          const newWidth = entry.contentRect.width;
          setContainerWidth(newWidth);
          onContainerResize?.(newWidth);
        }
      });

      observer.observe(viewport);
      return () => observer.disconnect();
    }, [onContainerResize, injectedViewportObserverFactory]);

    const virtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => viewportRef.current,
      estimateSize: (index) => {
        const item = items[index];
        if (!item) return estimatedRowHeight;
        return itemHeights.get(item.id) ?? estimatedRowHeight;
      },
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
        injectedScheduler.cancelAnimationFrame(scrollRafRef.current);
      }

      scrollRafRef.current = injectedScheduler.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        checkScrollPosition();
        onScroll?.(scrollStateRef.current);
      });
    }, [checkScrollPosition, injectedScheduler, onScroll]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = scrollBehavior) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      });
    }, [scrollBehavior]);

    const scrollToItem = useCallback(
      (id: string, behavior: ScrollBehavior = scrollBehavior) => {
        const index = items.findIndex((item) => item.id === id);
        if (index === -1) return;

        virtualizer.scrollToIndex(index, { align: "start", behavior });
      },
      [items, virtualizer, scrollBehavior]
    );

    const getViewport = useCallback(() => viewportRef.current, []);

    const isNearBottom = useCallback(() => scrollStateRef.current.isNearBottom, []);

    const setFollowScroll = useCallback((enabled: boolean) => {
      setFollowScrollEnabled(enabled);
    }, []);

    const recalculateHeights = useCallback((_messageIds?: string[]) => {
      setRecalcTrigger((prev) => prev + 1);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        scrollToBottom,
        scrollToItem,
        getViewport,
        isNearBottom,
        setFollowScroll,
        recalculateHeights,
      }),
      [scrollToBottom, scrollToItem, getViewport, isNearBottom, setFollowScroll, recalculateHeights]
    );

    useEffect(() => {
      const currentItems = items;
      const previousItems = previousItemsRef.current;

      if (currentItems !== previousItems) {
        previousItemsRef.current = currentItems;

        const lastItem = currentItems[currentItems.length - 1];
        onContentChange?.(lastItem?.id ?? "");
      }
    }, [items, onContentChange]);

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

    const previousIsNearBottomRef = useRef(true);
    useEffect(() => {
      if (isNearBottomState && !previousIsNearBottomRef.current) {
        onReachBottom?.();
      }
      previousIsNearBottomRef.current = isNearBottomState;
    }, [isNearBottomState, onReachBottom]);

    useEffect(() => {
      onItemsRendered?.(virtualItems.length);
    }, [virtualItems.length, onItemsRendered]);

    useEffect(() => {
      return () => {
        if (scrollRafRef.current !== null) {
          injectedScheduler.cancelAnimationFrame(scrollRafRef.current);
        }
      };
    }, [injectedScheduler]);

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
          {emptyState ?? <span className="acp-thread__empty-text">No messages yet</span>}
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
      >
      <div
        ref={parentRef}
        data-acp-thread-scroll-content
        className="acp-thread__content"
        style={{
          height: `${totalSize}px`,
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
                allItems={items}
                measureRef={virtualizer.measureElement}
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
        <span className="acp-thread__scroll-indicator-text">New messages</span>
        <svg
          className="acp-thread__scroll-indicator-icon"
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
