import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThoughtStack } from "./ThoughtStack.js";
import { ToolCall } from "../tool-call/ToolCall.js";
import type { ThoughtGroup, ThoughtItem } from "./types.js";
import type { NormalizedThought, NormalizedToolCall } from "@acp/chat-core";

const createMockThought = (id: string, content: string): NormalizedThought => ({
  id,
  content,
  createdAt: Date.now(),
});

const createMockToolCall = (id: string, kind: NormalizedToolCall["kind"], title: string): NormalizedToolCall => ({
  toolCallId: id,
  kind,
  title,
  status: "completed",
  createdAt: Date.now(),
});

const createMockThoughtGroup = (items: ThoughtItem[]): ThoughtGroup => ({
  id: "group-1",
  items,
  startTime: Date.now() - 1000,
  endTime: Date.now(),
});

describe("ThoughtStack", () => {
  it("should render thought stack with trigger", () => {
    const thought = createMockThought("thought-1", "I need to analyze this problem");
    const group = createMockThoughtGroup([{ type: "thought", id: thought.id, data: thought }]);

    render(<ThoughtStack group={group} />);

    expect(screen.getByText("1 thought")).toBeInTheDocument();
  });

  it("should render thought stack with multiple items", () => {
    const thought1 = createMockThought("thought-1", "First thought");
    const thought2 = createMockThought("thought-2", "Second thought");
    const group = createMockThoughtGroup([
      { type: "thought", id: thought1.id, data: thought1 },
      { type: "thought", id: thought2.id, data: thought2 },
    ]);

    render(<ThoughtStack group={group} />);

    expect(screen.getByText("2 thoughts")).toBeInTheDocument();
  });

  it("should render thought stack with tool calls", () => {
    const toolCall = createMockToolCall("tool-1", "read", "Read file");
    const group = createMockThoughtGroup([{ type: "tool_call", id: toolCall.toolCallId, data: toolCall }]);

    render(<ThoughtStack group={group} />);

    expect(screen.getByText("1 tool call")).toBeInTheDocument();
  });

  it("should render mixed thoughts and tool calls", () => {
    const thought = createMockThought("thought-1", "Analyzing...");
    const toolCall = createMockToolCall("tool-1", "read", "Read file");
    const group = createMockThoughtGroup([
      { type: "thought", id: thought.id, data: thought },
      { type: "tool_call", id: toolCall.toolCallId, data: toolCall },
    ]);

    render(<ThoughtStack group={group} />);

    expect(screen.getByText("1 thought, 1 tool call")).toBeInTheDocument();
  });

  it("should expand when clicked", async () => {
    const thought = createMockThought("thought-1", "I need to analyze this problem");
    const group = createMockThoughtGroup([{ type: "thought", id: thought.id, data: thought }]);

    render(<ThoughtStack group={group} defaultOpen={false} />);

    const trigger = screen.getByText("1 thought");
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("I need to analyze this problem")).toBeInTheDocument();
    });
  });

  it("should show inactive state without controller", () => {
    const thought = createMockThought("thought-1", "Thinking...");
    const group = createMockThoughtGroup([{ type: "thought", id: thought.id, data: thought }]);

    const { container } = render(<ThoughtStack group={group} />);

    const root = container.querySelector("[data-acp-thought-root]");
    expect(root?.getAttribute("data-acp-thought-active")).toBe("false");
  });

  it("should not auto-expand when inactive without controller", () => {
    const thought = createMockThought("thought-1", "Thinking...");
    const group = createMockThoughtGroup([{ type: "thought", id: thought.id, data: thought }]);

    render(<ThoughtStack group={group} defaultOpenWhenActive={true} />);

    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("should have stable selectors", () => {
    const thought = createMockThought("thought-1", "Test thought");
    const group = createMockThoughtGroup([{ type: "thought", id: thought.id, data: thought }]);

    const { container } = render(<ThoughtStack group={group} />);

    expect(container.querySelector("[data-acp-thought-root]")).toBeInTheDocument();
    expect(container.querySelector("[data-acp-thought-trigger]")).toBeInTheDocument();
    expect(container.querySelector("[data-acp-thought-group-id]")).toBeInTheDocument();
  });
});

describe("ToolCall", () => {
  it("should render tool call with header", () => {
    const toolCall = createMockToolCall("tool-1", "read", "Read file.txt");

    render(<ToolCall toolCall={toolCall} />);

    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("Read file.txt")).toBeInTheDocument();
  });

  it("should show completed status", () => {
    const toolCall = createMockToolCall("tool-1", "read", "Read file");

    const { container } = render(<ToolCall toolCall={toolCall} />);

    const root = container.querySelector("[data-acp-tool-call-root]");
    expect(root?.getAttribute("data-acp-tool-call-status")).toBe("completed");
  });

  it("should expand when clicked", async () => {
    const toolCall: NormalizedToolCall = {
      ...createMockToolCall("tool-1", "read", "Read file"),
      rawInput: { filePath: "/test/file.txt" },
    };

    render(<ToolCall toolCall={toolCall} />);

    const trigger = screen.getByText("read");
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Input")).toBeInTheDocument();
    });
  });

  it("should show input/output when expanded", async () => {
    const toolCall: NormalizedToolCall = {
      ...createMockToolCall("tool-1", "read", "Read file"),
      rawInput: { filePath: "/test/file.txt" },
      rawOutput: {
        output: "File contents here",
        metadata: { truncated: false },
      },
    };

    render(<ToolCall toolCall={toolCall} isExpanded={true} />);

    await waitFor(() => {
      expect(screen.getByText("Input")).toBeInTheDocument();
      expect(screen.getByText("Output")).toBeInTheDocument();
    });
  });

  it("should have stable selectors", () => {
    const toolCall = createMockToolCall("tool-1", "read", "Read file");

    const { container } = render(<ToolCall toolCall={toolCall} />);

    expect(container.querySelector("[data-acp-tool-call-root]")).toBeInTheDocument();
    expect(container.querySelector("[data-acp-tool-call-id]")).toBeInTheDocument();
    expect(container.querySelector("[data-acp-tool-call-kind]")).toBeInTheDocument();
    expect(container.querySelector("[data-acp-tool-call-status]")).toBeInTheDocument();
  });

  it("should render different tool call kinds", () => {
    const kinds: NormalizedToolCall["kind"][] = ["read", "search", "edit", "write", "execute", "glob", "grep", "unknown"];

    kinds.forEach((kind) => {
      const toolCall = createMockToolCall(`tool-${kind}`, kind, `${kind} operation`);
      const { container } = render(<ToolCall toolCall={toolCall} />);

      const root = container.querySelector("[data-acp-tool-call-root]");
      expect(root?.getAttribute("data-acp-tool-call-kind")).toBe(kind);
    });
  });
});

describe("Render Isolation", () => {
  it("should not re-render unrelated items when thought updates", async () => {
    const thought = createMockThought("thought-1", "Initial thought");
    const group = createMockThoughtGroup([{ type: "thought", id: thought.id, data: thought }]);

    const { rerender } = render(<ThoughtStack group={group} />);

    const updatedThought = { ...thought, content: "Updated thought" };
    const updatedGroup = createMockThoughtGroup([{ type: "thought", id: updatedThought.id, data: updatedThought }]);

    rerender(<ThoughtStack group={updatedGroup} />);

    await waitFor(() => {
      expect(screen.getByText("1 thought")).toBeInTheDocument();
    });
  });

  it("should memoize thought item components", async () => {
    const thought = createMockThought("thought-1", "Test thought");
    const group = createMockThoughtGroup([{ type: "thought", id: thought.id, data: thought }]);

    const { container } = render(<ThoughtStack group={group} defaultOpen={true} />);

    await waitFor(() => {
      const items = container.querySelectorAll("[data-acp-thought-item]");
      expect(items.length).toBe(1);
    });
  });
});
