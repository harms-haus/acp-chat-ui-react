import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PermissionRequestCard } from "./PermissionRequestCard.js";
import { createMockPermissionRequest, createMockToolCall } from "../test-utils/factories.js";
import type { NormalizedPermissionRequest, NormalizedToolCall } from "@harms-haus/acp-chat-core";

/**
 * Query helpers for PermissionRequestCard data attributes.
 * The component uses data-acp-* attributes directly, not data-testid.
 */
function getByPermissionRequestAttribute(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-acp-permission-request]')!;
}

function getByPermissionRequestCancelAttribute(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-acp-permission-request-cancel]')!;
}

function getByPermissionRequestKindIcon(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-acp-permission-request-kind-icon]')!;
}

function getByPermissionRequestKindLabel(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-acp-permission-request-kind-label]')!;
}

function getByPermissionRequestDetails(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-acp-permission-request-details]')!;
}

describe("PermissionRequestCard", () => {
  const createMockRequest = (overrides?: Partial<NormalizedPermissionRequest>): NormalizedPermissionRequest => {
    // Convert requestId to id for the factory
    const { requestId, ...rest } = overrides || {};
    return createMockPermissionRequest({ id: requestId, ...rest } as any);
  };

  const createMockTool = (overrides?: Partial<NormalizedToolCall>): NormalizedToolCall => {
    return createMockToolCall(overrides);
  };

  describe("rendering", () => {
    it("renders permission request card with basic props", () => {
      const request = createMockRequest({
        requestId: 1,
        sessionId: "session-123",
        toolCallId: "tool-456",
        status: "pending",
      });

      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute("data-acp-permission-request", "1");
      expect(card).toHaveAttribute("data-acp-permission-status", "pending");
      expect(card).toHaveAttribute("data-acp-tool-call-id", "tool-456");
    });

    it("applies custom className", () => {
      const request = createMockRequest();
      const { container } = render(
        <PermissionRequestCard
          request={request}
          onRespond={vi.fn()}
          className="custom-class"
        />
      );

      const card = getByPermissionRequestAttribute(container);
      expect(card).toHaveClass("custom-class");
    });

    it("renders with pending status", () => {
      const request = createMockRequest({ status: "pending" });
      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      expect(card).toHaveAttribute("data-acp-permission-status", "pending");
    });

    it("renders with approved status", () => {
      const request = createMockRequest({ status: "approved", selectedOptionId: "approve" });
      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      expect(card).toHaveAttribute("data-acp-permission-status", "approved");
    });

    it("renders with denied status", () => {
      const request = createMockRequest({ status: "denied", selectedOptionId: "deny" });
      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      expect(card).toHaveAttribute("data-acp-permission-status", "denied");
    });

    it("renders with cancelled status", () => {
      const request = createMockRequest({ status: "cancelled" });
      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      expect(card).toHaveAttribute("data-acp-permission-status", "cancelled");
    });
  });

  describe("permission options", () => {
    it("renders permission options as buttons", () => {
      const request = createMockRequest({
        options: [
          { optionId: "allow-once", name: "Allow Once", kind: "allow_once" },
          { optionId: "allow-always", name: "Always Allow", kind: "allow_always" },
          { optionId: "deny", name: "Deny", kind: "deny" },
        ],
      });

      render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Allow Once" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Always Allow" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument();
    });

    it("calls onRespond with optionId when option button is clicked", () => {
      const onRespond = vi.fn();
      const request = createMockRequest({
        options: [
          { optionId: "approve", name: "Approve", kind: "allow_once" },
          { optionId: "deny", name: "Deny", kind: "deny" },
        ],
      });

      render(<PermissionRequestCard request={request} onRespond={onRespond} />);

      const approveButton = screen.getByRole("button", { name: "Approve" });
      fireEvent.click(approveButton);

      expect(onRespond).toHaveBeenCalledTimes(1);
      expect(onRespond).toHaveBeenCalledWith("approve");
    });

    it("calls onRespond with correct optionId for deny button", () => {
      const onRespond = vi.fn();
      const request = createMockRequest({
        options: [
          { optionId: "approve", name: "Approve", kind: "allow_once" },
          { optionId: "deny", name: "Deny", kind: "deny" },
        ],
      });

      render(<PermissionRequestCard request={request} onRespond={onRespond} />);

      const denyButton = screen.getByRole("button", { name: "Deny" });
      fireEvent.click(denyButton);

      expect(onRespond).toHaveBeenCalledTimes(1);
      expect(onRespond).toHaveBeenCalledWith("deny");
    });

    it("calls onRespond for allow_always option", () => {
      const onRespond = vi.fn();
      const request = createMockRequest({
        options: [
          { optionId: "allow-always", name: "Always Allow", kind: "allow_always" },
        ],
      });

      render(<PermissionRequestCard request={request} onRespond={onRespond} />);

      const allowAlwaysButton = screen.getByRole("button", { name: "Always Allow" });
      fireEvent.click(allowAlwaysButton);

      expect(onRespond).toHaveBeenCalledWith("allow-always");
    });

    it("renders multiple options correctly", () => {
      const request = createMockRequest({
        options: [
          { optionId: "opt1", name: "Option 1", kind: "allow_once" },
          { optionId: "opt2", name: "Option 2", kind: "allow_always" },
          { optionId: "opt3", name: "Option 3", kind: "deny" },
          { optionId: "opt4", name: "Option 4", kind: "deny_session" },
        ],
      });

      render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Option 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Option 2" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Option 3" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Option 4" })).toBeInTheDocument();
    });
  });

  describe("cancel button", () => {
    it("renders cancel button when onCancel is provided", () => {
      const request = createMockRequest();
      const onCancel = vi.fn();

      const { container } = render(
        <PermissionRequestCard
          request={request}
          onRespond={vi.fn()}
          onCancel={onCancel}
        />
      );

      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      const cancelButton = getByPermissionRequestCancelAttribute(container);
      expect(cancelButton).toBeInTheDocument();
    });

    it("does not render cancel button when onCancel is not provided", () => {
      const request = createMockRequest();

      render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    });

    it("calls onCancel when cancel button is clicked", () => {
      const onCancel = vi.fn();
      const request = createMockRequest();

      render(
        <PermissionRequestCard
          request={request}
          onRespond={vi.fn()}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("tool call integration", () => {
    it("renders tool call kind badge with icon and label", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "read",
        title: "Read file",
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(getByPermissionRequestKindIcon(container)).toHaveTextContent("📖");
      expect(getByPermissionRequestKindLabel(container)).toHaveTextContent("Read");
    });

    it("renders tool call details for read kind", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "read",
        title: "Read file",
        rawInput: { filePath: "/path/to/file.txt" },
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(getByPermissionRequestDetails(container)).toHaveTextContent("/path/to/file.txt");
    });

    it("renders tool call details for write kind", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "write",
        title: "Write file",
        rawInput: { filePath: "/path/to/output.txt" },
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(getByPermissionRequestDetails(container)).toHaveTextContent("/path/to/output.txt");
    });

    it("renders tool call details for edit kind", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "edit",
        title: "Edit file",
        rawInput: { filePath: "/path/to/edit.txt" },
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(getByPermissionRequestDetails(container)).toHaveTextContent("/path/to/edit.txt");
    });

    it("renders tool call details for execute kind", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "execute",
        title: "Execute command",
        rawInput: { command: "npm install" },
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(getByPermissionRequestDetails(container)).toHaveTextContent("npm install");
    });

    it("renders tool call details for grep kind", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "grep",
        title: "Grep search",
        rawInput: { pattern: "TODO" },
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(getByPermissionRequestDetails(container)).toHaveTextContent("Pattern: TODO");
    });

    it("renders tool call details for search kind", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "search",
        title: "Search",
        rawInput: { filePath: "/search/path" },
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(getByPermissionRequestDetails(container)).toHaveTextContent("/search/path");
    });

    it("renders tool call details for glob kind", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "glob",
        title: "Glob pattern",
        rawInput: { filePath: "**/*.ts" },
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(getByPermissionRequestDetails(container)).toHaveTextContent("**/*.ts");
    });

    it("does not render details when rawInput is missing", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "read",
  title: "Read file",
  rawInput: {},
});

render(
  <PermissionRequestCard
    request={request}
    toolCall={toolCall}
    onRespond={vi.fn()}
  />
);

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("renders generic permission request header when toolCall is not provided", () => {
      const request = createMockRequest();

      render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      expect(screen.getByText("Permission Request")).toBeInTheDocument();
    });

    it("renders tool call title in kind badge", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "execute",
        title: "Run tests",
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      const kindLabel = getByPermissionRequestKindLabel(container);
      expect(kindLabel).toHaveTextContent("Execute");
    });
  });

  describe("tool call kinds", () => {
    it.each([
      ["read", "📖", "Read"],
      ["write", "✏️", "Write"],
      ["edit", "📝", "Edit"],
      ["execute", "⚡", "Execute"],
      ["search", "🔍", "Search"],
      ["glob", "🌐", "Glob"],
      ["grep", "🔎", "Grep"],
      ["unknown", "🔧", "Unknown"],
    ] as const)(
      "renders correct icon and label for %s kind",
      (kind, expectedIcon, expectedLabel) => {
        const request = createMockRequest();
        const toolCall = createMockTool({ kind, title: "Test" });

render(
          <PermissionRequestCard
            request={request}
            toolCall={toolCall}
            onRespond={vi.fn()}
          />
        );

        expect(getByPermissionRequestKindIcon(container)).toHaveTextContent(expectedIcon);
        expect(getByPermissionRequestKindLabel(container)).toHaveTextContent(expectedLabel);
      }
    );
  });

  describe("button variants", () => {
    it("renders primary variant for allow_once kind", () => {
      const request = createMockRequest({
        options: [{ optionId: "opt1", name: "Allow", kind: "allow_once" }],
      });

      render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const button = screen.getByRole("button", { name: "Allow" });
      expect(button).toHaveClass("acp-permission-request__button--primary");
    });

    it("renders primary variant for allow_always kind", () => {
      const request = createMockRequest({
        options: [{ optionId: "opt1", name: "Always Allow", kind: "allow_always" }],
      });

      render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const button = screen.getByRole("button", { name: "Always Allow" });
      expect(button).toHaveClass("acp-permission-request__button--primary");
    });

    it("renders secondary variant for deny kind", () => {
      const request = createMockRequest({
        options: [{ optionId: "opt1", name: "Deny", kind: "deny" }],
      });

      render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const button = screen.getByRole("button", { name: "Deny" });
      expect(button).toHaveClass("acp-permission-request__button--secondary");
    });

    it("renders secondary variant for unknown kind", () => {
      const request = createMockRequest({
        options: [{ optionId: "opt1", name: "Maybe", kind: "unknown" }],
      });

      render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const button = screen.getByRole("button", { name: "Maybe" });
      expect(button).toHaveClass("acp-permission-request__button--secondary");
    });

    it("renders cancel button with cancel variant", () => {
      const request = createMockRequest();

      render(
        <PermissionRequestCard
          request={request}
          onRespond={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton).toHaveClass("acp-permission-request__button--cancel");
    });
  });

  describe("accessibility", () => {
    it("has proper button types", () => {
      const request = createMockRequest({
        options: [
          { optionId: "approve", name: "Approve", kind: "allow_once" },
          { optionId: "deny", name: "Deny", kind: "deny" },
        ],
      });

      render(
        <PermissionRequestCard
          request={request}
          onRespond={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const approveButton = screen.getByRole("button", { name: "Approve" });
      const denyButton = screen.getByRole("button", { name: "Deny" });
      const cancelButton = screen.getByRole("button", { name: "Cancel" });

      expect(approveButton).toHaveAttribute("type", "button");
      expect(denyButton).toHaveAttribute("type", "button");
      expect(cancelButton).toHaveAttribute("type", "button");
    });

    it("has data attributes for testing", () => {
      const request = createMockRequest({
        requestId: 999,
        sessionId: "session-test",
        toolCallId: "tool-test",
        options: [{ optionId: "test-opt", name: "Test", kind: "allow_once" }],
      });

      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      expect(card).toHaveAttribute("data-acp-permission-request", "999");
      expect(card).toHaveAttribute("data-acp-permission-status");
      expect(card).toHaveAttribute("data-acp-tool-call-id", "tool-test");

      const optionButton = screen.getByRole("button", { name: "Test" });
      expect(optionButton).toHaveAttribute("data-acp-permission-request-option", "test-opt");
      expect(optionButton).toHaveAttribute("data-acp-permission-request-option-kind", "allow_once");
    });
  });

  describe("styling", () => {
    it("applies inline styles for card container", () => {
      const request = createMockRequest();

      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      expect(card).toHaveStyle("border-radius: var(--acp-radius-xl, 8px)");
      expect(card).toHaveStyle("padding: var(--acp-spacing-lg, 12px)");
    });

    it("applies inline styles for header", () => {
      const request = createMockRequest();

      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      const header = card.querySelector(".acp-permission-request__header");
      expect(header).toHaveStyle("margin-bottom: var(--acp-spacing-md, 8px)");
    });

    it("applies inline styles for options container", () => {
      const request = createMockRequest();

      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      const optionsContainer = card.querySelector(".acp-permission-request__options");
      expect(optionsContainer).toHaveStyle("display: flex");
      expect(optionsContainer).toHaveStyle("gap: var(--acp-spacing-sm, 4px)");
      expect(optionsContainer).toHaveStyle("flex-wrap: wrap");
    });
  });

  describe("edge cases", () => {
    it("handles empty options array", () => {
      const request = createMockRequest({ options: [] });

      const { container } = render(<PermissionRequestCard request={request} onRespond={vi.fn()} />);

      const card = getByPermissionRequestAttribute(container);
      expect(card).toBeInTheDocument();
    });

    it("handles tool call with empty rawInput", () => {
      const request = createMockRequest();
      const toolCall = createMockTool({
        kind: "read",
        rawInput: {},
      });

      const { container } = render(
        <PermissionRequestCard
          request={request}
          toolCall={toolCall}
          onRespond={vi.fn()}
        />
      );

      expect(container.querySelector('[data-acp-permission-request-details]')).not.toBeInTheDocument();
    });

    it("handles undefined toolCall", () => {
      const request = createMockRequest();

      const { container } = render(<PermissionRequestCard request={request} toolCall={undefined} onRespond={vi.fn()} />);

      expect(screen.getByText("Permission Request")).toBeInTheDocument();
      expect(container.querySelector('[data-acp-permission-request-kind-icon]')).not.toBeInTheDocument();
    });

    it("handles onCancel returning undefined", () => {
      const onCancel = vi.fn();
      const request = createMockRequest();

      render(
        <PermissionRequestCard
          request={request}
          onRespond={vi.fn()}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("component display name", () => {
    it("has correct display name", () => {
      expect(PermissionRequestCard.displayName).toBe("PermissionRequestCard");
    });
  });
});
