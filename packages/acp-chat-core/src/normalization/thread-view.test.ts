import { describe, it, expect } from "vitest";
import {
  createNormalizedState,
  applySessionUpdate,
  getMessages,
  type TextContentBlock,
  type ResourceContentBlock,
  type ResourceLinkContentBlock,
  type NormalizedMessage,
} from "./store.js";

describe("thread-view", () => {
  describe("content block extraction", () => {
    it("extracts text content blocks", () => {
      const state = createNormalizedState();

      const message = applySessionUpdate(state, {
        update: {
          type: "user_message",
          turnId: "turn-1",
          role: "user",
          content: [{ type: "text", text: "Hello world" }],
        },
      });

  expect(message).not.toBeNull();
    const msg = message as NormalizedMessage | null;
    expect(msg?.contentBlocks.length).toBe(1);
    expect(msg?.contentBlocks[0]?.type).toBe("text");
    expect((msg?.contentBlocks[0] as TextContentBlock)?.text).toBe("Hello world");
  });

    it("extracts resource content blocks", () => {
      const state = createNormalizedState();

      const message = applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [
            { type: "text", text: "Here is a file:" },
            {
              type: "resource",
              resource: {
                uri: "file:///path/to/file.txt",
                mimeType: "text/plain",
                text: "File contents",
              },
            },
          ],
          status: "done",
        },
      });

  const msg = message as NormalizedMessage | null;
    expect(msg?.contentBlocks.length).toBe(2);
    expect(msg?.contentBlocks[1]?.type).toBe("resource");
    const resourceBlock = msg?.contentBlocks[1] as ResourceContentBlock;
    expect(resourceBlock.resource.uri).toBe("file:///path/to/file.txt");
    expect(resourceBlock.resource.mimeType).toBe("text/plain");
    expect(resourceBlock.resource.text).toBe("File contents");
  });

    it("extracts resource_link content blocks", () => {
      const state = createNormalizedState();

      const message = applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [
            { type: "text", text: "Check this link:" },
            {
              type: "resource_link",
              resourceLink: {
                uri: "https://example.com",
                mimeType: "text/html",
              },
            },
          ],
          status: "done",
        },
      });

  const msg = message as NormalizedMessage | null;
    expect(msg?.contentBlocks.length).toBe(2);
    expect(msg?.contentBlocks[1]?.type).toBe("resource_link");
    const linkBlock = msg?.contentBlocks[1] as ResourceLinkContentBlock;
    expect(linkBlock.resourceLink.uri).toBe("https://example.com");
    expect(linkBlock.resourceLink.mimeType).toBe("text/html");
  });

    it("merges text blocks during streaming", () => {
      const state = createNormalizedState();

      applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [{ type: "text", text: "Hello " }],
          status: "in_progress",
        },
      });

      const message = applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [{ type: "text", text: "world" }],
          status: "done",
        },
      });

  const msg = message as NormalizedMessage | null;
    expect(msg?.contentBlocks.length).toBe(1);
    expect((msg?.contentBlocks[0] as TextContentBlock)?.text).toBe("Hello world");
  });

    it("appends non-text blocks without merging", () => {
      const state = createNormalizedState();

      applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [{ type: "text", text: "Here is a file:" }],
          status: "in_progress",
        },
      });

      const message = applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [
            {
              type: "resource",
              resource: { uri: "file:///test.txt" },
            },
          ],
          status: "done",
        },
      });

  const msg = message as NormalizedMessage | null;
    expect(msg?.contentBlocks.length).toBe(2);
    expect(msg?.contentBlocks[0]?.type).toBe("text");
    expect(msg?.contentBlocks[1]?.type).toBe("resource");
  });

    it("handles mixed content types in single update", () => {
      const state = createNormalizedState();

      const message = applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [
            { type: "text", text: "Start" },
            { type: "resource", resource: { uri: "file1.txt" } },
            { type: "text", text: "Middle" },
            { type: "resource_link", resourceLink: { uri: "https://example.com" } },
            { type: "text", text: "End" },
          ],
          status: "done",
        },
      });

  const msg = message as NormalizedMessage | null;
    expect(msg?.contentBlocks.length).toBe(5);
    expect(msg?.contentBlocks[0]?.type).toBe("text");
    expect(msg?.contentBlocks[1]?.type).toBe("resource");
    expect(msg?.contentBlocks[2]?.type).toBe("text");
    expect(msg?.contentBlocks[3]?.type).toBe("resource_link");
    expect(msg?.contentBlocks[4]?.type).toBe("text");
  });
});

  describe("message ordering", () => {
    it("maintains insertion order for messages", () => {
      const state = createNormalizedState();

      applySessionUpdate(state, {
        update: {
          type: "user_message",
          turnId: "turn-1",
          role: "user",
          content: [{ type: "text", text: "First" }],
        },
      });

      applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-2",
          role: "assistant",
          content: [{ type: "text", text: "Second" }],
          status: "done",
        },
      });

      applySessionUpdate(state, {
        update: {
          type: "user_message",
          turnId: "turn-3",
          role: "user",
          content: [{ type: "text", text: "Third" }],
        },
      });

      const messages = getMessages(state);
      expect(messages.length).toBe(3);
      expect(messages[0]?.content).toBe("First");
      expect(messages[1]?.content).toBe("Second");
      expect(messages[2]?.content).toBe("Third");
    });

    it("updates existing message without changing order", () => {
      const state = createNormalizedState();

      applySessionUpdate(state, {
        update: {
          type: "user_message",
          turnId: "turn-1",
          role: "user",
          content: [{ type: "text", text: "User" }],
        },
      });

      applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-2",
          role: "assistant",
          content: [{ type: "text", text: "Agent start" }],
          status: "in_progress",
        },
      });

      applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-2",
          role: "assistant",
          content: [{ type: "text", text: "Agent end" }],
          status: "done",
        },
      });

      const messages = getMessages(state);
      expect(messages.length).toBe(2);
      expect(messages[0]?.role).toBe("user");
      expect(messages[1]?.role).toBe("agent");
      expect(messages[1]?.content).toBe("Agent startAgent end");
    });
  });

  describe("message roles", () => {
    it("assigns user role to user messages", () => {
      const state = createNormalizedState();

      const message = applySessionUpdate(state, {
        update: {
          type: "user_message",
          turnId: "turn-1",
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      });

  expect((message as NormalizedMessage | null)?.role).toBe("user");
  });

  it("assigns agent role to agent messages", () => {
    const state = createNormalizedState();

    const message = applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        turnId: "turn-1",
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
        status: "done",
      },
    });

    expect((message as NormalizedMessage | null)?.role).toBe("agent");
  });
});

  describe("message status", () => {
    it("marks user messages as complete", () => {
      const state = createNormalizedState();

      const message = applySessionUpdate(state, {
        update: {
          type: "user_message",
          turnId: "turn-1",
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      });

  expect((message as NormalizedMessage | null)?.status).toBe("complete");
  });

  it("marks streaming agent messages as streaming", () => {
    const state = createNormalizedState();

    const message = applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        turnId: "turn-1",
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
        status: "in_progress",
      },
    });

    expect((message as NormalizedMessage | null)?.status).toBe("streaming");
  });

  it("marks done agent messages as complete", () => {
    const state = createNormalizedState();

    const message = applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        turnId: "turn-1",
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
        status: "done",
      },
    });

    expect((message as NormalizedMessage | null)?.status).toBe("complete");
  });

  it("marks cancelled agent messages as cancelled", () => {
    const state = createNormalizedState();

    const message = applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        turnId: "turn-1",
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
        status: "cancelled",
      },
    });

    expect((message as NormalizedMessage | null)?.status).toBe("cancelled");
  });
});

  describe("stable message IDs", () => {
    it("generates stable IDs for messages", () => {
      const state = createNormalizedState();

      const message1 = applySessionUpdate(state, {
        update: {
          type: "user_message",
          turnId: "turn-1",
          role: "user",
          content: [{ type: "text", text: "First" }],
        },
      });

      const message2 = applySessionUpdate(state, {
        update: {
          type: "user_message",
          turnId: "turn-2",
          role: "user",
          content: [{ type: "text", text: "Second" }],
        },
      });

  const msg1 = message1 as NormalizedMessage | null;
    const msg2 = message2 as NormalizedMessage | null;
    expect(msg1?.id).toBeDefined();
    expect(msg2?.id).toBeDefined();
    expect(msg1?.id).not.toBe(msg2?.id);
    expect(msg1?.id.startsWith("msg_")).toBe(true);
    expect(msg2?.id.startsWith("msg_")).toBe(true);
  });

    it("preserves message ID on update", () => {
      const state = createNormalizedState();

      const first = applySessionUpdate(state, {
        update: {
          type: "agent_message_chunk",
          turnId: "turn-1",
          role: "assistant",
          content: [{ type: "text", text: "First" }],
          status: "in_progress",
        },
      });

  const id = (first as NormalizedMessage | null)?.id;

    const updated = applySessionUpdate(state, {
      update: {
        type: "agent_message_chunk",
        turnId: "turn-1",
        role: "assistant",
        content: [{ type: "text", text: "Second" }],
        status: "done",
      },
    });

    expect((updated as NormalizedMessage | null)?.id).toBe(id);
  });
  });
});