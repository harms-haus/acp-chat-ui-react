import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, fireEvent, act, waitFor } from "@testing-library/react";
import { Thread } from "./Thread.js";
import { customRender } from "../test-utils/render.js";
import { mockChatCore } from "../test-utils/mocks.js";
import {
  createMockMessage,
  createMockThought,
  createMockToolCall,
  createMockPermissionRequest,
} from "../test-utils/factories.js";
import type { NormalizedMessage } from "@harms-haus/acp-chat-core";

// Mock useVirtualizer to return all items (disable virtualization in tests)
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn((options) => {
    const virtualItems = Array.from({ length: options.count }, (_, index) => ({
      index,
      key: options.getItemKey?.(index) ?? `item-${index}`,
      start: index * (options.estimateSize?.(index) ?? 50),
      size: options.estimateSize?.(index) ?? 50,
      end: (index + 1) * (options.estimateSize?.(index) ?? 50),
      measureElement: vi.fn(),
    }));

    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => virtualItems.length * (options.estimateSize?.(0) ?? 50),
      scrollToIndex: vi.fn(),
      measureElement: vi.fn(),
      virtualItems,
    };
  }),
}));

const originalResizeObserver = global.ResizeObserver;
const originalScrollTo = Element.prototype.scrollTo;
const originalScrollIntoView = Element.prototype.scrollIntoView;
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

class MockResizeObserver {
  constructor(private callback: (entries: any[]) => void) {}
  observe = vi.fn((element: Element) => {
    this.callback([{
      target: element,
      contentRect: {
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      },
    }]);
  });
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe("Thread", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.getBoundingClientRect = function() {
      const rect = originalGetBoundingClientRect.call(this);
      if (this.getAttribute('data-acp-thread-scroll-viewport') ||
          this.getAttribute('data-acp-thread-scroll-content')) {
        return {
          ...rect,
          width: 800,
          height: 600,
          top: 0,
          left: 0,
          bottom: 600,
          right: 800,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      }
      return rect;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    global.ResizeObserver = originalResizeObserver;
    Element.prototype.scrollTo = originalScrollTo;
    Element.prototype.scrollIntoView = originalScrollIntoView;
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  describe("Basic Rendering", () => {
    it("renders Thread with empty state when no messages", () => {
      const controller = mockChatCore({
        connectionStatus: "disconnected",
        bridgeStatus: "disconnected",
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      expect(screen.getByText(/No messages yet|Connect to a session/i)).toBeTruthy();
      expect(document.querySelector("[data-acp-thread-empty]")).toBeTruthy();
    });

    it("renders Thread with connected empty state message", () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      expect(screen.getByText("No messages yet - waiting for session updates...")).toBeTruthy();
    });

    it("renders Thread with disconnected empty state message", () => {
      const controller = mockChatCore({
        connectionStatus: "disconnected",
        bridgeStatus: "disconnected",
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      expect(screen.getByText("Connect to a session to view messages")).toBeTruthy();
    });

    it("renders with custom emptyState prop", () => {
      const controller = mockChatCore();
      const customEmpty = <div data-testid="custom-empty">Custom empty state</div>;

      customRender(
        <Thread store={null as any} emptyState={customEmpty} />,
        { sessionController: controller as any }
      );

      expect(screen.getByTestId("custom-empty")).toBeTruthy();
    });

    it("renders Thread container with correct class", () => {
      const controller = mockChatCore();
      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const thread = document.querySelector("[data-acp-thread]");
      expect(thread).toBeTruthy();
    });
  });

  describe("Layout Prop", () => {
    it("renders with centered layout (default)", () => {
      const controller = mockChatCore();
      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const thread = document.querySelector(".acp-thread--centered");
      expect(thread).toBeTruthy();
    });

    it("renders with centered layout when explicitly set", () => {
      const controller = mockChatCore();
      customRender(
        <Thread store={null as any} layout="centered" />,
        { sessionController: controller as any }
      );

      const thread = document.querySelector(".acp-thread--centered");
      expect(thread).toBeTruthy();
    });

    it("renders with expanded layout", () => {
      const controller = mockChatCore();
      customRender(
        <Thread store={null as any} layout="expanded" />,
        { sessionController: controller as any }
      );

      const thread = document.querySelector(".acp-thread--expanded");
      expect(thread).toBeTruthy();
    });
  });

  describe("followScroll Prop", () => {
    it("respects followScroll=true (default)", () => {
      const controller = mockChatCore();
      customRender(<Thread store={null as any} followScroll={true} />, { sessionController: controller as any });

      const thread = document.querySelector("[data-acp-thread]");
      expect(thread).toBeTruthy();
    });

    it("respects followScroll=false", () => {
      const controller = mockChatCore();
      customRender(<Thread store={null as any} followScroll={false} />, { sessionController: controller as any });

      const thread = document.querySelector("[data-acp-thread]");
      expect(thread).toBeTruthy();
    });
  });

  describe("Rendering Messages", () => {
    it("renders user messages", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const { store: _store } = customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const userMessage = createMockMessage({
        role: "user",
        content: "Hello from user",
      });

      await act(async () => {
        controller.emitSessionUpdate({
          messages: [userMessage],
        });
      });

      // Force virtualizer to recalculate by firing scroll event
      await act(async () => {
        const viewport = document.querySelector('[data-acp-thread-scroll-viewport]');
        if (viewport) {
          viewport.dispatchEvent(new Event('scroll'));
        }
      });

      const _timeline = store.getTimeline();

      await waitFor(() => {
        expect(screen.getByText("Hello from user")).toBeTruthy();
      });
    });

    it("renders agent messages", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const { store: _store } = customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const agentMessage = createMockMessage({
        role: "agent",
        content: "Hello from agent",
      });

      controller.emitSessionUpdate({
        messages: [agentMessage],
      });

      await waitFor(() => {
        expect(screen.getByText("Hello from agent")).toBeTruthy();
      });
    });

    it("renders multiple messages", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const { store: _store } = customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const messages: NormalizedMessage[] = [
        createMockMessage({ role: "user", content: "First message" }),
        createMockMessage({ role: "agent", content: "Second message" }),
        createMockMessage({ role: "user", content: "Third message" }),
      ];

      controller.emitSessionUpdate({
        messages,
      });

      await waitFor(() => {
        expect(screen.getByText("First message")).toBeTruthy();
        expect(screen.getByText("Second message")).toBeTruthy();
        expect(screen.getByText("Third message")).toBeTruthy();
      });
    });
  });

  describe("Rendering Thought Groups", () => {
    it("renders thought groups with thoughts", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const { store: _store } = customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const thought = createMockThought({
        content: "Thinking about the solution...",
      });

      await act(async () => {
        controller.emitSessionUpdate({
          thoughts: [thought],
        });
      });

      const _timeline = store.getTimeline();

      await waitFor(() => {
        const thoughtElement = document.querySelector("[data-acp-thought-root]");
        expect(thoughtElement).toBeTruthy();
      });
    });

    it.skip("renders multiple thoughts in a group", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const thoughts = [
        createMockThought({ content: "First thought" }),
        createMockThought({ content: "Second thought" }),
      ];

      controller.emitSessionUpdate({
        thoughts,
      });

      await waitFor(() => {
        expect(screen.getByText("First thought")).toBeTruthy();
        expect(screen.getByText("Second thought")).toBeTruthy();
      });
    });

    it("passes follow prop to thought groups", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(
        <Thread store={null as any} follow={true} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({ content: "Test thought" });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        const thoughtElement = document.querySelector("[data-acp-thought-root]");
        expect(thoughtElement).toBeTruthy();
      });
    });
  });

  describe("Rendering Tool Calls", () => {
    it.skip("renders tool calls", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const toolCall = createMockToolCall({
        kind: "read",
        title: "Reading file",
        status: "completed",
      });

      controller.emitSessionUpdate({
        toolCalls: [toolCall],
      });

      await waitFor(() => {
        const toolElement = document.querySelector("[data-acp-tool-call]");
        expect(toolElement).toBeTruthy();
      });
    });

    it.skip("renders tool calls with different kinds", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const toolCalls = [
        createMockToolCall({ kind: "read", title: "Read operation" }),
        createMockToolCall({ kind: "search", title: "Search operation" }),
        createMockToolCall({ kind: "edit", title: "Edit operation" }),
      ];

      controller.emitSessionUpdate({
        toolCalls,
      });

      await waitFor(() => {
        expect(screen.getByText("Read operation")).toBeTruthy();
        expect(screen.getByText("Search operation")).toBeTruthy();
        expect(screen.getByText("Edit operation")).toBeTruthy();
      });
    });

    it.skip("renders tool calls with different statuses", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const pendingTool = createMockToolCall({
        kind: "execute",
        title: "Executing",
        status: "pending",
      });
      const inProgressTool = createMockToolCall({
        kind: "execute",
        title: "Running",
        status: "in_progress",
      });
      const completedTool = createMockToolCall({
        kind: "execute",
        title: "Finished",
        status: "completed",
      });

      controller.emitSessionUpdate({
        toolCalls: [pendingTool, inProgressTool, completedTool],
      });

      await waitFor(() => {
        expect(screen.getByText("Executing")).toBeTruthy();
        expect(screen.getByText("Running")).toBeTruthy();
        expect(screen.getByText("Finished")).toBeTruthy();
      });
    });
  });

  describe("Permission Requests", () => {
    it("renders pending permission requests", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const permissionRequest = createMockPermissionRequest({
        sessionId: "test-session",
        toolCallId: "tool-123",
        status: "pending",
      });

      controller.emitSessionUpdate({
        permissionRequests: [permissionRequest],
      });

      await waitFor(() => {
        const permissionElement = document.querySelector("[data-acp-permission-request]");
        expect(permissionElement).toBeTruthy();
      });
    });

    it("calls onPermissionRespond when responding to permission request", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const mockRespond = vi.fn();

      customRender(
        <Thread store={null as any} onPermissionRespond={mockRespond} />,
        { sessionController: controller as any }
      );

      const permissionRequest = createMockPermissionRequest({
        sessionId: "test-session",
        toolCallId: "tool-123",
        status: "pending",
        options: [
          { optionId: "approve", name: "Approve", kind: "allow_once" },
          { optionId: "deny", name: "Deny", kind: "deny" },
        ],
      });

      controller.emitSessionUpdate({
        permissionRequests: [permissionRequest],
      });

      await waitFor(() => {
        const approveButton = screen.getByRole("button", { name: /approve/i });
        expect(approveButton).toBeTruthy();
      });

      const approveButton = screen.getByRole("button", { name: /approve/i });
      fireEvent.click(approveButton);

      expect(mockRespond).toHaveBeenCalledWith(permissionRequest.requestId, "approve");
    });
  });

  describe("Message Actions", () => {
    it("renders message actions when provided", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const message = createMockMessage({ content: "Test message" });
      const mockAction = {
        id: "copy",
        label: "Copy",
        icon: <span>📋</span>,
        onClick: vi.fn(),
      };

      controller.emitSessionUpdate({
        messages: [message],
      });

      customRender(
        <Thread store={null as any} messageActions={[mockAction]} />,
        { sessionController: controller as any }
      );

      await waitFor(() => {
        expect(screen.getByText("Test message")).toBeTruthy();
      });
    });
  });

  describe("Thought Rendering Props", () => {
    it("accepts renderThoughtClosed prop", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(
        <Thread store={null as any} renderThoughtClosed={vi.fn(() => <div data-testid="custom-closed">Closed</div>)} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({ content: "Test thought" });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        expect(screen.queryByText("Closed")).toBeTruthy();
      });
    });

    it.skip("accepts renderThoughtOpen prop", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(
        <Thread store={null as any} renderThoughtOpen={vi.fn(() => <div data-testid="custom-open">Open</div>)} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({ content: "Test thought" });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        expect(screen.queryByText("Open")).toBeTruthy();
      });
    });
  });

  describe("Expansion Control", () => {
    it("accepts expandedItems prop", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const expandedItems = new Set(["thought-1"]);

      customRender(
        <Thread store={null as any} expandedItems={expandedItems} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({ content: "Expandable thought", id: "thought-1" });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        const thoughtElement = document.querySelector("[data-acp-thought-root]");
        expect(thoughtElement).toBeTruthy();
      });
    });

    it.skip("calls onExpansionChange when expansion changes", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const mockExpansionChange = vi.fn();

      customRender(
        <Thread store={null as any} onExpansionChange={mockExpansionChange} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({ content: "Expandable thought", id: "thought-1" });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        const thoughtElement = document.querySelector("[data-acp-thought-root]");
        expect(thoughtElement).toBeTruthy();
      });

      const expandButton = screen.getByRole("button", { name: /thinking/i });
      fireEvent.click(expandButton);

      expect(mockExpansionChange).toHaveBeenCalled();
    });
  });

  describe("Callback Props", () => {
    it.skip("calls onThoughtCreated when thought is created", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const mockThoughtCreated = vi.fn();

      customRender(
        <Thread store={null as any} onThoughtCreated={mockThoughtCreated} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({ content: "New thought", id: "thought-new" });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        expect(screen.getByText("New thought")).toBeTruthy();
      });

      expect(mockThoughtCreated).toHaveBeenCalled();
    });

    it.skip("calls onThoughtCompleted when thought completes", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const mockThoughtCompleted = vi.fn();

      customRender(
        <Thread store={null as any} onThoughtCompleted={mockThoughtCompleted} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({
        content: "Completed thought",
        status: "completed",
        id: "thought-complete",
      });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        expect(screen.getByText("Completed thought")).toBeTruthy();
      });
    });

    it.skip("calls onToolCreated when tool is created", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const mockToolCreated = vi.fn();

      customRender(
        <Thread store={null as any} onToolCreated={mockToolCreated} />,
        { sessionController: controller as any }
      );

      const toolCall = createMockToolCall({
        kind: "read",
        title: "New tool",
        toolCallId: "tool-new",
      });

      controller.emitSessionUpdate({
        toolCalls: [toolCall],
      });

      await waitFor(() => {
        const toolElement = document.querySelector("[data-acp-tool-call]");
        expect(toolElement).toBeTruthy();
      });
    });

    it.skip("calls onToolCompleted when tool completes", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const mockToolCompleted = vi.fn();

      customRender(
        <Thread store={null as any} onToolCompleted={mockToolCompleted} />,
        { sessionController: controller as any }
      );

      const toolCall = createMockToolCall({
        kind: "search",
        title: "Completed tool",
        status: "completed",
        toolCallId: "tool-done",
      });

      controller.emitSessionUpdate({
        toolCalls: [toolCall],
      });

      await waitFor(() => {
        expect(screen.getByText("Completed tool")).toBeTruthy();
      });
    });

    it.skip("calls onThoughtGroupCompleted when group completes", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const mockGroupCompleted = vi.fn();

      customRender(
        <Thread store={null as any} onThoughtGroupCompleted={mockGroupCompleted} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({ content: "Group thought" });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        expect(screen.getByText("Group thought")).toBeTruthy();
      });
    });
  });

  describe("Session Clearing and Follow Behavior", () => {
    it("listens to sessionClearing event from controller", () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      const emitSpy = vi.spyOn(controller, "on");

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      expect(emitSpy).toHaveBeenCalledWith("sessionClearing", expect.any(Function));
    });

    it.skip("handles follow prop for new thought groups", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(
        <Thread store={null as any} follow={true} />,
        { sessionController: controller as any }
      );

      const thought = createMockThought({ content: "Follow thought" });

      controller.emitSessionUpdate({
        thoughts: [thought],
      });

      await waitFor(() => {
        expect(screen.getByText("Follow thought")).toBeTruthy();
      });
    });
  });

  describe("Mixed Content Types", () => {
    it.skip("renders mixed content: messages, thoughts, and tool calls", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const message = createMockMessage({ role: "user", content: "User message" });
      const thought = createMockThought({ content: "Agent thinking" });
      const toolCall = createMockToolCall({ kind: "read", title: "Reading file" });

      controller.emitSessionUpdate({
        messages: [message],
        thoughts: [thought],
        toolCalls: [toolCall],
      });

      await waitFor(() => {
        expect(screen.getByText("User message")).toBeTruthy();
        expect(screen.getByText("Agent thinking")).toBeTruthy();
        expect(screen.getByText("Reading file")).toBeTruthy();
      });
    });

    it.skip("renders thought groups before messages correctly", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const thought = createMockThought({ content: "Thought before message" });
      const message = createMockMessage({ role: "agent", content: "Message after thought" });

      controller.emitSessionUpdate({
        thoughts: [thought],
        messages: [message],
      });

      await waitFor(() => {
        expect(screen.getByText("Thought before message")).toBeTruthy();
        expect(screen.getByText("Message after thought")).toBeTruthy();
      });
    });
  });

  describe("Styling Props", () => {
    it("accepts className prop", () => {
      const controller = mockChatCore();
      customRender(
        <Thread store={null as any} className="custom-class" />,
        { sessionController: controller as any }
      );

      const thread = document.querySelector(".custom-class");
      expect(thread).toBeTruthy();
    });

    it("accepts estimatedRowHeight prop", () => {
      const controller = mockChatCore();
      customRender(
        <Thread store={null as any} estimatedRowHeight={80} />,
        { sessionController: controller as any }
      );

      const thread = document.querySelector("[data-acp-thread]");
      expect(thread).toBeTruthy();
    });

    it("accepts rowGap prop", () => {
      const controller = mockChatCore();
      customRender(
        <Thread store={null as any} rowGap={16} />,
        { sessionController: controller as any }
      );

      const thread = document.querySelector("[data-acp-thread]");
      expect(thread).toBeTruthy();
    });

    it("accepts padding prop", () => {
      const controller = mockChatCore();
      customRender(
        <Thread store={null as any} padding={24} />,
        { sessionController: controller as any }
      );

      const thread = document.querySelector("[data-acp-thread]");
      expect(thread).toBeTruthy();
    });

    it("accepts scrollThreshold prop", () => {
      const controller = mockChatCore();
      customRender(
        <Thread store={null as any} scrollThreshold={200} />,
        { sessionController: controller as any }
      );

      const thread = document.querySelector("[data-acp-thread]");
      expect(thread).toBeTruthy();
    });
  });

  describe("Data Attributes", () => {
    it("renders thread with data-acp-thread attribute", () => {
      const controller = mockChatCore();
      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const thread = document.querySelector("[data-acp-thread]");
      expect(thread).toBeTruthy();
    });

    it("renders thread items with data-acp-thread-item attribute", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const message = createMockMessage({ content: "Test" });

      controller.emitSessionUpdate({
        messages: [message],
      });

      await waitFor(() => {
        const item = document.querySelector("[data-acp-thread-item]");
        expect(item).toBeTruthy();
      });
    });

    it("renders thread items with data-acp-thread-item-type attribute", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const message = createMockMessage({ content: "Test" });

      controller.emitSessionUpdate({
        messages: [message],
      });

      await waitFor(() => {
        const item = document.querySelector("[data-acp-thread-item-type='message']");
        expect(item).toBeTruthy();
      });
    });

    it.skip("renders thread items with data-acp-thread-item-id attribute", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const message = createMockMessage({ id: "msg-test-123", content: "Test" });

      controller.emitSessionUpdate({
        messages: [message],
      });

      await waitFor(() => {
        const item = document.querySelector("[data-acp-thread-item-id='msg-test-123']");
        expect(item).toBeTruthy();
      });
    });
  });

  describe("Timeline Items Processing", () => {
    it("filters out completed permission requests", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const completedPermission = createMockPermissionRequest({
        sessionId: "test-session",
        toolCallId: "tool-123",
        status: "approved",
      });

      const message = createMockMessage({ content: "After permission" });

      controller.emitSessionUpdate({
        permissionRequests: [completedPermission],
        messages: [message],
      });

      await waitFor(() => {
        expect(screen.getByText("After permission")).toBeTruthy();
        const pendingPermission = document.querySelector(
          "[data-acp-permission-request]"
        );
        expect(pendingPermission).toBeFalsy();
      });
    });

    it.skip("groups consecutive thoughts", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const thought1 = createMockThought({ content: "First thought", id: "t1" });
      const thought2 = createMockThought({ content: "Second thought", id: "t2" });

      controller.emitSessionUpdate({
        thoughts: [thought1, thought2],
      });

      await waitFor(() => {
        expect(screen.getByText("First thought")).toBeTruthy();
        expect(screen.getByText("Second thought")).toBeTruthy();
      });
    });

    it.skip("groups consecutive tool calls", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const tool1 = createMockToolCall({ kind: "read", title: "Tool 1", toolCallId: "tc1" });
      const tool2 = createMockToolCall({ kind: "search", title: "Tool 2", toolCallId: "tc2" });

      controller.emitSessionUpdate({
        toolCalls: [tool1, tool2],
      });

      await waitFor(() => {
        expect(screen.getByText("Tool 1")).toBeTruthy();
        expect(screen.getByText("Tool 2")).toBeTruthy();
      });
    });

    it.skip("separates thoughts/tools with messages into different groups", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const thought = createMockThought({ content: "Before message" });
      const message = createMockMessage({ content: "Middle message" });
      const tool = createMockToolCall({ kind: "read", title: "After message", toolCallId: "tc-after" });

      controller.emitSessionUpdate({
        thoughts: [thought],
        messages: [message],
        toolCalls: [tool],
      });

      await waitFor(() => {
        expect(screen.getByText("Before message")).toBeTruthy();
        expect(screen.getByText("Middle message")).toBeTruthy();
        expect(screen.getByText("After message")).toBeTruthy();
      });
    });
  });

  describe("Pending Permission Tool Calls", () => {
    it.skip("filters out tool calls that have pending permission requests", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const permissionToolId = "tool-with-permission";
      const pendingPermission = createMockPermissionRequest({
        sessionId: "test-session",
        toolCallId: permissionToolId,
        status: "pending",
      });

      const toolWithPermission = createMockToolCall({
        kind: "execute",
        title: "Waiting for permission",
        toolCallId: permissionToolId,
        status: "pending",
      });

      const otherTool = createMockToolCall({
        kind: "read",
        title: "Other tool",
        toolCallId: "other-tool",
        status: "completed",
      });

      controller.emitSessionUpdate({
        permissionRequests: [pendingPermission],
        toolCalls: [toolWithPermission, otherTool],
      });

      await waitFor(() => {
        expect(screen.getByText("Other tool")).toBeTruthy();
      });
    });
  });

  describe("Re-rendering and Updates", () => {
    it("re-renders when new messages arrive", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const initialMessage = createMockMessage({ content: "Initial message" });

      controller.emitSessionUpdate({
        messages: [initialMessage],
      });

      await waitFor(() => {
        expect(screen.getByText("Initial message")).toBeTruthy();
      });

      const newMessage = createMockMessage({ content: "New message" });
      controller.emitSessionUpdate({
        messages: [initialMessage, newMessage],
      });

      await waitFor(() => {
        expect(screen.getByText("New message")).toBeTruthy();
      });
    });

    it.skip("re-renders when thoughts are added", async () => {
      const controller = mockChatCore({
        connectionStatus: "connected",
        bridgeStatus: "connected",
        initialized: true,
      });

      customRender(<Thread store={null as any} />, { sessionController: controller as any });

      const initialThought = createMockThought({ content: "Initial thought" });

      controller.emitSessionUpdate({
        thoughts: [initialThought],
      });

      await waitFor(() => {
        expect(screen.getByText("Initial thought")).toBeTruthy();
      });

      const newThought = createMockThought({ content: "New thought" });
      controller.emitSessionUpdate({
        thoughts: [initialThought, newThought],
      });

      await waitFor(() => {
        expect(screen.getByText("New thought")).toBeTruthy();
      });
    });
  });
});
