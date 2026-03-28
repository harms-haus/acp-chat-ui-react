import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  shouldSendOnKeydown,
  canSend,
  canStop,
  getSendText,
  isSendButtonDisabled,
  startPrompt,
  completePrompt,
  cancelPrompt,
  isPromptActive,
  shouldShowStopButton,
} from "./composer-logic.js";
import { Composer } from "./Composer.js";
import type { AcpStore, AcpStoreSnapshot } from "../store/index.js";
import type { SessionController, SessionControllerState } from "@acp/chat-core";

describe("composer-logic", () => {
  describe("shouldSendOnKeydown", () => {
    it("returns true for Enter without Shift", () => {
      expect(shouldSendOnKeydown("Enter", false, false)).toBe(true);
    });

    it("returns false for Enter with Shift", () => {
      expect(shouldSendOnKeydown("Enter", true, false)).toBe(false);
    });

    it("returns false for other keys", () => {
      expect(shouldSendOnKeydown("Escape", false, false)).toBe(false);
      expect(shouldSendOnKeydown("Tab", false, false)).toBe(false);
    });

    it("returns false when composing", () => {
      expect(shouldSendOnKeydown("Enter", false, true)).toBe(false);
    });
  });

  describe("canSend", () => {
    it("returns true when value is non-empty, not disabled, and not streaming", () => {
      const state = { value: "Hello", disabled: false, isStreaming: false, isComposing: false };
      expect(canSend(state)).toBe(true);
    });

    it("returns false when value is empty", () => {
      const state = { value: "", disabled: false, isStreaming: false, isComposing: false };
      expect(canSend(state)).toBe(false);
    });

    it("returns false when value is whitespace only", () => {
      const state = { value: "   ", disabled: false, isStreaming: false, isComposing: false };
      expect(canSend(state)).toBe(false);
    });

    it("returns false when disabled", () => {
      const state = { value: "Hello", disabled: true, isStreaming: false, isComposing: false };
      expect(canSend(state)).toBe(false);
    });

    it("returns false when streaming", () => {
      const state = { value: "Hello", disabled: false, isStreaming: true, isComposing: false };
      expect(canSend(state)).toBe(false);
    });
  });

  describe("canStop", () => {
    it("returns true when streaming", () => {
      expect(canStop(true)).toBe(true);
    });

    it("returns false when not streaming", () => {
      expect(canStop(false)).toBe(false);
    });
  });

  describe("getSendText", () => {
    it("returns trimmed text", () => {
      expect(getSendText("  Hello World  ")).toBe("Hello World");
    });

    it("returns empty string for whitespace only", () => {
      expect(getSendText("   ")).toBe("");
    });
  });

  describe("isSendButtonDisabled", () => {
    it("returns true when value is empty", () => {
      expect(isSendButtonDisabled("", false)).toBe(true);
    });

    it("returns true when value is whitespace only", () => {
      expect(isSendButtonDisabled("   ", false)).toBe(true);
    });

    it("returns true when disabled", () => {
      expect(isSendButtonDisabled("Hello", true)).toBe(true);
    });

    it("returns false when value is non-empty and not disabled", () => {
      expect(isSendButtonDisabled("Hello", false)).toBe(false);
    });
  });

  describe("prompt lifecycle", () => {
    it("startPrompt creates active state", () => {
      const state = startPrompt("turn-123");
      expect(state.phase).toBe("active");
      expect(state.turnId).toBe("turn-123");
    });

    it("completePrompt creates complete state", () => {
      const state = completePrompt();
      expect(state.phase).toBe("complete");
    });

    it("cancelPrompt creates cancelled state", () => {
      const state = cancelPrompt();
      expect(state.phase).toBe("cancelled");
    });

    it("isPromptActive returns true for active phase", () => {
      expect(isPromptActive(startPrompt())).toBe(true);
      expect(isPromptActive(completePrompt())).toBe(false);
      expect(isPromptActive(cancelPrompt())).toBe(false);
    });

    it("shouldShowStopButton returns true when prompt is active", () => {
      const activeState = startPrompt();
      expect(shouldShowStopButton(activeState)).toBe(true);
    });

    it("shouldShowStopButton returns true when last item is streaming", () => {
      const completeState = completePrompt();
      const streamingItem = { type: "message", status: "streaming" };
      expect(shouldShowStopButton(completeState, streamingItem)).toBe(true);
    });

    it("shouldShowStopButton returns false when not active and no streaming item", () => {
      const completeState = completePrompt();
      expect(shouldShowStopButton(completeState)).toBe(false);
    });
  });
});

function createMockStore(overrides: Partial<SessionControllerState> = {}): AcpStore {
  const sessionState: SessionControllerState = {
    connectionStatus: "connected",
    bridgeStatus: "ready",
    sessionId: "test-session-123",
    initialized: true,
    capabilities: null,
    ...overrides,
  };

  const snapshot: AcpStoreSnapshot = {
    session: sessionState,
    messages: new Map(),
    thoughts: new Map(),
    toolCalls: new Map(),
    timelineOrder: [],
    turnIdToMessageId: new Map(),
    version: 0,
  };

  return {
    getSessionState: () => sessionState,
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    getServerSnapshot: () => snapshot,
  } as unknown as AcpStore;
}

function createMockController(): SessionController {
  return {
    sendPrompt: vi.fn().mockResolvedValue(undefined),
    cancelPrompt: vi.fn().mockResolvedValue(undefined),
    getState: () => ({
      connectionStatus: "connected",
      bridgeStatus: "ready",
      sessionId: "test-session-123",
      initialized: true,
      capabilities: null,
    }),
    on: () => () => {},
  } as unknown as SessionController;
}

describe("Composer Component", () => {
  let mockStore: AcpStore;
  let mockController: SessionController;

  beforeEach(() => {
    mockStore = createMockStore();
    mockController = createMockController();
  });

  it("renders with correct data attributes", () => {
    render(
      <Composer
        store={mockStore}
        controller={mockController}
        placeholder="Test placeholder"
      />
    );

    const composer = screen.getByLabelText("Message input");
    expect(composer).toBeInTheDocument();
    expect(composer).toHaveAttribute("data-acp-composer-input");
  });

  it("updates value on input change", () => {
    render(<Composer store={mockStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Hello World" } });

    expect(input).toHaveValue("Hello World");
  });

  it("calls sendPrompt on Enter key", async () => {
    const onSend = vi.fn();
    render(<Composer store={mockStore} controller={mockController} onSend={onSend} />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(mockController.sendPrompt).toHaveBeenCalledWith("test-session-123", "Test message");
    });
    expect(onSend).toHaveBeenCalledWith("Test message");
  });

  it("does not send on Shift+Enter", () => {
    render(<Composer store={mockStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(mockController.sendPrompt).not.toHaveBeenCalled();
  });

  it("clears input after sending", async () => {
    render(<Composer store={mockStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  it("disables send button when input is empty", () => {
    render(<Composer store={mockStore} controller={mockController} />);

    const sendButton = screen.getByLabelText("Send message");
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has content", () => {
    render(<Composer store={mockStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Hello" } });

    const sendButton = screen.getByLabelText("Send message");
    expect(sendButton).not.toBeDisabled();
  });

  it("respects disabled prop", () => {
    render(<Composer store={mockStore} controller={mockController} disabled={true} />);

    const input = screen.getByLabelText("Message input");
    expect(input).toBeDisabled();
  });

  it("shows placeholder text", () => {
    render(
      <Composer
        store={mockStore}
        controller={mockController}
        placeholder="Custom placeholder"
      />
    );

    const input = screen.getByLabelText("Message input");
    expect(input).toHaveAttribute("placeholder", "Custom placeholder");
  });
});

describe("Composer keyboard handling", () => {
  let mockStore: AcpStore;
  let mockController: SessionController;

  beforeEach(() => {
    mockStore = createMockStore();
    mockController = createMockController();
  });

  it("handles composition events correctly", () => {
    render(<Composer store={mockStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(mockController.sendPrompt).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(mockController.sendPrompt).not.toHaveBeenCalled();
  });

  it("does not send on Escape key", () => {
    render(<Composer store={mockStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(mockController.sendPrompt).not.toHaveBeenCalled();
  });

  it("does not send on Tab key", () => {
    render(<Composer store={mockStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.keyDown(input, { key: "Tab" });

    expect(mockController.sendPrompt).not.toHaveBeenCalled();
  });
});

describe("Composer disabled states", () => {
  it("disables when not connected", () => {
    const disconnectedStore = createMockStore({ connectionStatus: "disconnected" });
    const mockController = createMockController();

    render(<Composer store={disconnectedStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    expect(input).toBeDisabled();
  });

  it("disables when not initialized", () => {
    const uninitializedStore = createMockStore({ initialized: false });
    const mockController = createMockController();

    render(<Composer store={uninitializedStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    expect(input).toBeDisabled();
  });

  it("disables when no session", () => {
    const noSessionStore = createMockStore({ sessionId: null });
    const mockController = createMockController();

    render(<Composer store={noSessionStore} controller={mockController} />);

    const input = screen.getByLabelText("Message input");
    expect(input).toBeDisabled();
  });
});
