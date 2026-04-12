import { describe, expect, it } from "vitest";
import {
  shouldSendOnKeydown,
  canSend,
  canStop,
  getButtonState,
  getSendText,
  isSendButtonDisabled,
  startPrompt,
  completePrompt,
  cancelPrompt,
  failPrompt,
  isPromptActive,
  shouldShowStopButton,
  type ComposerState,
  type PromptLifecycleState,
} from "./composer-logic.js";

/**
 * Composer logic helper tests.
 * 
 * Tests all pure functions for:
 * - Send button logic (shouldSendOnKeydown, canSend)
 * - Prompt lifecycle (startPrompt, completePrompt, cancelPrompt, failPrompt)
 * - State queries (isPromptActive, shouldShowStopButton)
 * - Button states (getButtonState, isSendButtonDisabled, canStop)
 */

describe("shouldSendOnKeydown()", () => {
  it("returns true for Enter key without shift", () => {
    expect(shouldSendOnKeydown("Enter", false, false)).toBe(true);
  });

  it("returns false for Enter key with shift", () => {
    expect(shouldSendOnKeydown("Enter", true, false)).toBe(false);
  });

  it("returns false for non-Enter keys", () => {
    expect(shouldSendOnKeydown("a", false, false)).toBe(false);
    expect(shouldSendOnKeydown("Space", false, false)).toBe(false);
    expect(shouldSendOnKeydown("Tab", false, false)).toBe(false);
  });

  it("returns false when composing (IME input)", () => {
    expect(shouldSendOnKeydown("Enter", false, true)).toBe(false);
    expect(shouldSendOnKeydown("a", false, true)).toBe(false);
  });

  it("handles different key cases", () => {
    expect(shouldSendOnKeydown("enter", false, false)).toBe(false);
    expect(shouldSendOnKeydown("ENTER", false, false)).toBe(false);
  });
});

describe("canSend()", () => {
  const createState = (
    value: string,
    disabled = false,
    isStreaming = false,
    isComposing = false
  ): ComposerState => ({
    value,
    disabled,
    isStreaming,
    isComposing,
  });

  it("returns true for non-empty input when enabled and not streaming", () => {
    expect(canSend(createState("Hello"))).toBe(true);
    expect(canSend(createState("  Hello  "))).toBe(true);
  });

  it("returns false for empty input", () => {
    expect(canSend(createState(""))).toBe(false);
    expect(canSend(createState("   "))).toBe(false);
    expect(canSend(createState("\t\n"))).toBe(false);
  });

  it("returns false when disabled", () => {
    expect(canSend(createState("Hello", true))).toBe(false);
  });

  it("returns false when streaming", () => {
    expect(canSend(createState("Hello", false, true))).toBe(false);
  });

  it("returns false when both disabled and streaming", () => {
    expect(canSend(createState("Hello", true, true))).toBe(false);
  });

  it("returns false for whitespace-only input even when enabled", () => {
    expect(canSend(createState(" "))).toBe(false);
    expect(canSend(createState("   ", false, false))).toBe(false);
  });
});

describe("canStop()", () => {
  it("returns true when streaming", () => {
    expect(canStop(true)).toBe(true);
  });

  it("returns false when not streaming", () => {
    expect(canStop(false)).toBe(false);
  });
});

describe("getButtonState()", () => {
  it("returns 'stop' when streaming", () => {
    expect(getButtonState(true)).toBe("stop");
  });

  it("returns 'send' when not streaming", () => {
    expect(getButtonState(false)).toBe("send");
  });
});

describe("getSendText()", () => {
  it("returns trimmed value", () => {
    expect(getSendText("Hello")).toBe("Hello");
    expect(getSendText("  Hello  ")).toBe("Hello");
    expect(getSendText("\tHello\n")).toBe("Hello");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(getSendText("")).toBe("");
    expect(getSendText("   ")).toBe("");
    expect(getSendText("\t\n")).toBe("");
  });

  it("preserves internal whitespace", () => {
    expect(getSendText("Hello  World")).toBe("Hello  World");
    expect(getSendText("Line1\nLine2")).toBe("Line1\nLine2");
  });
});

describe("isSendButtonDisabled()", () => {
  it("returns false for non-empty input when not disabled", () => {
    expect(isSendButtonDisabled("Hello", false)).toBe(false);
    expect(isSendButtonDisabled("  Hello  ", false)).toBe(false);
  });

  it("returns true when disabled regardless of input", () => {
    expect(isSendButtonDisabled("Hello", true)).toBe(true);
    expect(isSendButtonDisabled("", true)).toBe(true);
  });

  it("returns true for empty input even when not disabled", () => {
    expect(isSendButtonDisabled("", false)).toBe(true);
    expect(isSendButtonDisabled("   ", false)).toBe(true);
    expect(isSendButtonDisabled("\t\n", false)).toBe(true);
  });
});

describe("startPrompt()", () => {
  it("creates active prompt state without turnId", () => {
    const state = startPrompt();
    expect(state.phase).toBe("active");
    expect(state.turnId).toBeUndefined();
  });

  it("creates active prompt state with turnId", () => {
    const state = startPrompt("turn-123");
    expect(state.phase).toBe("active");
    expect(state.turnId).toBe("turn-123");
  });

  it("creates active prompt state with empty string turnId", () => {
    const state = startPrompt("");
    expect(state.phase).toBe("active");
    expect(state.turnId).toBe("");
  });
});

describe("completePrompt()", () => {
  it("creates complete prompt state", () => {
    const state = completePrompt();
    expect(state.phase).toBe("complete");
    expect(state.turnId).toBeUndefined();
  });
});

describe("cancelPrompt()", () => {
  it("creates cancelled prompt state", () => {
    const state = cancelPrompt();
    expect(state.phase).toBe("cancelled");
    expect(state.turnId).toBeUndefined();
  });
});

describe("failPrompt()", () => {
  it("creates error prompt state", () => {
    const state = failPrompt();
    expect(state.phase).toBe("error");
    expect(state.turnId).toBeUndefined();
  });
});

describe("isPromptActive()", () => {
  const createState = (phase: string): PromptLifecycleState => ({
    phase: phase as "idle" | "active" | "complete" | "cancelled" | "error",
  });

  it("returns true for active phase", () => {
    expect(isPromptActive(createState("active"))).toBe(true);
  });

  it("returns false for other phases", () => {
    expect(isPromptActive(createState("idle"))).toBe(false);
    expect(isPromptActive(createState("complete"))).toBe(false);
    expect(isPromptActive(createState("cancelled"))).toBe(false);
    expect(isPromptActive(createState("error"))).toBe(false);
  });

  it("returns true for active phase with turnId", () => {
    const state: PromptLifecycleState = { phase: "active", turnId: "turn-1" };
    expect(isPromptActive(state)).toBe(true);
  });
});

describe("shouldShowStopButton()", () => {
  const createLifecycle = (phase: string): PromptLifecycleState => ({
    phase: phase as "idle" | "active" | "complete" | "cancelled" | "error",
  });

  it("returns true when lifecycle phase is active", () => {
    const lifecycle = createLifecycle("active");
    expect(shouldShowStopButton(lifecycle)).toBe(true);
    expect(shouldShowStopButton(lifecycle, undefined)).toBe(true);
    expect(shouldShowStopButton(lifecycle, { type: "other" })).toBe(true);
  });

  it("returns false when lifecycle phase is not active and no timeline item", () => {
    expect(shouldShowStopButton(createLifecycle("idle"))).toBe(false);
    expect(shouldShowStopButton(createLifecycle("complete"))).toBe(false);
    expect(shouldShowStopButton(createLifecycle("cancelled"))).toBe(false);
    expect(shouldShowStopButton(createLifecycle("error"))).toBe(false);
  });

  it("returns true when lastTimelineItem is message with streaming status", () => {
    const lifecycle = createLifecycle("complete");
    const timelineItem = { type: "message", status: "streaming" };
    expect(shouldShowStopButton(lifecycle, timelineItem)).toBe(true);
  });

  it("returns false when lastTimelineItem is not message type", () => {
    const lifecycle = createLifecycle("complete");
    expect(shouldShowStopButton(lifecycle, { type: "thought" })).toBe(false);
    expect(shouldShowStopButton(lifecycle, { type: "tool" })).toBe(false);
  });

  it("returns false when lastTimelineItem is message but not streaming", () => {
    const lifecycle = createLifecycle("complete");
    expect(shouldShowStopButton(lifecycle, { type: "message", status: "pending" })).toBe(false);
    expect(shouldShowStopButton(lifecycle, { type: "message", status: "complete" })).toBe(false);
    expect(shouldShowStopButton(lifecycle, { type: "message" })).toBe(false);
  });

  it("returns true for cancelled lifecycle with streaming message", () => {
    const lifecycle = createLifecycle("cancelled");
    const timelineItem = { type: "message", status: "streaming" };
    expect(shouldShowStopButton(lifecycle, timelineItem)).toBe(true);
  });

  it("handles timeline item without status field", () => {
    const lifecycle = createLifecycle("idle");
    expect(shouldShowStopButton(lifecycle, { type: "message" })).toBe(false);
  });
});
