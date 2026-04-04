import type { TimelineItem, NormalizedThought, NormalizedToolCall } from "../normalization/index.js";

export interface ThoughtItem {
  type: "thought" | "tool_call";
  id: string;
  data: NormalizedThought | NormalizedToolCall;
}

export interface ThoughtGroup {
  id: string;
  items: ThoughtItem[];
  startTime: number;
  endTime: number;
}

export type GroupedTimelineItem =
  | { type: "message"; id: string; data: Extract<TimelineItem, { type: "message" }>["data"] }
  | { type: "thought_group"; id: string; data: ThoughtGroup };

export function groupThoughtItems(timeline: TimelineItem[]): ThoughtGroup[] {
  const groups: ThoughtGroup[] = [];
  let currentGroup: ThoughtGroup | null = null;

  for (const item of timeline) {
    if (item.type === "thought" || item.type === "tool_call") {
      if (!currentGroup) {
        currentGroup = {
          id: `thought-group-${groups.length}`,
          items: [],
          startTime: item.data.createdAt ?? Date.now(),
          endTime: item.data.createdAt ?? Date.now(),
        };
      }
      currentGroup.items.push(item as ThoughtItem);
      if (item.data.createdAt) {
        currentGroup.endTime = item.data.createdAt;
      }
    } else {
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      }
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export function createGroupedTimeline(timeline: TimelineItem[]): GroupedTimelineItem[] {
  const result: GroupedTimelineItem[] = [];
  let currentGroup: ThoughtGroup | null = null;

  for (const item of timeline) {
    if (item.type === "thought" || item.type === "tool_call") {
      if (!currentGroup) {
        currentGroup = {
          id: `thought-group-${result.length}`,
          items: [],
          startTime: item.data.createdAt ?? Date.now(),
          endTime: item.data.createdAt ?? Date.now(),
        };
      }
      currentGroup.items.push(item as ThoughtItem);
      if (item.data.createdAt) {
        currentGroup.endTime = item.data.createdAt;
      }
    } else if (item.type === "message") {
      if (currentGroup) {
        result.push({ type: "thought_group", id: currentGroup.id, data: currentGroup });
        currentGroup = null;
      }
      result.push({ type: "message", id: item.id as string, data: item.data as Extract<TimelineItem, { type: "message" }>["data"] });
    }
  }

  if (currentGroup) {
    result.push({ type: "thought_group", id: currentGroup.id, data: currentGroup });
  }

  return result;
}

export function isThoughtGroupActive(
  groups: ThoughtGroup[],
  isAgentTyping: boolean
): boolean {
  if (groups.length === 0) return false;
  const lastGroup = groups[groups.length - 1];
  if (!lastGroup) return false;
  const lastItem = lastGroup.items[lastGroup.items.length - 1];
  if (!lastItem) return false;

  const lastItemTime = lastItem.data.createdAt ?? 0;
  const now = Date.now();
  const isRecent = now - lastItemTime < 5000;

  return isAgentTyping || isRecent;
}

export function shouldThoughtGroupBeOpen(
  isActive: boolean,
  wasActive: boolean,
  hasBeenActive: boolean,
  defaultOpen: boolean,
  defaultOpenWhenActive: boolean,
  defaultOpenWhenIdle: boolean
): boolean {
  if (isActive) {
    return defaultOpenWhenActive;
  }
  if (hasBeenActive && wasActive) {
    return defaultOpenWhenIdle;
  }
  return defaultOpen;
}