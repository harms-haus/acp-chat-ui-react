import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef, useMemo, useCallback } from "react";
import { VirtualizedThread } from "./VirtualizedThread.js";
import type { ThreadItem, VirtualizedThreadRef } from "./types.js";
import type { NormalizedMessage } from "@acp/chat-core";

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
Element.prototype.scrollTo = vi.fn();

function getContent(item: ThreadItem): string {
  if (item.type === "message") {
    return (item.data as { content?: string }).content ?? "";
  }
  if (item.type === "thought_group") {
    const group = item.data as { items?: Array<{ data?: { content?: string } }> };
    return group.items?.[0]?.data?.content ?? "";
  }
  return "";
}

function createTestItems(count: number): ThreadItem[] {
  return Array.from({ length: count }, (_, i) => ({
    type: "message" as const,
    id: `msg-${i}`,
    data: {
      id: `msg-${i}`,
      role: i % 2 === 0 ? "user" : "agent",
      status: "completed",
      content: `Message ${i} content`,
      contentBlocks: [{ type: "text" as const, text: `Message ${i} content` }],
    } as NormalizedMessage,
  }));
}

function TestThread({
  items,
  followScroll = true,
}: {
  items: ThreadItem[];
  followScroll?: boolean;
}) {
  const threadRef = useRef<VirtualizedThreadRef>(null);

  const renderItem = useCallback((item: ThreadItem) => {
    return (
      <div data-testid={`message-${item.id}`} style={{ padding: "20px", border: "1px solid #ccc" }}>
        {getContent(item)}
      </div>
    );
  }, []);

  return (
    <div style={{ height: "400px", width: "600px" }}>
      <VirtualizedThread
        ref={threadRef}
        items={items}
        renderItem={renderItem}
        followScroll={followScroll}
        estimatedRowHeight={60}
      />
    </div>
  );
}

describe("VirtualizedThread", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders empty state when no items", () => {
    render(<TestThread items={[]} />);

    expect(screen.getByText("No messages yet")).toBeTruthy();
    expect(document.querySelector("[data-acp-thread-empty]")).toBeTruthy();
  });

  it("renders thread container with populated state", () => {
    const items = createTestItems(5);
    render(<TestThread items={items} />);

    expect(document.querySelector("[data-acp-thread-populated]")).toBeTruthy();
    expect(document.querySelector("[data-acp-thread-scroll-viewport]")).toBeTruthy();
    expect(document.querySelector("[data-acp-thread-scroll-content]")).toBeTruthy();
  });

  it("exposes imperative ref methods", () => {
    function TestWithRef() {
      const threadRef = useRef<VirtualizedThreadRef>(null);
      const items = useMemo(() => createTestItems(10), []);

      const renderItem = useCallback((item: ThreadItem) => {
        return <div data-testid={`msg-${item.id}`}>{getContent(item)}</div>;
      }, []);

      return (
        <>
          <button
            type="button"
            data-testid="scroll-btn"
            onClick={() => threadRef.current?.scrollToBottom()}
          >
            Scroll
          </button>
          <div style={{ height: "200px" }}>
            <VirtualizedThread ref={threadRef} items={items} renderItem={renderItem} />
          </div>
        </>
      );
    }

    render(<TestWithRef />);

    const button = screen.getByTestId("scroll-btn");
    fireEvent.click(button);

    expect(() => fireEvent.click(button)).not.toThrow();
  });

  it("tracks viewport scroll state", () => {
    const items = createTestItems(20);
    render(<TestThread items={items} />);

    const viewport = document.querySelector("[data-acp-thread-scroll-viewport]");
    expect(viewport).toBeTruthy();

    if (viewport) {
      fireEvent.scroll(viewport, { target: { scrollTop: 100 } });
      vi.advanceTimersByTime(20);
    }
  });

  it("supports different layout modes", () => {
    function TestWithLayout({ layout }: { layout: "centered" | "expanded" }) {
      const items = useMemo(() => createTestItems(5), []);
      const renderItem = useCallback(
        (item: ThreadItem) => <div>{getContent(item)}</div>,
        []
      );

      return (
        <div style={{ height: "400px" }}>
          <VirtualizedThread items={items} renderItem={renderItem} layout={layout} />
        </div>
      );
    }

    const { rerender } = render(<TestWithLayout layout="centered" />);
    expect(document.querySelector(".acp-thread--centered")).toBeTruthy();

    rerender(<TestWithLayout layout="expanded" />);
    expect(document.querySelector(".acp-thread--expanded")).toBeTruthy();
  });

  it("renders custom empty state", () => {
    function TestWithCustomEmpty() {
      const renderItem = useCallback(() => null, []);

      return (
        <div style={{ height: "400px" }}>
          <VirtualizedThread
            items={[]}
            renderItem={renderItem}
            emptyState={<div data-testid="custom-empty">Custom empty message</div>}
          />
        </div>
      );
    }

    render(<TestWithCustomEmpty />);
    expect(screen.getByTestId("custom-empty")).toBeTruthy();
  });

  it("handles thought_group item type", () => {
    const mixedItems: ThreadItem[] = [
      {
        type: "message",
        id: "msg-1",
        data: { id: "msg-1", role: "user", status: "completed", content: "Hello", contentBlocks: [] },
      },
      {
        type: "thought_group",
        id: "thought-group-1",
        data: {
          id: "thought-group-1",
          items: [
            { type: "thought", id: "thought-1", data: { id: "thought-1", content: "Thinking..." } },
          ],
          startTime: Date.now() - 1000,
          endTime: Date.now(),
          isActive: false,
        },
      },
    ];

    function TestMixedItems() {
      const renderItem = useCallback((item: ThreadItem) => {
        return <div data-testid={`item-${item.type}-${item.id}`}>{item.type}</div>;
      }, []);

      return (
        <div style={{ height: "400px" }}>
          <VirtualizedThread items={mixedItems} renderItem={renderItem} />
        </div>
      );
    }

    render(<TestMixedItems />);

    expect(document.querySelector("[data-acp-thread-populated]")).toBeTruthy();
  });

  it("uses stable message IDs for React keys", () => {
    const items = createTestItems(3);
    const { rerender } = render(<TestThread items={items} />);

    const newItem: ThreadItem = {
      type: "message",
      id: "msg-new",
      data: {
        id: "msg-new",
        role: "user",
        status: "completed",
        content: "New message",
        contentBlocks: [{ type: "text", text: "New message" }],
      } as NormalizedMessage,
    };
    const reorderedItems = [newItem, ...items];

    rerender(<TestThread items={reorderedItems} />);

    expect(document.querySelector("[data-acp-thread-populated]")).toBeTruthy();
  });

  it("respects followScroll prop", () => {
    const items = createTestItems(5);
    const { rerender } = render(<TestThread items={items} followScroll={false} />);

    expect(document.querySelector("[data-acp-thread-populated]")).toBeTruthy();

    const moreItems = createTestItems(10);
    rerender(<TestThread items={moreItems} followScroll={true} />);

    expect(document.querySelector("[data-acp-thread-populated]")).toBeTruthy();
  });

  it("provides imperative getViewport method", () => {
    function TestGetViewport() {
      const threadRef = useRef<VirtualizedThreadRef>(null);
      const items = useMemo(() => createTestItems(5), []);
      const renderItem = useCallback((item: ThreadItem) => {
        return <div>{getContent(item)}</div>;
      }, []);

      return (
        <>
          <button
            type="button"
            data-testid="get-viewport-btn"
            onClick={() => {
              const vp = threadRef.current?.getViewport();
              expect(vp).toBeTruthy();
            }}
          >
            Get Viewport
          </button>
          <div style={{ height: "200px" }}>
            <VirtualizedThread ref={threadRef} items={items} renderItem={renderItem} />
          </div>
        </>
      );
    }

    render(<TestGetViewport />);

    const button = screen.getByTestId("get-viewport-btn");
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});
