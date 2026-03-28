/**
 * Composer logic - pure helper functions for composer state management
 * Reused from the Svelte implementation, adapted for React patterns
 */

export interface ComposerState {
  value: string;
  disabled: boolean;
  isStreaming: boolean;
  isComposing: boolean;
}

/**
 * Determines if a keydown event should trigger send
 * Enter sends, Shift+Enter inserts newline
 */
export function shouldSendOnKeydown(
  key: string,
  shiftKey: boolean,
  isComposing: boolean
): boolean {
  if (isComposing) return false;
  return key === "Enter" && !shiftKey;
}

/**
 * Validates if send is allowed given current state
 */
export function canSend(state: ComposerState): boolean {
  const trimmed = state.value.trim();
  return !!(trimmed && !state.disabled && !state.isStreaming);
}

/**
 * Validates if stop is allowed given current state
 */
export function canStop(isStreaming: boolean): boolean {
  return isStreaming;
}

/**
 * Returns which button should be visible
 */
export function getButtonState(isStreaming: boolean): "send" | "stop" {
  return isStreaming ? "stop" : "send";
}

/**
 * Gets the trimmed text to send
 */
export function getSendText(value: string): string {
  return value.trim();
}

/**
 * Checks if the send button should be disabled
 */
export function isSendButtonDisabled(
  value: string,
  disabled: boolean
): boolean {
  return disabled || !value.trim();
}

/** Prompt lifecycle tracking for stop button visibility */
export type PromptPhase = "idle" | "active" | "complete" | "cancelled" | "error";

export interface PromptLifecycleState {
  phase: PromptPhase;
  turnId?: string | undefined;
}

export function startPrompt(turnId?: string): PromptLifecycleState {
  return { phase: "active", turnId };
}

export function completePrompt(): PromptLifecycleState {
  return { phase: "complete" };
}

export function cancelPrompt(): PromptLifecycleState {
  return { phase: "cancelled" };
}

export function failPrompt(): PromptLifecycleState {
  return { phase: "error" };
}

export function isPromptActive(state: PromptLifecycleState): boolean {
  return state.phase === "active";
}

export function shouldShowStopButton(
  lifecycle: PromptLifecycleState,
  lastTimelineItem?: { type: string; status?: string }
): boolean {
  if (lifecycle.phase === "active") return true;
  if (!lastTimelineItem) return false;
  return lastTimelineItem.type === "message" && lastTimelineItem.status === "streaming";
}
