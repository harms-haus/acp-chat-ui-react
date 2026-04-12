import { describe, expect, it } from "vitest";
import {
  groupThoughtItems,
  createGroupedTimeline,
  isThoughtGroupActive,
  shouldThoughtGroupBeOpen,
  type ThoughtGroup,
} from "./thought-stack-logic.js";
import type { TimelineItem, NormalizedThought, NormalizedToolCall, NormalizedMessage } from "../normalization/index.js";

/**
 * Thought-stack logic tests.
 * 
 * Tests all pure functions for:
 * - Thought grouping algorithms (groupThoughtItems, createGroupedTimeline)
 * - Active group detection (isThoughtGroupActive)
 * - Group visibility logic (shouldThoughtGroupBeOpen)
 * - Edge cases (empty thoughts, single thought, many thoughts)
 */

// Helper functions to create test data
function createThought(id: string, content: string, createdAt?: number): NormalizedThought {
  return {
    id,
    content,
    createdAt: createdAt ?? Date.now(),
    updatedAt: createdAt ?? Date.now(),
  };
}

function createToolCall(id: string, title: string, createdAt?: number): NormalizedToolCall {
  return {
    toolCallId: id,
    kind: "read",
    title,
    createdAt: createdAt ?? Date.now(),
    updatedAt: createdAt ?? Date.now(),
  };
}

function createMessage(id: string, content: string, role: "user" | "agent" = "agent"): NormalizedMessage {
  return {
    id,
    role,
    status: "completed",
    content,
    contentBlocks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createTimelineItem(
  type: "thought" | "tool_call" | "message",
  id: string,
  data: NormalizedThought | NormalizedToolCall | NormalizedMessage
): TimelineItem {
  if (type === "thought") {
    return { type: "thought", id, data: data as NormalizedThought };
  } else if (type === "tool_call") {
    return { type: "tool_call", id, data: data as NormalizedToolCall };
  } else {
    return { type: "message", id, data: data as NormalizedMessage };
  }
}

describe("groupThoughtItems()", () => {
  describe("empty input", () => {
    it("returns empty array for empty timeline", () => {
      const result = groupThoughtItems([]);
      expect(result).toEqual([]);
    });
  });

  describe("single thought", () => {
    it("groups a single thought", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking...", now)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("thought-group-0");
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0].type).toBe("thought");
      expect(result[0].items[0].id).toBe("t1");
      expect(result[0].startTime).toBe(now);
      expect(result[0].endTime).toBe(now);
    });
  });

  describe("single tool call", () => {
    it("groups a single tool call", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("tool_call", "call1", createToolCall("call1", "Reading file", now)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("thought-group-0");
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0].type).toBe("tool_call");
      expect(result[0].items[0].id).toBe("call1");
    });
  });

  describe("consecutive thoughts", () => {
    it("groups consecutive thoughts into one group", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking 1", now)),
        createTimelineItem("thought", "t2", createThought("t2", "thinking 2", now + 100)),
        createTimelineItem("thought", "t3", createThought("t3", "thinking 3", now + 200)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("thought-group-0");
      expect(result[0].items).toHaveLength(3);
      expect(result[0].startTime).toBe(now);
      expect(result[0].endTime).toBe(now + 200);
    });
  });

  describe("consecutive tool calls", () => {
    it("groups consecutive tool calls into one group", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("tool_call", "call1", createToolCall("call1", "Read", now)),
        createTimelineItem("tool_call", "call2", createToolCall("call2", "Search", now + 100)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(2);
    });
  });

  describe("mixed thoughts and tool calls", () => {
    it("groups mixed thoughts and tool calls together", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking", now)),
        createTimelineItem("tool_call", "call1", createToolCall("call1", "Read", now + 50)),
        createTimelineItem("thought", "t2", createThought("t2", "more thinking", now + 100)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(3);
      expect(result[0].items[0].type).toBe("thought");
      expect(result[0].items[1].type).toBe("tool_call");
      expect(result[0].items[2].type).toBe("thought");
    });
  });

  describe("multiple groups separated by messages", () => {
    it("creates separate groups for thoughts separated by messages", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking 1", now)),
        createTimelineItem("thought", "t2", createThought("t2", "thinking 2", now + 100)),
        createTimelineItem("message", "m1", createMessage("m1", "user message")),
        createTimelineItem("thought", "t3", createThought("t3", "thinking 3", now + 200)),
        createTimelineItem("thought", "t4", createThought("t4", "thinking 4", now + 300)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(2);
      expect(result[0].items).toHaveLength(2);
      expect(result[0].items[0].id).toBe("t1");
      expect(result[0].items[1].id).toBe("t2");
      expect(result[1].items).toHaveLength(2);
      expect(result[1].items[0].id).toBe("t3");
      expect(result[1].items[1].id).toBe("t4");
    });
  });

  describe("thoughts at end of timeline", () => {
    it("includes thought group at the end", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("message", "m1", createMessage("m1", "first message")),
        createTimelineItem("thought", "t1", createThought("t1", "thinking", now)),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(1);
    });
  });

  describe("thoughts without createdAt", () => {
    it("uses Date.now() as fallback for startTime and endTime", () => {
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", { ...createThought("t1", "thinking"), createdAt: undefined }),
      ];
      
      const beforeCall = Date.now();
      const result = groupThoughtItems(timeline);
      const afterCall = Date.now();
      
      expect(result[0].startTime).toBeGreaterThanOrEqual(beforeCall - 100);
      expect(result[0].startTime).toBeLessThanOrEqual(afterCall);
      expect(result[0].endTime).toBeGreaterThanOrEqual(beforeCall - 100);
      expect(result[0].endTime).toBeLessThanOrEqual(afterCall);
    });
  });

  describe("only messages no thoughts", () => {
    it("returns empty array when only messages present", () => {
      const timeline: TimelineItem[] = [
        createTimelineItem("message", "m1", createMessage("m1", "message 1")),
        createTimelineItem("message", "m2", createMessage("m2", "message 2")),
      ];
      
      const result = groupThoughtItems(timeline);
      
      expect(result).toEqual([]);
    });
  });
});

describe("createGroupedTimeline()", () => {
  describe("empty input", () => {
    it("returns empty array for empty timeline", () => {
      const result = createGroupedTimeline([]);
      expect(result).toEqual([]);
    });
  });

  describe("single message", () => {
    it("returns single message item", () => {
      const timeline: TimelineItem[] = [
        createTimelineItem("message", "m1", createMessage("m1", "hello")),
      ];
      
      const result = createGroupedTimeline(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("message");
      expect(result[0].id).toBe("m1");
    });
  });

  describe("single thought group", () => {
    it("returns single thought group item", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking", now)),
      ];
      
      const result = createGroupedTimeline(timeline);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("thought_group");
      expect(result[0].data.items).toHaveLength(1);
    });
  });

  describe("mixed timeline", () => {
    it("creates proper grouped timeline with messages and thought groups", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("message", "m1", createMessage("m1", "user message")),
        createTimelineItem("thought", "t1", createThought("t1", "thinking 1", now)),
        createTimelineItem("tool_call", "call1", createToolCall("call1", "Read", now + 50)),
        createTimelineItem("thought", "t2", createThought("t2", "thinking 2", now + 100)),
        createTimelineItem("message", "m2", createMessage("m2", "agent response")),
      ];
      
      const result = createGroupedTimeline(timeline);
      
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe("message");
      expect(result[0].id).toBe("m1");
      expect(result[1].type).toBe("thought_group");
      expect(result[1].data.items).toHaveLength(3);
      expect(result[2].type).toBe("message");
      expect(result[2].id).toBe("m2");
    });
  });

  describe("thought group at end", () => {
    it("includes thought group at the end of timeline", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("message", "m1", createMessage("m1", "message")),
        createTimelineItem("thought", "t1", createThought("t1", "thinking", now)),
      ];
      
      const result = createGroupedTimeline(timeline);
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("message");
      expect(result[1].type).toBe("thought_group");
    });
  });

  describe("thought group at start", () => {
    it("includes thought group at the start of timeline", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking", now)),
        createTimelineItem("message", "m1", createMessage("m1", "message")),
      ];
      
      const result = createGroupedTimeline(timeline);
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("thought_group");
      expect(result[1].type).toBe("message");
    });
  });

  describe("multiple separate thought groups", () => {
    it("creates multiple thought groups separated by messages", () => {
      const now = Date.now();
      const timeline: TimelineItem[] = [
        createTimelineItem("thought", "t1", createThought("t1", "thinking 1", now)),
        createTimelineItem("message", "m1", createMessage("m1", "message 1")),
        createTimelineItem("thought", "t2", createThought("t2", "thinking 2", now + 100)),
        createTimelineItem("tool_call", "call1", createToolCall("call1", "Read", now + 150)),
        createTimelineItem("message", "m2", createMessage("m2", "message 2")),
      ];
      
      const result = createGroupedTimeline(timeline);
      
      expect(result).toHaveLength(4);
      expect(result[0].type).toBe("thought_group");
      expect(result[0].data.items).toHaveLength(1);
      expect(result[1].type).toBe("message");
      expect(result[2].type).toBe("thought_group");
      expect(result[2].data.items).toHaveLength(2);
      expect(result[3].type).toBe("message");
    });
  });
});

describe("isThoughtGroupActive()", () => {
  describe("empty groups", () => {
    it("returns false for empty groups array", () => {
      expect(isThoughtGroupActive([], false)).toBe(false);
      expect(isThoughtGroupActive([], true)).toBe(false);
    });
  });

  describe("group with no items", () => {
    it("returns false for group with no items", () => {
      const emptyGroup: ThoughtGroup = {
        id: "group-1",
        items: [],
        startTime: Date.now(),
        endTime: Date.now(),
      };
      
      expect(isThoughtGroupActive([emptyGroup], false)).toBe(false);
    });
  });

  describe("recent thought group", () => {
    it("returns true for recent thought group (within 5 seconds)", () => {
      const now = Date.now();
      const recentGroup: ThoughtGroup = {
        id: "group-1",
        items: [
          {
            type: "thought",
            id: "t1",
            data: createThought("t1", "thinking", now),
          },
        ],
        startTime: now,
        endTime: now,
      };
      
      expect(isThoughtGroupActive([recentGroup], false)).toBe(true);
    });
  });

  describe("old thought group", () => {
    it("returns false for old thought group (older than 5 seconds) when not typing", () => {
      const oldTime = Date.now() - 10000; // 10 seconds ago
      const oldGroup: ThoughtGroup = {
        id: "group-1",
        items: [
          {
            type: "thought",
            id: "t1",
            data: createThought("t1", "thinking", oldTime),
          },
        ],
        startTime: oldTime,
        endTime: oldTime,
      };
      
      expect(isThoughtGroupActive([oldGroup], false)).toBe(false);
    });

    it("returns true for old thought group when agent is typing", () => {
      const oldTime = Date.now() - 10000; // 10 seconds ago
      const oldGroup: ThoughtGroup = {
        id: "group-1",
        items: [
          {
            type: "thought",
            id: "t1",
            data: createThought("t1", "thinking", oldTime),
          },
        ],
        startTime: oldTime,
        endTime: oldTime,
      };
      
      expect(isThoughtGroupActive([oldGroup], true)).toBe(true);
    });
  });

  describe("last group is checked", () => {
    it("checks the last group in the array", () => {
      const now = Date.now();
      const oldTime = Date.now() - 10000;
      
      const groups: ThoughtGroup[] = [
        {
          id: "group-1",
          items: [
            {
              type: "thought",
              id: "t1",
              data: createThought("t1", "old thinking", oldTime),
            },
          ],
          startTime: oldTime,
          endTime: oldTime,
        },
        {
          id: "group-2",
          items: [
            {
              type: "thought",
              id: "t2",
              data: createThought("t2", "recent thinking", now),
            },
          ],
          startTime: now,
          endTime: now,
        },
      ];
      
      expect(isThoughtGroupActive(groups, false)).toBe(true);
    });
  });

  describe("thought without createdAt", () => {
    it("returns false for thought without createdAt when not typing", () => {
      const group: ThoughtGroup = {
        id: "group-1",
        items: [
          {
            type: "thought",
            id: "t1",
            data: { ...createThought("t1", "thinking"), createdAt: undefined },
          },
        ],
        startTime: 0,
        endTime: 0,
      };
      
      expect(isThoughtGroupActive([group], false)).toBe(false);
    });

    it("returns true for thought without createdAt when typing", () => {
      const group: ThoughtGroup = {
        id: "group-1",
        items: [
          {
            type: "thought",
            id: "t1",
            data: { ...createThought("t1", "thinking"), createdAt: undefined },
          },
        ],
        startTime: 0,
        endTime: 0,
      };
      
      expect(isThoughtGroupActive([group], true)).toBe(true);
    });
  });
});

describe("shouldThoughtGroupBeOpen()", () => {
  describe("when group is currently active", () => {
    it("returns defaultOpenWhenActive when isActive is true", () => {
      expect(shouldThoughtGroupBeOpen(true, false, false, true, true, false)).toBe(true);
      expect(shouldThoughtGroupBeOpen(true, false, false, true, false, false)).toBe(false);
    });
  });

  describe("when group was recently active", () => {
    it("returns defaultOpenWhenIdle when hasBeenActive and wasActive are true", () => {
      expect(shouldThoughtGroupBeOpen(false, true, true, true, false, true)).toBe(true);
      expect(shouldThoughtGroupBeOpen(false, true, true, true, false, false)).toBe(false);
    });
  });

  describe("when group has never been active", () => {
    it("returns defaultOpen when isActive and wasActive are false", () => {
      expect(shouldThoughtGroupBeOpen(false, false, false, true, false, false)).toBe(true);
      expect(shouldThoughtGroupBeOpen(false, false, false, false, false, false)).toBe(false);
    });
  });

  describe("complex state transitions", () => {
    it("handles transition from active to idle", () => {
      // Was active, now idle
      expect(shouldThoughtGroupBeOpen(false, true, true, false, true, false)).toBe(false);
      expect(shouldThoughtGroupBeOpen(false, true, true, false, true, true)).toBe(true);
    });

    it("handles first-time active", () => {
      // Just became active
      expect(shouldThoughtGroupBeOpen(true, false, false, false, true, false)).toBe(true);
      expect(shouldThoughtGroupBeOpen(true, false, false, false, false, false)).toBe(false);
    });

    it("handles idle state with no history", () => {
      // Never been active
      expect(shouldThoughtGroupBeOpen(false, false, false, true, false, false)).toBe(true);
      expect(shouldThoughtGroupBeOpen(false, false, false, false, false, false)).toBe(false);
    });
  });

  describe("all parameters false", () => {
    it("returns false when all parameters are false", () => {
      expect(shouldThoughtGroupBeOpen(false, false, false, false, false, false)).toBe(false);
    });
  });

  describe("all parameters true", () => {
    it("returns true when isActive is true and defaultOpenWhenActive is true", () => {
      expect(shouldThoughtGroupBeOpen(true, true, true, true, true, true)).toBe(true);
    });
  });

  describe("parameter priority", () => {
    it("isActive takes priority over other parameters", () => {
      // Even if defaultOpen is true, if isActive is true and defaultOpenWhenActive is false, return false
      expect(shouldThoughtGroupBeOpen(true, false, false, true, false, false)).toBe(false);
    });

    it("wasActive+hasBeenActive takes priority over defaultOpen", () => {
      // When wasActive and hasBeenActive, use defaultOpenWhenIdle not defaultOpen
      expect(shouldThoughtGroupBeOpen(false, true, true, false, false, true)).toBe(true);
      expect(shouldThoughtGroupBeOpen(false, true, true, true, false, false)).toBe(false);
    });
  });
});
