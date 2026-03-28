export interface ComposerState {
  value: string;
  disabled: boolean;
  isStreaming: boolean;
  isComposing: boolean;
}

export function shouldSendOnKeydown(
  key: string,
  shiftKey: boolean,
  isComposing: boolean
): boolean {
  if (isComposing) return false;
  return key === "Enter" && !shiftKey;
}

export function canSend(state: ComposerState): boolean {
  const trimmed = state.value.trim();
  return !!(trimmed && !state.disabled && !state.isStreaming);
}

export function canStop(isStreaming: boolean): boolean {
  return isStreaming;
}

export function getButtonState(isStreaming: boolean): "send" | "stop" {
  return isStreaming ? "stop" : "send";
}

export function getSendText(value: string): string {
  return value.trim();
}

export function isSendButtonDisabled(
  value: string,
  disabled: boolean
): boolean {
  return disabled || !value.trim();
}

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