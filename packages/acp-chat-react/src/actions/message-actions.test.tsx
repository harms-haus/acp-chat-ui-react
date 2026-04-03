import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MessageActionBar } from "./MessageActionBar.js";
import { useMessageActions } from "./use-message-actions.js";
import type { MessageAction } from "./types.js";
import type { NormalizedMessage } from "@acp/chat-core";

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

const mockMessage: NormalizedMessage = {
  id: "msg-123",
  role: "user",
  status: "complete",
  content: "Test message content",
  contentBlocks: [{ type: "text", text: "Test message content" }],
  createdAt: Date.now(),
};

const mockActions: MessageAction[] = [
  {
    id: "copy",
    label: "Copy",
    onClick: vi.fn(),
  },
  {
    id: "reply",
    label: "Reply",
    onClick: vi.fn(),
  },
  {
    id: "forward",
    label: "Forward",
    onClick: vi.fn(),
    disabled: true,
  },
];

describe("useMessageActions", () => {
  it("should initialize with closed state", () => {
    const customActionsWithoutCopy: MessageAction[] = [
      { id: "reply", label: "Reply", onClick: vi.fn() },
      { id: "forward", label: "Forward", onClick: vi.fn(), disabled: true },
    ];
    const { result } = renderHook(() =>
      useMessageActions({ message: mockMessage, customActions: customActionsWithoutCopy })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.anchorElement).toBeNull();
    expect(result.current.actions.length).toBe(3);
  });

  it("should include copy action by default", () => {
    const { result } = renderHook(() =>
      useMessageActions({ message: mockMessage, customActions: [] })
    );

    const copyAction = result.current.actions.find((a) => a.id === "copy");
    expect(copyAction).toBeDefined();
    expect(copyAction?.label).toBe("Copy");
  });

  it("should combine copy action with custom actions", () => {
    const customActionsWithoutCopy: MessageAction[] = [
      { id: "reply", label: "Reply", onClick: vi.fn() },
      { id: "forward", label: "Forward", onClick: vi.fn(), disabled: true },
    ];
    const { result } = renderHook(() =>
      useMessageActions({ message: mockMessage, customActions: customActionsWithoutCopy })
    );

    expect(result.current.actions.length).toBe(3);
    expect(result.current.actions[0]?.id).toBe("copy");
    expect(result.current.actions[1]?.id).toBe("reply");
    expect(result.current.actions[2]?.id).toBe("forward");
  });

  it("should set isOpen state", () => {
    const { result } = renderHook(() =>
      useMessageActions({ message: mockMessage, customActions: mockActions })
    );

    act(() => {
      result.current.setIsOpen(true);
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.setIsOpen(false);
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("should set anchor element", () => {
    const { result } = renderHook(() =>
      useMessageActions({ message: mockMessage, customActions: mockActions })
    );

    const mockElement = document.createElement("div");
    act(() => {
      result.current.setAnchorElement(mockElement);
    });
    expect(result.current.anchorElement).toBe(mockElement);
  });
});

describe("MessageActionBar", () => {
  it("should render with data-acp-message-action-bar attribute", () => {
    const { container } = render(
      <MessageActionBar
        message={mockMessage}
        actions={mockActions}
      />
    );

    expect(container.querySelector("[data-acp-message-action-bar]")).not.toBeNull();
    expect(container.querySelector("[data-acp-message-id]")).toHaveAttribute("data-acp-message-id", "msg-123");
  });

  it("should render copy action button", () => {
    const { container } = render(
      <MessageActionBar
        message={mockMessage}
        actions={mockActions}
      />
    );

    const copyButton = container.querySelector("[data-acp-message-action-id='copy']");
    expect(copyButton).not.toBeNull();
  });

  it("should render actions menu trigger when custom actions exist", () => {
    const { container } = render(
      <MessageActionBar
        message={mockMessage}
        actions={mockActions}
      />
    );

    const menuTrigger = container.querySelector("[data-acp-message-action-menu-trigger]");
    expect(menuTrigger).not.toBeNull();
  });

  it("should not render actions menu when no custom actions", () => {
    const { container } = render(
      <MessageActionBar
        message={mockMessage}
        actions={[]}
      />
    );

    const menuTrigger = container.querySelector("[data-acp-message-action-menu-trigger]");
    expect(menuTrigger).toBeNull();
  });

  it("should call onCopy when copy button is clicked", async () => {
    const onCopy = vi.fn();
    const { container } = render(
      <MessageActionBar
        message={mockMessage}
        actions={mockActions}
        onCopy={onCopy}
      />
    );

    const actionBar = container.querySelector("[data-acp-message-action-bar]");
    expect(actionBar).not.toBeNull();

    fireEvent.mouseEnter(actionBar!);

    const copyButton = container.querySelector("[data-acp-message-action-id='copy']");
    expect(copyButton).not.toBeNull();

    fireEvent.click(copyButton!);

    await waitFor(() => {
      expect(onCopy).toHaveBeenCalledWith(mockMessage);
    });
  });

  it("should show action bar on hover", () => {
    const { container } = render(
      <MessageActionBar
        message={mockMessage}
        actions={mockActions}
      />
    );

    const actionBar = container.querySelector("[data-acp-message-action-bar]");
    expect(actionBar).not.toBeNull();

    fireEvent.mouseEnter(actionBar!);
    expect((actionBar as HTMLElement).style.opacity).toBe("1");

    fireEvent.mouseLeave(actionBar!);
    expect((actionBar as HTMLElement).style.opacity).toBe("0");
  });

  it("should render disabled state for disabled actions", () => {
    const { container } = render(
      <MessageActionBar
        message={mockMessage}
        actions={mockActions}
      />
    );

    const actionBar = container.querySelector("[data-acp-message-action-bar]");
    expect(actionBar).not.toBeNull();

    fireEvent.mouseEnter(actionBar!);
  });
});
