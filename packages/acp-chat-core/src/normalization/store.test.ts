import { describe, it, expect } from "vitest";
import { createNormalizedState, applySessionUpdate, getMessages, getMessage, getThoughts, getToolCalls } from "./store.js";
import type { NormalizedMessage } from "./store.js";

describe("Normalization", () => {
    it("creates empty state", () => {
        const state = createNormalizedState();
        expect(state.messages.size).toBe(0);
        expect(state.thoughts.size).toBe(0);
        expect(state.timelineOrder.length).toBe(0);
        expect(state.turnIdToMessageId.size).toBe(0);
    });

it("creates agent message from first chunk", () => {
const state = createNormalizedState();

const result = applySessionUpdate(state, {
update: {
type: "agent_message_chunk",
turnId: "turn-1",
role: "assistant",
content: [{ type: "text", text: "Hello" }],
status: "in_progress",
},
});

expect(result).not.toBeNull();
if (result && "role" in result) {
expect(result.role).toBe("agent");
expect(result.content).toBe("Hello");
expect(result.status).toBe("streaming");
}
expect(state.messages.size).toBe(1);
});

    it("updates existing message on subsequent chunks", () => {
        const state = createNormalizedState();

        applySessionUpdate(state, {
            update: {
                type: "agent_message_chunk",
                turnId: "turn-1",
                role: "assistant",
                content: [{ type: "text", text: "Hello" }],
                status: "in_progress",
            },
        });

        const updated = applySessionUpdate(state, {
            update: {
                type: "agent_message_chunk",
                turnId: "turn-1",
                role: "assistant",
                content: [{ type: "text", text: " world" }],
                status: "in_progress",
            },
        });

  expect((updated as NormalizedMessage | null)?.content).toBe("Hello world");
    expect(state.messages.size).toBe(1);
  });

  it("supports snake_case turn_id field for streaming", () => {
        const state = createNormalizedState();

        applySessionUpdate(state, {
            update: {
                type: "agent_message_chunk",
                turn_id: "turn-1",
                role: "assistant",
                content: [{ type: "text", text: "Hello" }],
                status: "in_progress",
            },
        });

        const updated = applySessionUpdate(state, {
            update: {
                type: "agent_message_chunk",
                turn_id: "turn-1",
                role: "assistant",
                content: [{ type: "text", text: " world" }],
                status: "in_progress",
            },
        });

  expect((updated as NormalizedMessage | null)?.content).toBe("Hello world");
    expect(state.messages.size).toBe(1);
  });

  it("supports mixed turnId and turn_id for streaming", () => {
        const state = createNormalizedState();

        applySessionUpdate(state, {
            update: {
                type: "agent_message_chunk",
                turnId: "turn-1",
                role: "assistant",
                content: [{ type: "text", text: "Hello" }],
                status: "in_progress",
            },
        });

        const updated = applySessionUpdate(state, {
            update: {
                type: "agent_message_chunk",
                turn_id: "turn-1",
                role: "assistant",
                content: [{ type: "text", text: " world" }],
                status: "in_progress",
            },
        });

  expect((updated as NormalizedMessage | null)?.content).toBe("Hello world");
    expect(state.messages.size).toBe(1);
  });

  it("marks message as complete when status is done", () => {
const state = createNormalizedState();

applySessionUpdate(state, {
update: {
type: "agent_message_chunk",
turnId: "turn-1",
role: "assistant",
content: [{ type: "text", text: "Hello" }],
status: "in_progress",
},
});

const completed = applySessionUpdate(state, {
update: {
type: "agent_message_chunk",
turnId: "turn-1",
role: "assistant",
content: [{ type: "text", text: "" }],
status: "done",
},
});

if (completed && "status" in completed) {
expect(completed.status).toBe("completed");
}
});

it("creates user message", () => {
const state = createNormalizedState();

const message = applySessionUpdate(state, {
update: {
type: "user_message",
turnId: "turn-0",
role: "user",
content: [{ type: "text", text: "Hi there" }],
},
});

expect(message).not.toBeNull();
if (message && "role" in message) {
expect(message.role).toBe("user");
expect(message.content).toBe("Hi there");
expect(message.status).toBe("completed");
}
});

    it("maintains message order", () => {
        const state = createNormalizedState();

        applySessionUpdate(state, {
            update: {
                type: "user_message",
                turnId: "turn-0",
                role: "user",
                content: [{ type: "text", text: "User message" }],
            },
        });

        applySessionUpdate(state, {
            update: {
                type: "agent_message_chunk",
                turnId: "turn-1",
                role: "assistant",
                content: [{ type: "text", text: "Agent response" }],
                status: "done",
            },
        });

        const messages = getMessages(state);
        expect(messages.length).toBe(2);
        expect(messages[0]?.role).toBe("user");
        expect(messages[1]?.role).toBe("agent");
    });

    it("ignores unknown update types", () => {
        const state = createNormalizedState();

        const result = applySessionUpdate(state, {
            update: {
                type: "unknown_type",
                someField: "value",
            },
        });

        expect(result).toBeNull();
        expect(state.messages.size).toBe(0);
    });

    it("returns message by ID", () => {
        const state = createNormalizedState();

        const created = applySessionUpdate(state, {
            update: {
                type: "user_message",
                turnId: "turn-0",
                role: "user",
                content: [{ type: "text", text: "Test" }],
            },
        });

  const retrieved = getMessage(state, (created as NormalizedMessage | null)?.id ?? "");
    expect(retrieved).toEqual(created);
  });

it("handles multiple text content parts", () => {
const state = createNormalizedState();

const message = applySessionUpdate(state, {
update: {
type: "agent_message_chunk",
turnId: "turn-1",
role: "assistant",
content: [
{ type: "text", text: "Part 1 " },
{ type: "text", text: "Part 2" },
],
status: "done",
},
});

if (message && "content" in message) {
expect(message.content).toBe("Part 1 Part 2");
}
});

it("sets cancelled status", () => {
const state = createNormalizedState();

applySessionUpdate(state, {
update: {
type: "agent_message_chunk",
turnId: "turn-1",
role: "assistant",
content: [{ type: "text", text: "Partial" }],
status: "in_progress",
},
});

const cancelled = applySessionUpdate(state, {
update: {
type: "agent_message_chunk",
turnId: "turn-1",
role: "assistant",
content: [],
status: "cancelled",
},
});

if (cancelled && "status" in cancelled) {
expect(cancelled.status).toBe("cancelled");
}
});

  it("creates thought from agent_thought_chunk without turnId", () => {
    const state = createNormalizedState();

    const thought = applySessionUpdate(state, {
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "Thinking about the problem..." },
      },
    });

    expect(thought).not.toBeNull();
    expect((thought as { content: string } | null)?.content).toBe("Thinking about the problem...");
    expect(state.thoughts.size).toBe(1);
    expect(state.messages.size).toBe(0);
  });

it("accumulates multiple thought chunks", () => {
const state = createNormalizedState();

applySessionUpdate(state, {
update: {
sessionUpdate: "agent_thought_chunk",
content: { type: "text", text: "First thought. " },
},
});

applySessionUpdate(state, {
update: {
sessionUpdate: "agent_thought_chunk",
content: { type: "text", text: "Second thought." },
},
});

const thoughts = getThoughts(state);
expect(thoughts.length).toBe(2);
expect(thoughts[0]?.content).toBe("First thought. ");
expect(thoughts[1]?.content).toBe("Second thought.");
});

it("handles thought chunk with array content", () => {
const state = createNormalizedState();

const thought = applySessionUpdate(state, {
update: {
sessionUpdate: "agent_thought_chunk",
content: [
{ type: "text", text: "Part 1 " },
{ type: "text", text: "Part 2" },
],
},
});

  expect((thought as { content: string } | null)?.content).toBe("Part 1 Part 2");
  });

  it("separates agent_message_chunk and agent_thought_chunk handling", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "Internal thought" },
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        turnId: "turn-1",
        role: "assistant",
        content: [{ type: "text", text: "Response" }],
        status: "done",
      },
    });

    expect(state.thoughts.size).toBe(1);
    expect(state.messages.size).toBe(1);
    expect(getThoughts(state)[0]?.content).toBe("Internal thought");
    expect(getMessages(state)[0]?.content).toBe("Response");
  });

  it("creates agent message from chunk without turnId", () => {
    const state = createNormalizedState();

    const message = applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        role: "assistant",
        content: [{ type: "text", text: "Message without turnId" }],
        status: "in_progress",
      },
    });

    expect(message).not.toBeNull();
    if (message && "role" in message) {
      expect(message.role).toBe("agent");
      expect(message.content).toBe("Message without turnId");
      expect(message.turnId).toBeUndefined();
    }
    expect(state.messages.size).toBe(1);
    expect(state.timelineOrder.length).toBe(1);
  });
});
describe("status tracking - unit tests", () => {
  it("marks previous thought complete when new turn starts", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        type: "agent_thought_chunk",
        turnId: "turn-1",
        content: [{ type: "text", text: "Thinking..." }],
        status: "in_progress",
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "agent_thought_chunk",
        turnId: "turn-2",
        content: [{ type: "text", text: "More thinking..." }],
        status: "in_progress",
      },
    });

    const thoughts = getThoughts(state);
    expect(thoughts).toHaveLength(2);

    const firstThought = thoughts.find((t) => t.turnId === "turn-1");
    expect(firstThought?.status).toBe("completed");

    const secondThought = thoughts.find((t) => t.turnId === "turn-2");
    expect(secondThought?.status).toBe("streaming");
  });

  it("maps thought status correctly", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        type: "agent_thought_chunk",
        turnId: "turn-1",
        content: [{ type: "text", text: "Thinking..." }],
        status: "in_progress",
      },
    });

    const thoughts = getThoughts(state);
    const thought = thoughts[0];
    expect(thought?.status).toBe("streaming");

    applySessionUpdate(state, {
      update: {
        type: "agent_thought_chunk",
        turnId: "turn-1",
        content: [{ type: "text", text: "Done thinking." }],
        status: "done",
      },
    });

    const updatedThoughts = getThoughts(state);
    const updatedThought = updatedThoughts.find((t) => t.turnId === "turn-1");
    expect(updatedThought?.status).toBe("completed");
  });

  it("maps tool status correctly", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        type: "tool_call",
        toolCallId: "tool-1",
        kind: "read",
        title: "Read file",
        status: "pending",
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "tool_call_update",
        toolCallId: "tool-1",
        status: "in_progress",
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "tool_call_update",
        toolCallId: "tool-1",
        status: "completed",
      },
    });

    const tools = getToolCalls(state);
    const tool = tools.find((t) => t.toolCallId === "tool-1");
    expect(tool?.status).toBe("completed");
  });

  it("maps tool call status values correctly", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        type: "tool_call",
        toolCallId: "tool-1",
        kind: "read",
        title: "Read file",
        status: "pending",
      },
    });

    const tools1 = getToolCalls(state);
    expect(tools1[0]?.status).toBe("pending");

    applySessionUpdate(state, {
      update: {
        type: "tool_call_update",
        toolCallId: "tool-1",
        status: "in_progress",
      },
    });

    const tools2 = getToolCalls(state);
    expect(tools2[0]?.status).toBe("in_progress");

    applySessionUpdate(state, {
      update: {
        type: "tool_call_update",
        toolCallId: "tool-1",
        status: "completed",
      },
    });

    const tools3 = getToolCalls(state);
    expect(tools3[0]?.status).toBe("completed");

    const state2 = createNormalizedState();
    applySessionUpdate(state2, {
      update: {
        type: "tool_call",
        toolCallId: "tool-2",
        kind: "search",
        title: "Search",
        status: "failed",
      },
    });

    const tools4 = getToolCalls(state2);
    const failedTool = tools4.find((t) => t.toolCallId === "tool-2");
    expect(failedTool?.status).toBe("failed");
  });

  it("tracks message status correctly", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        type: "user_message",
        turnId: "turn-1",
        content: "Hello world",
      },
    });

    const messages1 = getMessages(state);
    const userMsg = messages1.find((m) => m.role === "user");
    expect(userMsg?.status).toBe("completed");

    applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        turnId: "turn-2",
        content: [{ type: "text", text: "Hi there!" }],
        status: "in_progress",
      },
    });

    const messages2 = getMessages(state);
    const agentMsg = messages2.find((m) => m.role === "agent");
    expect(agentMsg?.status).toBe("streaming");

    applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        turnId: "turn-2",
        content: [{ type: "text", text: "Hi there!" }],
        status: "done",
      },
    });

    const messages3 = getMessages(state);
    const completedAgentMsg = messages3.find((m) => m.role === "agent" && m.turnId === "turn-2");
    expect(completedAgentMsg?.status).toBe("completed");
  });

  it("handles multiple thoughts in sequence", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        type: "agent_thought_chunk",
        turnId: "turn-1a",
        content: [{ type: "text", text: "First thought" }],
        status: "in_progress",
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "agent_thought_chunk",
        turnId: "turn-1a",
        content: [{ type: "text", text: " more content" }],
        status: "in_progress",
      },
    });

    const thoughts1 = getThoughts(state);
    expect(thoughts1).toHaveLength(1);
    expect(thoughts1[0]?.content).toBe("First thought more content");

    applySessionUpdate(state, {
      update: {
        type: "agent_thought_chunk",
        turnId: "turn-1b",
        content: [{ type: "text", text: "Second thought" }],
        status: "in_progress",
      },
    });

    const thoughts2 = getThoughts(state);
    expect(thoughts2).toHaveLength(2);

    const firstThought = thoughts2.find((t) => t.turnId === "turn-1a");
    expect(firstThought?.status).toBe("completed");

    const secondThought = thoughts2.find((t) => t.turnId === "turn-1b");
    expect(secondThought?.status).toBe("streaming");
  });

  it("verifies tool statuses are valid normalized values", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        type: "tool_call",
        toolCallId: "tool-1",
        kind: "read",
        title: "Tool 1",
        status: "pending",
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "tool_call",
        toolCallId: "tool-2",
        kind: "search",
        title: "Tool 2",
        status: "in_progress",
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "tool_call",
        toolCallId: "tool-3",
        kind: "write",
        title: "Tool 3",
        status: "completed",
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "tool_call",
        toolCallId: "tool-4",
        kind: "execute",
        title: "Tool 4",
        status: "failed",
      },
    });

    applySessionUpdate(state, {
      update: {
        type: "tool_call",
        toolCallId: "tool-5",
        kind: "edit",
        title: "Tool 5",
        status: "cancelled",
      },
    });

    const toolCalls = getToolCalls(state);

    for (const tool of toolCalls) {
      expect(["pending", "in_progress", "completed", "failed", "cancelled"]).toContain(tool.status);
    }

    expect(toolCalls).toHaveLength(5);
  });

  it("handles edge cases with undefined status values", () => {
    const state = createNormalizedState();

    applySessionUpdate(state, {
      update: {
        type: "agent_thought_chunk",
        turnId: "turn-1",
        content: [{ type: "text", text: "Thought" }],
      },
    });

    const thoughts1 = getThoughts(state);
    expect(thoughts1[0]?.status).toBe("streaming");

    const state2 = createNormalizedState();
    applySessionUpdate(state2, {
      update: {
        type: "tool_call",
        toolCallId: "tool-1",
        kind: "read",
        title: "Tool",
      },
    });

    const tools1 = getToolCalls(state2);
    expect(tools1[0]?.status).toBeUndefined();
  });
});
