import type { AcpStore } from "../store/index.js";
import type { SessionController } from "@acp/chat-core";
import type { SettingsRowRenderProps } from "../settings/types.js";

export interface ComposerProps {
  /** The ACP store instance */
  store: AcpStore;
  /** Session controller for sending prompts and canceling */
  controller: SessionController;
  /** Optional CSS class for styling */
  className?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Callback when a message is sent */
  onSend?: (text: string) => void;
  /** Callback when streaming is stopped */
  onStop?: () => void;
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
  /** Maximum number of rows for the textarea */
  maxRows?: number;
  /** Minimum number of rows for the textarea */
  minRows?: number;
  /** Custom renderer for the session settings row */
  renderSettingsRow?: ((props: SettingsRowRenderProps) => React.ReactNode) | undefined;
}

export interface ComposerState {
  /** Current input value */
  value: string;
  /** Whether the input is focused */
  isFocused: boolean;
  /** Whether a composition event is active (IME) */
  isComposing: boolean;
  /** Whether streaming is active */
  isStreaming: boolean;
}

export interface ComposerTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  rows?: number;
}

export interface ComposerControlsProps {
  canSend: boolean;
  canStop: boolean;
  isStreaming: boolean;
  onSend: () => void;
  onStop: () => void;
  disabled?: boolean;
}
