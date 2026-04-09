import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageCard } from "./MessageCard.js";
import { MessageList } from "./MessageList.js";
import { MessageStatusIndicator } from "./MessageStatusIndicator.js";
import { MessageTimestamp } from "./MessageTimestamp.js";
import { MessageEmptyState } from "./MessageEmptyState.js";
import { ContentRenderer } from "../content/ContentRenderer.js";
import type { NormalizedMessage, ContentBlock } from "@harms-haus/acp-chat-core";

const mockUserMessage: NormalizedMessage = {
  id: "msg_1",
  role: "user",
  status: "completed",
  content: "Hello, this is a test message",
  contentBlocks: [{ type: "text", text: "Hello, this is a test message" }],
  createdAt: Date.now(),
};

const mockAgentMessage: NormalizedMessage = {
  id: "msg_2",
  role: "agent",
  status: "streaming",
  content: "I'm processing your request...",
  contentBlocks: [{ type: "text", text: "I'm processing your request..." }],
  createdAt: Date.now(),
};

const mockAgentMessageWithResource: NormalizedMessage = {
  id: "msg_3",
  role: "agent",
  status: "completed",
  content: "Here is the file content",
  contentBlocks: [
    { type: "text", text: "Here is the file content" },
    {
      type: "resource",
      resource: {
        uri: "file:///test.txt",
        mimeType: "text/plain",
        text: "File contents here",
      },
    },
  ],
  createdAt: Date.now(),
};

describe("MessageCard", () => {
  it("renders user message with correct role attribute", () => {
    render(<MessageCard message={mockUserMessage} />);

    const card = screen.getByText("Hello, this is a test message").closest("[data-acp-message-role]");
    expect(card).toBeTruthy();
    expect(card?.getAttribute("data-acp-message-role")).toBe("user");
    expect(card?.getAttribute("data-acp-message-id")).toBe("msg_1");
  });

  it("renders agent message with correct role attribute", () => {
    render(<MessageCard message={mockAgentMessage} />);

    const card = screen.getByText("I'm processing your request...").closest("[data-acp-message-role]");
    expect(card).toBeTruthy();
    expect(card?.getAttribute("data-acp-message-role")).toBe("agent");
    expect(card?.getAttribute("data-acp-message-status")).toBe("streaming");
  });

  it("renders content blocks when present", () => {
    render(<MessageCard message={mockAgentMessageWithResource} />);

    expect(screen.getByText("Here is the file content")).toBeTruthy();
    expect(screen.getByText("File contents here")).toBeTruthy();
  });

  it("renders custom children when provided", () => {
    render(
      <MessageCard message={mockUserMessage}>
        <div data-testid="custom-content">Custom content</div>
      </MessageCard>
    );

    expect(screen.getByTestId("custom-content")).toBeTruthy();
  });
});

describe("MessageList", () => {
  it("renders multiple messages", () => {
    const messages = [mockUserMessage, mockAgentMessage];
    render(<MessageList messages={messages} />);

    expect(screen.getByText("Hello, this is a test message")).toBeTruthy();
    expect(screen.getByText("I'm processing your request...")).toBeTruthy();
  });

  it("renders empty list without errors", () => {
    render(<MessageList messages={[]} />);

    const list = document.querySelector("[data-acp-message-list]");
    expect(list).toBeTruthy();
  });

  it("uses custom render function when provided", () => {
    const customRender = vi.fn(() => <div data-testid="custom-message">Custom</div>);
    const messages = [mockUserMessage];

    render(<MessageList messages={messages} renderMessage={customRender} />);

    expect(customRender).toHaveBeenCalledWith(mockUserMessage, 0);
    expect(screen.getByTestId("custom-message")).toBeTruthy();
  });
});

describe("MessageStatusIndicator", () => {
  it("renders streaming status", () => {
    render(<MessageStatusIndicator status="streaming" />);

    const indicator = document.querySelector("[data-acp-message-status='streaming']");
    expect(indicator).toBeTruthy();
    expect(screen.getByText("Streaming")).toBeTruthy();
  });

  it("renders complete status", () => {
render(<MessageStatusIndicator status="completed" />);

const indicator = document.querySelector("[data-acp-message-status='completed']");
    expect(indicator).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("renders error status", () => {
    render(<MessageStatusIndicator status="error" />);

    const indicator = document.querySelector("[data-acp-message-status='error']");
    expect(indicator).toBeTruthy();
    expect(screen.getByText("Error")).toBeTruthy();
  });

  it("renders cancelled status", () => {
    render(<MessageStatusIndicator status="cancelled" />);

    const indicator = document.querySelector("[data-acp-message-status='cancelled']");
    expect(indicator).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });
});

describe("MessageTimestamp", () => {
  it("renders formatted timestamp", () => {
    const timestamp = 1704067200000;
    render(<MessageTimestamp timestamp={timestamp} />);

    const timeElement = document.querySelector("time");
    expect(timeElement).toBeTruthy();
    expect(timeElement?.getAttribute("datetime")).toBe(new Date(timestamp).toISOString());
  });

  it("returns null when no timestamp", () => {
    const { container } = render(<MessageTimestamp />);
    expect(container.firstChild).toBeNull();
  });
});

describe("MessageEmptyState", () => {
  it("renders default message", () => {
    render(<MessageEmptyState />);

    expect(screen.getByText("No messages yet")).toBeTruthy();
  });

  it("renders custom message", () => {
    render(<MessageEmptyState message="Custom empty message" />);

    expect(screen.getByText("Custom empty message")).toBeTruthy();
  });
});

describe("ContentRenderer", () => {
  it("renders text content blocks", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "Hello world" }];
    render(<ContentRenderer blocks={blocks} />);

    expect(screen.getByText("Hello world")).toBeTruthy();
    expect(document.querySelector("[data-acp-content-type='text']")).toBeTruthy();
  });

  it("renders resource content blocks", () => {
    const blocks: ContentBlock[] = [
      {
        type: "resource",
        resource: {
          uri: "file:///test.txt",
          mimeType: "text/plain",
          text: "Resource content",
        },
      },
    ];
    render(<ContentRenderer blocks={blocks} />);

    expect(screen.getByText("Resource content")).toBeTruthy();
    expect(document.querySelector("[data-acp-content-type='resource']")).toBeTruthy();
  });

  it("renders resource_link content blocks", () => {
    const blocks: ContentBlock[] = [
      {
        type: "resource_link",
        resourceLink: {
          uri: "https://example.com/file.txt",
          mimeType: "text/plain",
        },
      },
    ];
    render(<ContentRenderer blocks={blocks} />);

    const link = screen.getByText("https://example.com/file.txt");
    expect(link).toBeTruthy();
    expect(link.closest("a")?.getAttribute("href")).toBe("https://example.com/file.txt");
    expect(document.querySelector("[data-acp-content-type='resource_link']")).toBeTruthy();
  });

  it("renders unsupported content type safely", () => {
    const blocks = [{ type: "unknown_type" }] as unknown as ContentBlock[];
    render(<ContentRenderer blocks={blocks} />);

    expect(screen.getByText("Unknown content type")).toBeTruthy();
    expect(document.querySelector("[data-acp-content-type='unsupported']")).toBeTruthy();
  });

  it("returns null for empty blocks", () => {
    const { container } = render(<ContentRenderer blocks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders multiple content blocks", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "First block" },
      { type: "text", text: "Second block" },
    ];
    render(<ContentRenderer blocks={blocks} />);

    expect(screen.getByText("First block")).toBeTruthy();
    expect(screen.getByText("Second block")).toBeTruthy();
  });
});
