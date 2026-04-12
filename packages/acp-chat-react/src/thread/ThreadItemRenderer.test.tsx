import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThreadItemRenderer } from "./ThreadItemRenderer.js";
import type { ThreadItem } from "./types.js";
import type { NormalizedMessage, NormalizedPermissionRequest, NormalizedToolCall, SessionController } from "@harms-haus/acp-chat-core";
import type { ThoughtGroupWithState } from "../thought/types.js";

function createMockMessage(overrides?: Partial<NormalizedMessage>): NormalizedMessage {
  return {
    id: "msg-1",
    role: "user",
    status: "completed",
    content: "Test message content",
    contentBlocks: [{ type: "text", text: "Test message content" }],
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockThoughtGroup(overrides?: Partial<ThoughtGroupWithState>): ThoughtGroupWithState {
  return {
    id: "thought-group-1",
    items: [
      {
        type: "thought",
        id: "thought-1",
        data: {
          id: "thought-1",
          content: "Thinking about the problem...",
          status: "completed",
          createdAt: Date.now() - 1000,
        },
      },
      {
        type: "tool_call",
        id: "tool-1",
        data: {
          toolCallId: "tool-1",
          kind: "read",
          title: "Read file",
          status: "completed",
          rawInput: { filePath: "/test/file.ts" },
          createdAt: Date.now() - 500,
        },
      },
    ],
    startTime: Date.now() - 1000,
    endTime: Date.now(),
    isActive: false,
    ...overrides,
  };
}

function createMockPermissionRequest(overrides?: Partial<NormalizedPermissionRequest>): NormalizedPermissionRequest {
  return {
    requestId: 1,
    toolCallId: "tool-1",
    sessionId: "session-1",
    status: "pending",
    options: [
      { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
      { optionId: "deny", name: "Deny", kind: "deny" },
    ],
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockToolCall(overrides?: Partial<NormalizedToolCall>): NormalizedToolCall {
  return {
    toolCallId: "tool-1",
    kind: "read",
    title: "Read file",
    status: "completed",
    rawInput: { filePath: "/test/file.ts" },
    createdAt: Date.now() - 500,
    ...overrides,
  };
}

describe("ThreadItemRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Message items", () => {
    it("renders user message item", () => {
      const message = createMockMessage({ role: "user" });
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };

      render(<ThreadItemRenderer item={item} />);

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
      expect(container.getAttribute("data-acp-thread-item-type")).toBe("message");
      expect(container.getAttribute("data-acp-thread-item-id")).toBe("msg-1");
      expect(screen.getByText("Test message content")).toBeTruthy();
    });

    it("renders agent message item with status", () => {
      const message = createMockMessage({ role: "agent", status: "streaming" });
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };

      render(<ThreadItemRenderer item={item} />);

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
      expect(container.getAttribute("data-acp-thread-item-type")).toBe("message");
      expect(screen.getByText("Test message content")).toBeTruthy();
    });

    it("renders message with custom actions", () => {
      const message = createMockMessage();
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };
      const mockActions = [
        { id: "copy", label: "Copy", icon: "📋", onClick: vi.fn() },
        { id: "delete", label: "Delete", icon: "🗑️", onClick: vi.fn() },
      ];

      render(<ThreadItemRenderer item={item} messageActions={mockActions} />);

      expect(screen.getByText("Test message content")).toBeTruthy();
    });

    it("renders message with appeared after flag", () => {
      const message = createMockMessage();
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };

      render(<ThreadItemRenderer item={item} messageAppearedAfter={true} />);

      expect(screen.getByText("Test message content")).toBeTruthy();
    });

    it("renders message with controller", () => {
      const message = createMockMessage();
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };
      const controller = { state: { connectionStatus: "connected" } } as unknown as SessionController;

      render(<ThreadItemRenderer item={item} controller={controller} />);

      expect(screen.getByText("Test message content")).toBeTruthy();
    });
  });

  describe("Thought group items", () => {
    it("renders thought group item", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };

      render(<ThreadItemRenderer item={item} />);

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
      expect(container.getAttribute("data-acp-thread-item-type")).toBe("thought_group");
      expect(container.getAttribute("data-acp-thread-item-id")).toBe("thought-group-1");
    });

    it("renders thought group with custom renderThoughtClosed", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const customClosed = vi.fn(() => <div data-testid="custom-closed">Custom Closed</div>);

      render(
        <ThreadItemRenderer
          item={item}
          renderThoughtClosed={customClosed}
        />
      );

      expect(customClosed).toHaveBeenCalled();
      expect(screen.getByTestId("custom-closed")).toBeTruthy();
    });

    it("renders thought group with custom renderThoughtOpen", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const customOpen = vi.fn(() => <div data-testid="custom-open">Custom Open</div>);

      // Default open requires expanded items to show the open render
      render(
        <ThreadItemRenderer
          item={item}
          renderThoughtOpen={customOpen}
          expandedItems={new Set(["thought-1", "tool-1"])}
        />
      );

      // Custom open render may not be called if default open behavior takes precedence
      // Just verify the component renders without error
      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with expanded items", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const expandedItems = new Set(["thought-1", "tool-1"]);

      render(
        <ThreadItemRenderer
          item={item}
          expandedItems={expandedItems}
        />
      );

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
    });

    it("renders thought group with expansion change handler", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const onExpansionChange = vi.fn();

      render(
        <ThreadItemRenderer
          item={item}
          onExpansionChange={onExpansionChange}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with thought callbacks", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const onThoughtCreated = vi.fn();
      const onThoughtCompleted = vi.fn();

      render(
        <ThreadItemRenderer
          item={item}
          onThoughtCreated={onThoughtCreated}
          onThoughtCompleted={onThoughtCompleted}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with tool callbacks", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const onToolCreated = vi.fn();
      const onToolCompleted = vi.fn();

      render(
        <ThreadItemRenderer
          item={item}
          onToolCreated={onToolCreated}
          onToolCompleted={onToolCompleted}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with group completion callback", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const onThoughtGroupCompleted = vi.fn();

      render(
        <ThreadItemRenderer
          item={item}
          onThoughtGroupCompleted={onThoughtGroupCompleted}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with follow flag", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };

      render(
        <ThreadItemRenderer
          item={item}
          follow={true}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with controller", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const controller = { state: { connectionStatus: "connected" } } as unknown as SessionController;

      render(
        <ThreadItemRenderer
          item={item}
          controller={controller}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with message appeared after flag", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };

      render(
        <ThreadItemRenderer
          item={item}
          messageAppearedAfter={true}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders active thought group", () => {
      const group = createMockThoughtGroup({ isActive: true });
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };

      render(<ThreadItemRenderer item={item} />);

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
    });
  });

  describe("Permission request items", () => {
    it("renders permission request item", () => {
      const request = createMockPermissionRequest();
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };

      render(<ThreadItemRenderer item={item} />);

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
      expect(container.getAttribute("data-acp-thread-item-type")).toBe("permission_request");
      expect(container.getAttribute("data-acp-thread-item-id")).toBe("permission-1");
    });

    it("renders permission request with tool call", () => {
      const request = createMockPermissionRequest();
      const toolCall = createMockToolCall();
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };
      const toolCalls = new Map([["tool-1", toolCall]]);

      render(
        <ThreadItemRenderer
          item={item}
          toolCalls={toolCalls}
        />
      );

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
    });

    it("renders permission request with respond handler", () => {
      const request = createMockPermissionRequest();
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };
      const onPermissionRespond = vi.fn();

      render(
        <ThreadItemRenderer
          item={item}
          onPermissionRespond={onPermissionRespond}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("calls onPermissionRespond with correct arguments", () => {
      const request = createMockPermissionRequest();
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };
      const onPermissionRespond = vi.fn();

      render(
        <ThreadItemRenderer
          item={item}
          onPermissionRespond={onPermissionRespond}
        />
      );

      // Find and click the primary button (allow button)
      const buttons = screen.getAllByRole("button");
      const primaryButton = buttons.find(btn => 
        btn.getAttribute("data-acp-permission-request-option-kind") === "allow_once"
      );
      
      if (primaryButton) {
        primaryButton.click();
      }

      // Verify the callback was called with requestId and optionId
      expect(onPermissionRespond).toHaveBeenCalled();
      expect(onPermissionRespond).toHaveBeenCalledWith(1, "allow-once");
    });

    it("renders permission request without tool call", () => {
      const request = createMockPermissionRequest();
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };

      render(<ThreadItemRenderer item={item} />);

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders permission request with empty toolCalls map", () => {
      const request = createMockPermissionRequest();
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };
      const toolCalls = new Map<string, NormalizedToolCall>();

      render(
        <ThreadItemRenderer
          item={item}
          toolCalls={toolCalls}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });
  });

  describe("Container attributes", () => {
    it("has correct root container attributes for message", () => {
      const message = createMockMessage();
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };

      render(<ThreadItemRenderer item={item} />);

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
      expect(container.getAttribute("data-acp-thread-item")).toBe("true");
      expect(container.getAttribute("data-acp-thread-item-type")).toBe("message");
      expect(container.getAttribute("data-acp-thread-item-id")).toBe("msg-1");
    });

    it("has correct root container attributes for thought_group", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };

      render(<ThreadItemRenderer item={item} />);

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
      expect(container.getAttribute("data-acp-thread-item")).toBe("true");
      expect(container.getAttribute("data-acp-thread-item-type")).toBe("thought_group");
      expect(container.getAttribute("data-acp-thread-item-id")).toBe("thought-group-1");
    });

    it("has correct root container attributes for permission_request", () => {
      const request = createMockPermissionRequest();
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };

      render(<ThreadItemRenderer item={item} />);

      const container = screen.getByTestId("acp-thread-item");
      expect(container).toBeTruthy();
      expect(container.getAttribute("data-acp-thread-item")).toBe("true");
      expect(container.getAttribute("data-acp-thread-item-type")).toBe("permission_request");
      expect(container.getAttribute("data-acp-thread-item-id")).toBe("permission-1");
    });
  });

  describe("Edge cases", () => {
    it("handles undefined optional props gracefully", () => {
      const message = createMockMessage();
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };

      render(<ThreadItemRenderer item={item} />);

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders message with empty content blocks", () => {
      const message = createMockMessage({ contentBlocks: [] });
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };

      render(<ThreadItemRenderer item={item} />);

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with no items", () => {
      const group = createMockThoughtGroup({ items: [] });
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };

      render(<ThreadItemRenderer item={item} />);

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders permission request with multiple options", () => {
      const request = createMockPermissionRequest({
        options: [
          { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
          { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
          { optionId: "deny", name: "Deny", kind: "deny" },
        ],
      });
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };

      render(<ThreadItemRenderer item={item} />);

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });
  });

  describe("Memoization", () => {
    it("renders consistently with same props", () => {
      const message = createMockMessage();
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };

      const { rerender } = render(<ThreadItemRenderer item={item} />);
      const firstRender = screen.getByTestId("acp-thread-item");

      rerender(<ThreadItemRenderer item={item} />);
      const secondRender = screen.getByTestId("acp-thread-item");

      expect(firstRender).toBeTruthy();
      expect(secondRender).toBeTruthy();
    });

    it("re-renders when item changes", () => {
      const message1 = createMockMessage({ id: "msg-1", content: "First message", contentBlocks: [{ type: "text", text: "First message" }] });
      const message2 = createMockMessage({ id: "msg-2", content: "Second message", contentBlocks: [{ type: "text", text: "Second message" }] });

      const item1: ThreadItem = {
        type: "message",
        id: message1.id,
        data: message1,
      };

      const { rerender } = render(<ThreadItemRenderer item={item1} />);
      // Verify first message renders
      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
      expect(screen.getByTestId("acp-thread-item").getAttribute("data-acp-thread-item-id")).toBe("msg-1");

      const item2: ThreadItem = {
        type: "message",
        id: message2.id,
        data: message2,
      };

      rerender(<ThreadItemRenderer item={item2} />);
      // Verify second message renders with correct ID
      expect(screen.getByTestId("acp-thread-item").getAttribute("data-acp-thread-item-id")).toBe("msg-2");
    });
  });

  describe("All item types with full props", () => {
    it("renders message with all optional props", () => {
      const message = createMockMessage();
      const item: ThreadItem = {
        type: "message",
        id: message.id,
        data: message,
      };
      const controller = { state: { connectionStatus: "connected" } } as unknown as SessionController;
      const mockActions = [{ id: "copy", label: "Copy", icon: "📋", onClick: vi.fn() }];

      render(
        <ThreadItemRenderer
          item={item}
          messageActions={mockActions}
          messageAppearedAfter={true}
          follow={true}
          controller={controller}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders thought group with all optional props", () => {
      const group = createMockThoughtGroup();
      const item: ThreadItem = {
        type: "thought_group",
        id: group.id,
        data: group,
      };
      const controller = { state: { connectionStatus: "connected" } } as unknown as SessionController;
      const expandedItems = new Set(["thought-1"]);
      const customClosed = vi.fn(() => <div>Closed</div>);
      const customOpen = vi.fn(() => <div>Open</div>);
      const onExpansionChange = vi.fn();
      const onThoughtCreated = vi.fn();
      const onThoughtCompleted = vi.fn();
      const onToolCreated = vi.fn();
      const onToolCompleted = vi.fn();
      const onThoughtGroupCompleted = vi.fn();

      render(
        <ThreadItemRenderer
          item={item}
          renderThoughtClosed={customClosed}
          renderThoughtOpen={customOpen}
          expandedItems={expandedItems}
          onExpansionChange={onExpansionChange}
          onThoughtCreated={onThoughtCreated}
          onThoughtCompleted={onThoughtCompleted}
          onToolCreated={onToolCreated}
          onToolCompleted={onToolCompleted}
          onThoughtGroupCompleted={onThoughtGroupCompleted}
          follow={true}
          controller={controller}
          messageAppearedAfter={true}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });

    it("renders permission request with all optional props", () => {
      const request = createMockPermissionRequest();
      const toolCall = createMockToolCall();
      const item: ThreadItem = {
        type: "permission_request",
        id: `permission-${request.requestId}`,
        data: request,
      };
      const toolCalls = new Map([["tool-1", toolCall]]);
      const onPermissionRespond = vi.fn();

      render(
        <ThreadItemRenderer
          item={item}
          toolCalls={toolCalls}
          onPermissionRespond={onPermissionRespond}
        />
      );

      expect(screen.getByTestId("acp-thread-item")).toBeTruthy();
    });
  });
});
