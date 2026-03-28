import type { ReactNode, RefObject } from "react";
import type { NormalizedMessage, NormalizedThought, NormalizedToolCall } from "@acp/chat-core";

/**
 * Item types in the thread timeline
 */
export type ThreadItemType = "message" | "thought" | "tool_call";

/**
 * A thread item represents any renderable entity in the thread
 */
export interface ThreadItem {
  type: ThreadItemType;
  id: string;
  data: NormalizedMessage | NormalizedThought | NormalizedToolCall;
}

/**
 * Props for the VirtualizedThread component
 */
export interface VirtualizedThreadProps {
  /** Array of thread items to render */
  items: ThreadItem[];
  /** Render function for each item - MUST be memoized by caller */
  renderItem: (item: ThreadItem, index: number) => ReactNode;
  /** Optional CSS class for the thread container */
  className?: string | undefined;
  /** Layout mode - centered (max-width) or expanded (full width) */
  layout?: "centered" | "expanded" | undefined;
  /** Whether to automatically scroll to bottom on new items */
  followScroll?: boolean | undefined;
  /** Distance from bottom (in px) to consider "at bottom" for follow-scroll */
  scrollThreshold?: number | undefined;
  /** Empty state content when no items */
  emptyState?: ReactNode | undefined;
  /** Ref to access imperative thread methods */
  ref?: RefObject<VirtualizedThreadRef | null> | undefined;
  /** Estimated height for each row (used before measurement) */
  estimatedRowHeight?: number | undefined;
  /** Gap between rows in pixels */
  rowGap?: number | undefined;
  /** Padding at top and bottom of the list */
  padding?: number | undefined;
}

/**
 * Imperative ref methods for VirtualizedThread
 */
export interface VirtualizedThreadRef {
  /** Scroll to the bottom of the thread */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Scroll to a specific item by ID */
  scrollToItem: (id: string, behavior?: ScrollBehavior) => void;
  /** Get the current scroll viewport element */
  getViewport: () => HTMLElement | null;
  /** Check if currently near the bottom */
  isNearBottom: () => boolean;
  /** Programmatically enable/disable follow scroll */
  setFollowScroll: (enabled: boolean) => void;
}

/**
 * State for tracking scroll position and follow behavior
 */
export interface ScrollState {
  /** Whether the user is currently near the bottom */
  isNearBottom: boolean;
  /** Whether the user has intentionally scrolled away from bottom */
  userScrolledAway: boolean;
  /** Current scroll position */
  scrollTop: number;
  /** Total scrollable height */
  scrollHeight: number;
  /** Visible viewport height */
  clientHeight: number;
}

/**
 * Props for individual row items in the virtualized list
 */
export interface ThreadRowProps {
  /** The item to render */
  item: ThreadItem;
  /** Index in the virtualized list */
  index: number;
  /** Style to apply for positioning */
  style: React.CSSProperties;
  /** Render function for the item content */
  renderItem: (item: ThreadItem, index: number) => ReactNode;
  /** Measure ref for dynamic sizing */
  measureRef: (el: HTMLElement | null) => void;
}

/**
 * Configuration for the virtualized list
 */
export interface VirtualizationConfig {
  /** Overscan count - how many items to render outside viewport */
  overscan: number;
  /** Whether to use dynamic row measurement */
  dynamicMeasurement: boolean;
  /** Estimated row height before measurement */
  estimatedRowHeight: number;
  /** Gap between rows */
  gap: number;
  /** Scroll padding */
  padding: number;
}

/**
 * Default virtualization configuration
 */
export const DEFAULT_VIRTUALIZATION_CONFIG: VirtualizationConfig = {
  overscan: 5,
  dynamicMeasurement: true,
  estimatedRowHeight: 80,
  gap: 8,
  padding: 16,
};
